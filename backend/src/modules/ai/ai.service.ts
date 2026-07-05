import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  format?: 'json' | string;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaGenerateResponse {
  response: string;
  done: boolean;
  model: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponse {
  message: { role: string; content: string };
  done: boolean;
  model: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ollamaBaseUrl: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.ollamaBaseUrl = this.configService.get<string>('OLLAMA_URL', 'http://localhost:11434');
    this.defaultModel = this.configService.get<string>('OLLAMA_MODEL', 'mistral');
  }

  /**
   * Generate text using Ollama's /api/generate endpoint.
   * HIPAA: Never log the prompt content — only log metadata.
   */
  async generate(prompt: string, options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string> {
    const model = options?.model || this.defaultModel;
    const url = `${this.ollamaBaseUrl}/api/generate`;

    this.logger.debug(`Calling Ollama generate [model=${model}]`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.2,
            num_predict: options?.maxTokens ?? 1024,
          },
        } as OllamaGenerateRequest),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Ollama returned ${res.status}: ${text.slice(0, 200)}`);
        throw new Error(`Ollama generation failed (${res.status})`);
      }

      const data = (await res.json()) as OllamaGenerateResponse;
      this.logger.debug(`Ollama response received [model=${data.model}, done=${data.done}]`);
      return data.response.trim();
    } catch (err: any) {
      this.logger.error(`Ollama call failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Chat completion using Ollama's /api/chat endpoint.
   */
  async chat(messages: Array<{ role: string; content: string }>, options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string> {
    const model = options?.model || this.defaultModel;
    const url = `${this.ollamaBaseUrl}/api/chat`;

    this.logger.debug(`Calling Ollama chat [model=${model}, messages=${messages.length}]`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.2,
            num_predict: options?.maxTokens ?? 1024,
          },
        } as OllamaChatRequest),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Ollama returned ${res.status}: ${text.slice(0, 200)}`);
        throw new Error(`Ollama chat failed (${res.status})`);
      }

      const data = (await res.json()) as OllamaChatResponse;
      this.logger.debug(`Ollama chat response received [model=${data.model}, done=${data.done}]`);
      return data.message.content.trim();
    } catch (err: any) {
      this.logger.error(`Ollama chat call failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Structured generation — asks the model to reply with valid JSON.
   * Uses Ollama's native `format: json` to guarantee valid JSON output.
   */
  async generateStructured<T = unknown>(
    prompt: string,
    options?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<T> {
    const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. Do not include markdown formatting, explanations, or text outside the JSON object.`;
    const model = options?.model || this.defaultModel;
    const url = `${this.ollamaBaseUrl}/api/generate`;

    this.logger.debug(`Calling Ollama generate (structured) [model=${model}]`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: jsonPrompt,
          stream: false,
          format: 'json',
          options: {
            temperature: options?.temperature ?? 0.1,
            num_predict: options?.maxTokens ?? 1024,
          },
        } as OllamaGenerateRequest),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Ollama returned ${res.status}: ${text.slice(0, 200)}`);
        throw new Error(`Ollama generation failed (${res.status})`);
      }

      const data = (await res.json()) as OllamaGenerateResponse;
      this.logger.debug(`Ollama response received [model=${data.model}, done=${data.done}]`);
      const raw = data.response.trim();

      try {
        const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1].trim() : raw.trim();
        return JSON.parse(jsonString) as T;
      } catch (err: any) {
        this.logger.error(`Failed to parse Ollama response as JSON: ${err.message}`);
        this.logger.debug(`Raw response (first 500 chars): ${raw.slice(0, 500)}`);
        throw new Error('AI returned invalid JSON');
      }
    } catch (err: any) {
      this.logger.error(`Ollama structured call failed: ${err.message}`);
      throw err;
    }
  }

  async healthCheck(): Promise<{ status: string; model: string; available: boolean }> {
    try {
      const res = await fetch(`${this.ollamaBaseUrl}/api/tags`, { method: 'GET' });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return { status: 'ok', model: this.defaultModel, available: true };
    } catch {
      return { status: 'unavailable', model: this.defaultModel, available: false };
    }
  }
}
