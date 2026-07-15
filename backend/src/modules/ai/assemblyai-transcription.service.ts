import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number; // seconds
  words: Array<{
    text: string;
    start: number; // milliseconds
    end: number; // milliseconds
    confidence: number;
  }>;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number; // milliseconds
    end: number; // milliseconds
    confidence: number;
  }>;
  languageCode?: string;
}

interface AssemblyAiTranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  error?: string;
  audio_duration?: number;
  language_code?: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

@Injectable()
export class AssemblyAiTranscriptionService {
  private readonly logger = new Logger(AssemblyAiTranscriptionService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.assemblyai.com/v2';
  private readonly pollIntervalMs = 2000;
  private readonly maxPollAttempts = 150; // 5 minutes total

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ASSEMBLYAI_API_KEY', '').trim();

    if (!this.apiKey) {
      this.logger.warn(
        'ASSEMBLYAI_API_KEY is not configured. Transcription service will be unavailable.',
      );
    }
  }

  /**
   * Check whether the AssemblyAI service is configured.
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Transcribe an audio buffer using the AssemblyAI REST API.
   *
   * @param buffer - Raw audio bytes (e.g. from multer/memory storage)
   * @param mimeType - Audio MIME type (audio/webm, audio/mp4, audio/wav, etc.)
   */
  async transcribeAudioBuffer(buffer: Buffer, mimeType?: string): Promise<TranscriptionResult> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Audio buffer is empty');
    }

    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'AssemblyAI API key is not configured. Please set ASSEMBLYAI_API_KEY in your environment.',
      );
    }

    this.logger.debug(
      `Transcribing audio buffer (${buffer.length} bytes, ${mimeType || 'unknown mime'}) with AssemblyAI`,
    );

    // 1. Upload the audio file
    const uploadUrl = await this.uploadAudio(buffer);

    // 2. Start transcription and poll for completion
    const transcript = await this.createAndPollTranscript(uploadUrl);

    return this.mapTranscriptResult(transcript);
  }

  /**
   * Transcribe audio from a public URL (useful for stored recordings).
   */
  async transcribeAudioUrl(audioUrl: string): Promise<TranscriptionResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('AssemblyAI API key is not configured');
    }

    this.logger.debug(`Transcribing audio URL with AssemblyAI: ${audioUrl.slice(0, 100)}`);

    const transcript = await this.createAndPollTranscript(audioUrl);
    return this.mapTranscriptResult(transcript);
  }

  /**
   * Upload audio bytes to AssemblyAI and return the upload URL.
   */
  private async uploadAudio(buffer: Buffer): Promise<string> {
    const url = `${this.baseUrl}/upload`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(buffer),
      });

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`AssemblyAI upload failed (${res.status}): ${errorText.slice(0, 300)}`);
        throw new ServiceUnavailableException(`AssemblyAI upload failed (${res.status})`);
      }

      const data = (await res.json()) as { upload_url: string };
      return data.upload_url;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error(`AssemblyAI upload error: ${err.message}`);
      throw new ServiceUnavailableException('Failed to upload audio to AssemblyAI');
    }
  }

  /**
   * Create a transcription job and poll until it completes or errors.
   */
  private async createAndPollTranscript(audioUrl: string): Promise<AssemblyAiTranscriptResponse> {
    // Start transcription
    const createUrl = `${this.baseUrl}/transcript`;

    let transcriptId: string;
    try {
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          speech_models: ['universal-3-5-pro'],
          format_text: true,
          speaker_labels: true,
          speakers_expected: 2,
          domain: 'medical-v1',
          language_code: 'en_us',
        }),
      });

      if (!createRes.ok) {
        const errorText = await createRes.text();
        this.logger.error(
          `AssemblyAI transcript create failed (${createRes.status}): ${errorText.slice(0, 300)}`,
        );

        if (createRes.status === 401) {
          throw new ServiceUnavailableException('Invalid AssemblyAI API key');
        }
        if (createRes.status === 429) {
          throw new ServiceUnavailableException('AssemblyAI rate limit reached. Please try again shortly.');
        }

        throw new ServiceUnavailableException(
          `AssemblyAI transcription failed (${createRes.status}): ${errorText.slice(0, 200)}`,
        );
      }

      const createData = (await createRes.json()) as { id: string };
      transcriptId = createData.id;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error(`AssemblyAI create transcript error: ${err.message}`);
      throw new ServiceUnavailableException('Failed to start AssemblyAI transcription');
    }

    // Poll for completion
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      await this.sleep(this.pollIntervalMs);

      try {
        const pollRes = await fetch(`${this.baseUrl}/transcript/${transcriptId}`, {
          method: 'GET',
          headers: { Authorization: this.apiKey },
        });

        if (!pollRes.ok) {
          this.logger.warn(`AssemblyAI poll returned ${pollRes.status}, retrying...`);
          continue;
        }

        const transcript = (await pollRes.json()) as AssemblyAiTranscriptResponse;

        if (transcript.status === 'completed') {
          return transcript;
        }

        if (transcript.status === 'error') {
          this.logger.error(`AssemblyAI transcription error: ${transcript.error}`);
          throw new ServiceUnavailableException(
            transcript.error || 'AssemblyAI transcription failed',
          );
        }

        // Otherwise queued or processing — continue polling
      } catch (err: any) {
        if (err instanceof ServiceUnavailableException) throw err;
        this.logger.warn(`AssemblyAI poll error: ${err.message}, retrying...`);
      }
    }

    throw new ServiceUnavailableException(
      'Transcription timed out waiting for AssemblyAI to complete',
    );
  }

  private mapTranscriptResult(transcript: AssemblyAiTranscriptResponse): TranscriptionResult {
    const durationSeconds = transcript.audio_duration
      ? Math.round(transcript.audio_duration * 100) / 100
      : 0;

    return {
      text: transcript.text || '',
      confidence: this.calculateConfidence(transcript.words),
      duration: durationSeconds,
      words: (transcript.words || []).map((w) => ({
        text: w.text,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      })),
      utterances: (transcript.utterances || []).map((u) => ({
        speaker: u.speaker,
        text: u.text,
        start: u.start,
        end: u.end,
        confidence: u.confidence,
      })),
      languageCode: transcript.language_code || 'en',
    };
  }

  private calculateConfidence(words?: Array<{ confidence?: number }>): number {
    if (!words || words.length === 0) return 0;
    const sum = words.reduce((acc, w) => acc + (w.confidence || 0), 0);
    return Math.round((sum / words.length) * 100) / 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
