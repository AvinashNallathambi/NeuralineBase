import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface HealthStatus {
  status: string;
  model: string;
  available: boolean;
}

// Ollama types (kept for backward compatibility)
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

// OpenAI-compatible types (OpenRouter, Groq, OpenAI, Together, etc.)
interface OpenAiChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

interface OpenAiChatResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AiService — supports multiple providers via AI_PROVIDER env var
// ─────────────────────────────────────────────────────────────────────────────

type AiProvider = 'ollama' | 'openrouter' | 'groq' | 'openai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // Provider config
  private readonly provider: AiProvider;
  private readonly defaultModel: string;

  // Ollama config
  private readonly ollamaBaseUrl: string;

  // OpenAI-compatible config (OpenRouter, Groq, OpenAI)
  private readonly openaiBaseUrl: string;
  private readonly openaiApiKey: string;
  private readonly fallbackModels: string[];

  constructor(private readonly configService: ConfigService) {
    // Determine which provider to use
    const providerStr = this.configService.get<string>('AI_PROVIDER', 'ollama');
    this.provider = (['ollama', 'openrouter', 'groq', 'openai'].includes(providerStr)
      ? providerStr
      : 'ollama') as AiProvider;

    // Ollama config
    this.ollamaBaseUrl = this.configService.get<string>(
      'OLLAMA_URL',
      'http://localhost:11434',
    );

    // Fallback models (used when primary model is rate-limited)
    this.fallbackModels = [];

    // OpenAI-compatible config
    switch (this.provider) {
      case 'openrouter':
        this.openaiBaseUrl = 'https://openrouter.ai/api/v1';
        this.openaiApiKey = this.configService.get<string>('OPENROUTER_API_KEY', '');
        this.defaultModel = this.configService.get<string>(
          'OPENROUTER_MODEL',
          'nvidia/nemotron-3-super-120b-a12b:free',
        );
        // Free fallback models on OpenRouter (tried in order on 429/404).
        // Nemotron reliably returns JSON with response_format; the others are
        // backups for when it is rate-limited.
        this.fallbackModels = [
          'nvidia/nemotron-3-super-120b-a12b:free',
          'meta-llama/llama-3.3-70b-instruct:free',
          'qwen/qwen3-next-80b-a3b-instruct:free',
          'openai/gpt-oss-20b:free',
          'google/gemini-2.0-flash-exp:free',
        ].filter((m) => m !== this.defaultModel);
        break;
      case 'groq':
        this.openaiBaseUrl = 'https://api.groq.com/openai/v1';
        this.openaiApiKey = this.configService.get<string>('GROQ_API_KEY', '');
        this.defaultModel = this.configService.get<string>(
          'GROQ_MODEL',
          'llama-3.3-70b-versatile',
        );
        this.fallbackModels = [
          'llama-3.1-8b-instant',
          'llama-3.3-70b-versatile',
        ].filter((m) => m !== this.defaultModel);
        break;
      case 'openai':
        this.openaiBaseUrl = this.configService.get<string>(
          'OPENAI_BASE_URL',
          'https://api.openai.com/v1',
        );
        this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY', '');
        this.defaultModel = this.configService.get<string>(
          'OPENAI_MODEL',
          'gpt-4o-mini',
        );
        this.fallbackModels = ['gpt-4o-mini', 'gpt-4o'].filter(
          (m) => m !== this.defaultModel,
        );
        break;
      default:
        // Ollama
        this.openaiBaseUrl = '';
        this.openaiApiKey = '';
        this.defaultModel = this.configService.get<string>(
          'OLLAMA_MODEL',
          'mistral',
        );
        break;
    }

    this.logger.log(`AI provider: ${this.provider}, model: ${this.defaultModel}`);
    if (this.fallbackModels.length > 0) {
      this.logger.log(`Fallback models: ${this.fallbackModels.join(', ')}`);
    }

    // Warn at startup if a cloud provider is selected but its API key is missing
    if (
      (this.provider === 'openrouter' || this.provider === 'groq' || this.provider === 'openai') &&
      !this.openaiApiKey
    ) {
      this.logger.warn(
        `${this.provider.toUpperCase()}_API_KEY is not set — AI calls will fail with 401. ` +
          `Set the key in backend/.env or switch AI_PROVIDER to "ollama" for local inference.`,
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // generate() — plain text generation
  // ───────────────────────────────────────────────────────────────────────────

  async generate(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<string> {
    if (this.provider === 'ollama') {
      return this.ollamaGenerate(prompt, options);
    }
    return this.openaiGenerate(prompt, options);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // chat() — chat completion
  // ───────────────────────────────────────────────────────────────────────────

  async chat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): Promise<string> {
    if (this.provider === 'ollama') {
      return this.ollamaChat(messages, options);
    }
    return this.openaiChat(messages, options);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // generateStructured() — guaranteed JSON output
  // ───────────────────────────────────────────────────────────────────────────

  async generateStructured<T = unknown>(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<T> {
    const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. Do not include markdown formatting, explanations, or text outside the JSON object.`;

    let raw: string;

    if (this.provider === 'ollama') {
      raw = await this.ollamaGenerateStructured(jsonPrompt, options);
    } else {
      raw = await this.openaiGenerateStructured(jsonPrompt, options);
    }

    // Parse JSON from response (handles raw JSON, markdown-wrapped, reasoning
    // models that emit <think> tags, and text with embedded JSON)
    try {
      // Strip reasoning/thinking blocks that some models (Nemotron, DeepSeek-R1,
      // etc.) emit before the actual answer.
      const cleaned = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
        .trim();

      // First try: extract from markdown code blocks
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim()) as T;
      }

      // Second try: use a balanced-brace scanner to find the first valid JSON
      // object in the text. This is more robust than indexOf('{')/lastIndexOf('}')
      // because it skips braces inside strings and finds a syntactically valid
      // object even when the model emits reasoning text with stray braces.
      const jsonStr = this.extractFirstJsonObject(cleaned);
      if (jsonStr) {
        return JSON.parse(jsonStr) as T;
      }

      // Third try: parse the whole thing as JSON
      return JSON.parse(cleaned) as T;
    } catch (err: any) {
      this.logger.error(`Failed to parse AI response as JSON: ${err.message}`);
      this.logger.debug(`Raw response (first 500 chars): ${raw.slice(0, 500)}`);
      throw new Error('AI returned invalid JSON. Please try again.');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // visionGenerateStructured() — JSON output from text + image inputs
  // Supports Ollama (llava) and OpenAI-compatible vision models (GPT-4o, etc.)
  // ───────────────────────────────────────────────────────────────────────────

  async visionGenerateStructured<T = unknown>(
    prompt: string,
    images: string[], // base64-encoded image data (without data: prefix)
    options?: GenerateOptions,
  ): Promise<T> {
    let raw: string;

    if (this.provider === 'ollama') {
      raw = await this.ollamaVisionChat(prompt, images, options);
    } else {
      raw = await this.openaiVisionChat(prompt, images, options, true);
    }

    // Reuse the same JSON parsing logic
    try {
      const cleaned = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
        .trim();

      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim()) as T;
      }

      const jsonStr = this.extractFirstJsonObject(cleaned);
      if (jsonStr) {
        return JSON.parse(jsonStr) as T;
      }

      return JSON.parse(cleaned) as T;
    } catch (err: any) {
      this.logger.error(`Failed to parse vision AI response as JSON: ${err.message}`);
      this.logger.debug(`Raw response (first 500 chars): ${raw.slice(0, 500)}`);
      throw new Error('AI vision returned invalid JSON. Please try again.');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Ollama vision (llava, llava-llama3, etc.)
  // ───────────────────────────────────────────────────────────────────────────

  private async ollamaVisionChat(
    prompt: string,
    images: string[],
    options?: GenerateOptions,
  ): Promise<string> {
    const model = options?.model || this.configService.get<string>('OLLAMA_VISION_MODEL', 'llava');
    const url = `${this.ollamaBaseUrl}/api/chat`;

    this.logger.debug(`Calling Ollama vision chat [model=${model}, images=${images.length}]`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
              images,
            },
          ],
          stream: false,
          format: 'json',
          options: {
            temperature: options?.temperature ?? 0.1,
            num_predict: options?.maxTokens ?? 4096,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Ollama vision returned ${res.status}: ${text.slice(0, 200)}`);
        throw new Error(`Ollama vision failed (${res.status}). Ensure a vision model like 'llava' is pulled: ollama pull llava`);
      }

      const data = (await res.json()) as OllamaChatResponse;
      return data.message.content.trim();
    } catch (err: any) {
      this.logger.error(`Ollama vision call failed: ${err.message}`);
      throw err;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // OpenAI-compatible vision (GPT-4o, Claude, Gemini via OpenRouter, etc.)
  // ───────────────────────────────────────────────────────────────────────────

  private async openaiVisionChat(
    prompt: string,
    images: string[],
    options?: GenerateOptions,
    structured = false,
  ): Promise<string> {
    // Build multimodal content array
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: prompt },
    ];
    for (const img of images) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${img}` },
      });
    }

    // Use vision model if configured, otherwise default
    const visionModel = this.configService.get<string>(
      this.provider === 'openrouter' ? 'OPENROUTER_VISION_MODEL' : 'OPENAI_VISION_MODEL',
      this.defaultModel,
    );

    const body: OpenAiChatRequest = {
      model: visionModel,
      messages: [{ role: 'user', content: JSON.stringify(content) }] as any,
      stream: false,
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 4096,
      ...(structured && { response_format: { type: 'json_object' as const } }),
    };

    // For OpenAI-compatible APIs, content needs to be an array, not a string
    // We need to override the message content type
    (body as any).messages = [{ role: 'user', content }];

    // Use openaiFetch but we need to handle the content array
    // openaiFetch expects OpenAiChatRequest which has string content,
    // but the actual API supports array content for vision
    const url = `${this.openaiBaseUrl}/chat/completions`;
    const modelsToTry = [visionModel, ...this.fallbackModels];
    let lastError = '';

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      const requestBody = { ...body, model };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.openaiApiKey}`,
            ...(this.provider === 'openrouter' && {
              'HTTP-Referer': 'https://neuraline.health',
              'X-Title': 'Neuraline EMR',
            }),
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const text = await res.text();
          lastError = `${res.status}: ${text.slice(0, 300)}`;
          const retryable = [429, 404, 502, 503].includes(res.status);
          if (retryable && i < modelsToTry.length - 1) continue;
          throw new Error(`Vision AI error: ${lastError}`);
        }

        const data = (await res.json()) as OpenAiChatResponse;
        if (!data.choices?.[0]?.message?.content) {
          lastError = 'Empty response';
          if (i < modelsToTry.length - 1) continue;
          throw new Error('Vision AI returned empty response');
        }

        return data.choices[0].message.content.trim();
      } catch (err: any) {
        lastError = err.message;
        if (i < modelsToTry.length - 1) continue;
        throw err;
      }
    }

    throw new Error(`Vision AI failed: ${lastError}`);
  }

  /**
   * Scan text for the first syntactically valid JSON object (balanced braces,
   * respecting string literals and escape sequences). Returns the JSON string
   * or null if no valid object is found.
   */
  private extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.substring(start, i + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            // Not valid JSON yet — keep scanning for the next balanced object
            break;
          }
        }
      }
    }

    // Fallback: try the simple indexOf/lastIndexOf approach
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // Still invalid — give up
      }
    }

    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // healthCheck()
  // ───────────────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthStatus> {
    if (this.provider === 'ollama') {
      try {
        const res = await fetch(`${this.ollamaBaseUrl}/api/tags`, {
          method: 'GET',
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return {
          status: 'ok',
          model: this.defaultModel,
          available: true,
        };
      } catch {
        return {
          status: 'unavailable',
          model: this.defaultModel,
          available: false,
        };
      }
    }

    // OpenAI-compatible providers — do a minimal chat request
    try {
      await this.openaiChat(
        [{ role: 'user', content: 'Health check — respond with "OK".' }],
        { maxTokens: 5 },
      );
      return {
        status: 'ok',
        model: this.defaultModel,
        available: true,
      };
    } catch {
      return {
        status: 'unavailable',
        model: this.defaultModel,
        available: false,
      };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Ollama implementations (unchanged from original)
  // ───────────────────────────────────────────────────────────────────────────

  private async ollamaGenerate(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<string> {
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
        this.logger.error(
          `Ollama returned ${res.status}: ${text.slice(0, 200)}`,
        );
        throw new Error(`Ollama generation failed (${res.status})`);
      }

      const data = (await res.json()) as OllamaGenerateResponse;
      this.logger.debug(
        `Ollama response received [model=${data.model}, done=${data.done}]`,
      );
      return data.response.trim();
    } catch (err: any) {
      this.logger.error(`Ollama call failed: ${err.message}`);
      throw err;
    }
  }

  private async ollamaChat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): Promise<string> {
    const model = options?.model || this.defaultModel;
    const url = `${this.ollamaBaseUrl}/api/chat`;

    this.logger.debug(
      `Calling Ollama chat [model=${model}, messages=${messages.length}]`,
    );

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
        this.logger.error(
          `Ollama returned ${res.status}: ${text.slice(0, 200)}`,
        );
        throw new Error(`Ollama chat failed (${res.status})`);
      }

      const data = (await res.json()) as OllamaChatResponse;
      this.logger.debug(
        `Ollama chat response received [model=${data.model}, done=${data.done}]`,
      );
      return data.message.content.trim();
    } catch (err: any) {
      this.logger.error(`Ollama chat call failed: ${err.message}`);
      throw err;
    }
  }

  private async ollamaGenerateStructured(
    jsonPrompt: string,
    options?: GenerateOptions,
  ): Promise<string> {
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
            num_predict: options?.maxTokens ?? 4096,
          },
        } as OllamaGenerateRequest),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(
          `Ollama returned ${res.status}: ${text.slice(0, 200)}`,
        );
        throw new Error(`Ollama generation failed (${res.status})`);
      }

      const data = (await res.json()) as OllamaGenerateResponse;
      this.logger.debug(
        `Ollama response received [model=${data.model}, done=${data.done}]`,
      );
      return data.response.trim();
    } catch (err: any) {
      this.logger.error(`Ollama structured call failed: ${err.message}`);
      throw err;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // OpenAI-compatible implementations (OpenRouter, Groq, OpenAI)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Core fetch wrapper for OpenAI-compatible APIs.
   * Handles 429 rate-limiting by trying fallback models.
   * Returns { content, model } on success, throws on failure.
   */
  private async openaiFetch(
    body: OpenAiChatRequest,
    isStructured: boolean,
  ): Promise<{ content: string; model: string }> {
    const modelsToTry = [this.defaultModel, ...this.fallbackModels];
    let lastError = '';

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      const url = `${this.openaiBaseUrl}/chat/completions`;
      const requestBody: OpenAiChatRequest = { ...body, model };

      if (i > 0) {
        this.logger.warn(
          `Primary model rate-limited, trying fallback [model=${model}]`,
        );
      }

      this.logger.debug(
        `Calling ${this.provider} chat${isStructured ? ' (structured)' : ''} [model=${model}, messages=${requestBody.messages.length}]`,
      );

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.openaiApiKey}`,
            ...(this.provider === 'openrouter' && {
              'HTTP-Referer': 'https://neuraline.health',
              'X-Title': 'Neuraline EMR',
            }),
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const text = await res.text();
          lastError = `${res.status}: ${text.slice(0, 300)}`;

          // Retryable errors: 429 (rate limit), 404 (model not found/unavailable),
          // 502/503 (upstream errors) — try next fallback model
          const retryable = [429, 404, 502, 503].includes(res.status);
          if (retryable && i < modelsToTry.length - 1) {
            this.logger.warn(
              `${this.provider} model ${model} failed (${res.status}). Trying fallback...`,
            );
            continue;
          }

          // Non-retryable error or no more fallbacks — throw with useful message
          this.logger.error(
            `${this.provider} returned ${res.status}: ${text.slice(0, 300)}`,
          );

          // Parse OpenRouter error for user-friendly message
          let userMessage = `AI service error (${res.status})`;
          try {
            const errJson = JSON.parse(text);
            if (errJson.error?.message) {
              userMessage = errJson.error.message;
            }
          } catch {
            // Not JSON, use raw text
            if (text) userMessage = text.slice(0, 200);
          }

          if (res.status === 429) {
            throw new Error(
              `AI rate limit reached. All models are temporarily rate-limited. Please wait a moment and try again.`,
            );
          }
          throw new Error(userMessage);
        }

        const data = (await res.json()) as OpenAiChatResponse;

        // Defensive: some providers return 200 but with no choices or null content
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          this.logger.warn(
            `${this.provider} returned empty response [model=${model}, status=${res.status}]. Response: ${JSON.stringify(data).slice(0, 300)}`,
          );
          lastError = 'Empty response from model (no choices)';
          if (i < modelsToTry.length - 1) {
            continue; // Try next fallback model
          }
          throw new Error(
            'AI model returned an empty response. Please try again.',
          );
        }

        const content = data.choices[0].message.content;
        if (!content || typeof content !== 'string') {
          this.logger.warn(
            `${this.provider} returned null/empty content [model=${model}]. Response: ${JSON.stringify(data).slice(0, 300)}`,
          );
          lastError = 'Null content from model';
          if (i < modelsToTry.length - 1) {
            continue; // Try next fallback model
          }
          throw new Error(
            'AI model returned empty content. Please try again.',
          );
        }

        this.logger.debug(
          `${this.provider} response received [model=${model}, tokens=${data.usage?.total_tokens ?? 'n/a'}]`,
        );
        return {
          content: content.trim(),
          model,
        };
      } catch (err: any) {
        // If it's already our thrown error with a good message, rethrow
        if (err.message && !err.message.includes('fetch')) {
          if (i < modelsToTry.length - 1 && err.message.includes('rate limit')) {
            continue;
          }
          throw err;
        }
        // Network/fetch error
        lastError = err.message;
        this.logger.error(`${this.provider} fetch error [model=${model}]: ${err.message}`);
        if (i < modelsToTry.length - 1) continue;
        throw new Error(
          `Could not connect to ${this.provider}. Check your API key and network connection.`,
        );
      }
    }

    // All fallbacks exhausted
    throw new Error(
      `AI request failed after trying ${modelsToTry.length} models. Last error: ${lastError}`,
    );
  }

  private async openaiGenerate(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<string> {
    // Generate is just a chat with a single user message
    return this.openaiChat([{ role: 'user', content: prompt }], options);
  }

  private async openaiChat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): Promise<string> {
    const body: OpenAiChatRequest = {
      model: this.defaultModel, // will be overridden by openaiFetch per fallback
      messages,
      stream: false,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 1024,
    };

    const result = await this.openaiFetch(body, false);
    return result.content;
  }

  private async openaiGenerateStructured(
    jsonPrompt: string,
    options?: GenerateOptions,
  ): Promise<string> {
    const body: OpenAiChatRequest = {
      model: this.defaultModel, // will be overridden by openaiFetch per fallback
      messages: [{ role: 'user', content: jsonPrompt }],
      stream: false,
      temperature: options?.temperature ?? 0.1,
      // Structured JSON responses need more room than plain text — 1024 tokens
      // is frequently truncated mid-JSON, causing parse failures. 4096 is a
      // safe default that all providers support.
      max_tokens: options?.maxTokens ?? 4096,
      response_format: { type: 'json_object' },
    };

    const result = await this.openaiFetch(body, true);
    return result.content;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Domain-specific AI features
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate a prior authorization letter from clinical notes.
   */
  async generatePriorAuthLetter(input: {
    patientName: string;
    patientDob: string;
    medicationName: string;
    diagnosis: string;
    clinicalNotes: string;
    insurancePlan: string;
  }): Promise<{ letter: string; formatted: boolean }> {
    const systemPrompt = `You are a medical prior authorization specialist. Write a formal, professional prior authorization letter to an insurance company requesting approval for a medication. The letter must include:
1. Date and insurer name
2. Patient demographics (name, DOB)
3. Diagnosis with ICD-10 context
4. Clinical justification referencing the provided notes
5. The requested medication
6. Statement of medical necessity
7. Provider signature block

Use formal medical correspondence tone. Do not include placeholder brackets — fill in all known fields from the provided data.`;

    const userPrompt = `Write a prior authorization letter using the following information:

Patient Name: ${input.patientName}
Patient DOB: ${input.patientDob}
Insurance Plan: ${input.insurancePlan}
Requested Medication: ${input.medicationName}
Diagnosis: ${input.diagnosis}
Clinical Notes:
"""${input.clinicalNotes}"""

Return ONLY a JSON object with this exact shape:
{
  "letter": "the full prior authorization letter text",
  "formatted": true
}`;

    try {
      const result = await this.generateStructured<{ letter: string; formatted: boolean }>(
        `${systemPrompt}\n\n${userPrompt}`,
      );
      return {
        letter: result.letter || '',
        formatted: result.formatted ?? true,
      };
    } catch (err: any) {
      this.logger.error(`Prior auth letter generation failed: ${err.message}`);
      // Fallback: try plain text generation
      try {
        const letter = await this.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);
        return { letter, formatted: false };
      } catch (fallbackErr: any) {
        this.logger.error(`Prior auth letter fallback also failed: ${fallbackErr.message}`);
        throw new Error('Failed to generate prior authorization letter.');
      }
    }
  }

  /**
   * Predict claim denial risk based on coding patterns and patient/claim data.
   */
  async predictDenialRisk(input: {
    cptCodes: string[];
    icd10Codes: string[];
    modifierCodes?: string[];
    patientAge: number;
    patientGender: string;
    insuranceType: string;
    priorDenials: number;
  }): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    riskScore: number;
    factors: string[];
    recommendations: string[];
  }> {
    const prompt = `You are a medical billing and coding expert specializing in claim denial analysis. Analyze the following claim data and predict the likelihood of denial.

CPT Codes: ${input.cptCodes.join(', ')}
ICD-10 Codes: ${input.icd10Codes.join(', ')}
Modifier Codes: ${(input.modifierCodes || []).join(', ') || 'None'}
Patient Age: ${input.patientAge}
Patient Gender: ${input.patientGender}
Insurance Type: ${input.insuranceType}
Prior Denials for this patient: ${input.priorDenials}

Consider factors such as:
- Code compatibility (CPT to ICD-10 linkage)
- Missing or incorrect modifiers
- Frequency of prior denials
- Age/gender appropriateness of procedures
- Common denial reasons for the insurance type

Return ONLY a JSON object with this exact shape:
{
  "riskLevel": "low" | "medium" | "high",
  "riskScore": 0-100 integer (higher = more risk),
  "factors": ["list of specific risk factors identified"],
  "recommendations": ["list of actionable recommendations to reduce denial risk"]
}

Rules:
- riskScore must be an integer between 0 and 100.
- riskLevel should correlate with riskScore (0-33 low, 34-66 medium, 67-100 high).
- Include at least 1 factor and 1 recommendation.`;

    try {
      const result = await this.generateStructured<{
        riskLevel: 'low' | 'medium' | 'high';
        riskScore: number;
        factors: string[];
        recommendations: string[];
      }>(prompt);
      return {
        riskLevel: result.riskLevel || 'low',
        riskScore: typeof result.riskScore === 'number' ? result.riskScore : 0,
        factors: Array.isArray(result.factors) ? result.factors : [],
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
      };
    } catch (err: any) {
      this.logger.error(`Denial risk prediction failed: ${err.message}`);
      return {
        riskLevel: 'low',
        riskScore: 0,
        factors: ['Unable to analyze claim — AI service unavailable.'],
        recommendations: ['Retry the analysis later or review codes manually.'],
      };
    }
  }

  /**
   * Audit clinical documentation for coding completeness.
   */
  async auditCoding(input: {
    soapNote: string;
    cptCodes: string[];
    icd10Codes: string[];
  }): Promise<{
    issues: Array<{
      type: string;
      severity: 'info' | 'warning' | 'error';
      message: string;
      suggestion: string;
    }>;
    missingElements: string[];
    undercoded: boolean;
    overcoded: boolean;
    recommendations: string[];
  }> {
    const prompt = `You are a certified medical coding auditor (CPC, CCS-P). Audit the following SOAP note and assigned codes for completeness, accuracy, and compliance.

SOAP Note:
"""${input.soapNote}"""

Assigned CPT Codes: ${input.cptCodes.join(', ') || 'None'}
Assigned ICD-10 Codes: ${input.icd10Codes.join(', ') || 'None'}

Check for:
- Missing HPI elements (onset, location, duration, character, aggravating/alleviating factors, timing, severity)
- Missing or incomplete ROS (Review of Systems)
- Missing or insufficient MDM (Medical Decision Making) documentation
- Under-coding (documentation supports higher level of service than billed)
- Over-coding (billed code not supported by documentation)
- Missing ICD-10 codes that are supported by documentation
- Unbundling or incorrect modifier usage

Return ONLY a JSON object with this exact shape:
{
  "issues": [
    {
      "type": "category of issue (e.g., 'missing_hpi', 'undercoding', 'overcoding', 'missing_ros', 'missing_mdm')",
      "severity": "info" | "warning" | "error",
      "message": "concise description of the issue",
      "suggestion": "specific fix or improvement"
    }
  ],
  "missingElements": ["list of specific missing documentation elements"],
  "undercoded": boolean,
  "overcoded": boolean,
  "recommendations": ["list of actionable recommendations to improve coding accuracy"]
}

Rules:
- If no issues are found, return an empty issues array.
- undercoded and overcoded must be boolean values.
- Be specific and clinically accurate.`;

    try {
      const result = await this.generateStructured<{
        issues: Array<{
          type: string;
          severity: 'info' | 'warning' | 'error';
          message: string;
          suggestion: string;
        }>;
        missingElements: string[];
        undercoded: boolean;
        overcoded: boolean;
        recommendations: string[];
      }>(prompt);
      return {
        issues: Array.isArray(result.issues) ? result.issues : [],
        missingElements: Array.isArray(result.missingElements) ? result.missingElements : [],
        undercoded: result.undercoded ?? false,
        overcoded: result.overcoded ?? false,
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
      };
    } catch (err: any) {
      this.logger.error(`Coding audit failed: ${err.message}`);
      return {
        issues: [],
        missingElements: ['Unable to perform audit — AI service unavailable.'],
        undercoded: false,
        overcoded: false,
        recommendations: ['Retry the audit later or perform a manual review.'],
      };
    }
  }

  /**
   * Predict appointment no-show risk.
   */
  async predictNoShow(input: {
    patientAge: number;
    patientGender: string;
    appointmentType: string;
    daysSinceLastVisit: number;
    historicalNoShows: number;
    dayOfWeek: string;
    timeOfDay: string;
    distanceFromClinic: number;
  }): Promise<{
    noShowRisk: 'low' | 'medium' | 'high';
    probability: number;
    factors: string[];
    recommendations: string[];
  }> {
    const prompt = `You are a healthcare analytics expert specializing in patient appointment behavior prediction. Analyze the following patient and appointment data to predict the likelihood of a no-show.

Patient Age: ${input.patientAge}
Patient Gender: ${input.patientGender}
Appointment Type: ${input.appointmentType}
Days Since Last Visit: ${input.daysSinceLastVisit}
Historical No-Shows: ${input.historicalNoShows}
Day of Week: ${input.dayOfWeek}
Time of Day: ${input.timeOfDay}
Distance from Clinic (miles): ${input.distanceFromClinic}

Consider known no-show risk factors:
- Younger patients tend to have higher no-show rates
- Longer gaps since last visit increase risk
- Higher historical no-show count is the strongest predictor
- Early morning and late afternoon appointments have higher no-show rates
- Greater distance from clinic increases risk
- Certain appointment types (e.g., follow-up vs. new patient) have different rates

Return ONLY a JSON object with this exact shape:
{
  "noShowRisk": "low" | "medium" | "high",
  "probability": 0.0-1.0 float (likelihood of no-show),
  "factors": ["list of specific factors contributing to the risk"],
  "recommendations": ["list of actionable recommendations to reduce no-show risk (e.g., reminder calls, overbooking, transportation assistance)"]
}

Rules:
- probability must be a float between 0.0 and 1.0.
- noShowRisk should correlate with probability (0-0.33 low, 0.34-0.66 medium, 0.67-1.0 high).
- Include at least 1 factor and 1 recommendation.`;

    try {
      const result = await this.generateStructured<{
        noShowRisk: 'low' | 'medium' | 'high';
        probability: number;
        factors: string[];
        recommendations: string[];
      }>(prompt);
      return {
        noShowRisk: result.noShowRisk || 'low',
        probability: typeof result.probability === 'number' ? result.probability : 0,
        factors: Array.isArray(result.factors) ? result.factors : [],
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
      };
    } catch (err: any) {
      this.logger.error(`No-show prediction failed: ${err.message}`);
      return {
        noShowRisk: 'low',
        probability: 0,
        factors: ['Unable to analyze — AI service unavailable.'],
        recommendations: ['Retry the prediction later or use manual assessment.'],
      };
    }
  }

  /**
   * Clinical Documentation Improvement (CDI) review.
   */
  async cdiReview(input: {
    soapNote: string;
    encounterType: string;
  }): Promise<{
    missingElements: Array<{
      section: string;
      element: string;
      importance: 'critical' | 'important' | 'optional';
    }>;
    qualityScore: number;
    suggestions: string[];
    auditRiskLevel: 'low' | 'medium' | 'high';
  }> {
    const prompt = `You are a Clinical Documentation Improvement (CDI) specialist. Review the following clinical documentation for completeness, specificity, and compliance.

Encounter Type: ${input.encounterType}

SOAP Note:
"""${input.soapNote}"""

Evaluate the documentation for:
- Completeness of each SOAP section (Subjective, Objective, Assessment, Plan)
- Presence of required HPI elements
- Adequate ROS documentation
- Clear and specific assessment with supporting diagnoses
- Detailed plan including medications, procedures, follow-up, and patient education
- Documentation specificity (e.g., laterality, severity, acuity)
- Support for the level of E/M service billed
- Audit risk based on documentation gaps

Return ONLY a JSON object with this exact shape:
{
  "missingElements": [
    {
      "section": "SOAP section (e.g., 'subjective', 'objective', 'assessment', 'plan')",
      "element": "specific missing element (e.g., 'HPI onset', 'vital signs', 'diagnosis specificity')",
      "importance": "critical" | "important" | "optional"
    }
  ],
  "qualityScore": 0-100 integer (higher = better documentation quality),
  "suggestions": ["list of specific suggestions to improve the documentation"],
  "auditRiskLevel": "low" | "medium" | "high"
}

Rules:
- qualityScore must be an integer between 0 and 100.
- If documentation is complete, return an empty missingElements array.
- auditRiskLevel should reflect the likelihood of audit findings (low = well documented, high = significant gaps).
- Be specific about what is missing and where.`;

    try {
      const result = await this.generateStructured<{
        missingElements: Array<{
          section: string;
          element: string;
          importance: 'critical' | 'important' | 'optional';
        }>;
        qualityScore: number;
        suggestions: string[];
        auditRiskLevel: 'low' | 'medium' | 'high';
      }>(prompt);
      return {
        missingElements: Array.isArray(result.missingElements) ? result.missingElements : [],
        qualityScore: typeof result.qualityScore === 'number' ? result.qualityScore : 0,
        suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
        auditRiskLevel: result.auditRiskLevel || 'low',
      };
    } catch (err: any) {
      this.logger.error(`CDI review failed: ${err.message}`);
      return {
        missingElements: [],
        qualityScore: 0,
        suggestions: ['Unable to perform CDI review — AI service unavailable.'],
        auditRiskLevel: 'low',
      };
    }
  }

  /**
   * AI-powered drug dosing recommendations.
   */
  async recommendDrugDosing(input: {
    medicationName: string;
    patientAge: number;
    patientWeight: number;
    patientSex: string;
    creatinine: number;
    diagnosis: string;
    currentMedications: string[];
  }): Promise<{
    recommendedDose: string;
    maxDose: string;
    route: string;
    frequency: string;
    renalAdjustment: boolean;
    hepaticAdjustment: boolean;
    warnings: string[];
    alternatives: string[];
  }> {
    const prompt = `You are a clinical pharmacist and dosing expert. Provide safe, evidence-based dosing recommendations for the following medication and patient.

Medication: ${input.medicationName}
Patient Age: ${input.patientAge} years
Patient Weight: ${input.patientWeight} kg
Patient Sex: ${input.patientSex}
Serum Creatinine: ${input.creatinine} mg/dL
Diagnosis: ${input.diagnosis}
Current Medications: ${(input.currentMedications || []).join(', ') || 'None'}

Calculate the creatinine clearance (CrCl) using the Cockcroft-Gault equation:
CrCl (male) = ((140 - age) × weight) / (72 × creatinine)
CrCl (female) = CrCl (male) × 0.85

Consider:
- Age-appropriate dosing (pediatric, adult, geriatric considerations)
- Weight-based dosing if applicable
- Renal function adjustments based on calculated CrCl
- Hepatic impairment considerations
- Drug-drug interactions with current medications
- FDA-approved dosing for the specified diagnosis

Return ONLY a JSON object with this exact shape:
{
  "recommendedDose": "recommended dose with units (e.g., '500 mg')",
  "maxDose": "maximum safe dose per day with units",
  "route": "route of administration (e.g., 'Oral', 'IV', 'IM')",
  "frequency": "dosing frequency (e.g., 'BID', 'every 8 hours')",
  "renalAdjustment": boolean (true if renal dose adjustment is needed),
  "hepaticAdjustment": boolean (true if hepatic dose adjustment is needed),
  "warnings": ["list of specific warnings, contraindications, and interaction alerts"],
  "alternatives": ["list of alternative medications if the primary choice is contraindicated or suboptimal"]
}

Rules:
- All dose values must include units.
- renalAdjustment and hepaticAdjustment must be boolean.
- Include at least 1 warning.
- This is a clinical decision support tool — always recommend verification by a licensed provider.`;

    try {
      const result = await this.generateStructured<{
        recommendedDose: string;
        maxDose: string;
        route: string;
        frequency: string;
        renalAdjustment: boolean;
        hepaticAdjustment: boolean;
        warnings: string[];
        alternatives: string[];
      }>(prompt);
      return {
        recommendedDose: result.recommendedDose || '',
        maxDose: result.maxDose || '',
        route: result.route || '',
        frequency: result.frequency || '',
        renalAdjustment: result.renalAdjustment ?? false,
        hepaticAdjustment: result.hepaticAdjustment ?? false,
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        alternatives: Array.isArray(result.alternatives) ? result.alternatives : [],
      };
    } catch (err: any) {
      this.logger.error(`Drug dosing recommendation failed: ${err.message}`);
      return {
        recommendedDose: '',
        maxDose: '',
        route: '',
        frequency: '',
        renalAdjustment: false,
        hepaticAdjustment: false,
        warnings: ['Unable to generate dosing recommendation — AI service unavailable. Consult a clinical pharmacist.'],
        alternatives: [],
      };
    }
  }

  /**
   * Generate a referral letter.
   */
  async generateReferralLetter(input: {
    patientName: string;
    patientDob: string;
    referringProvider: string;
    specialistName: string;
    specialty: string;
    reasonForReferral: string;
    clinicalSummary: string;
    urgent: boolean;
  }): Promise<{ letter: string }> {
    const systemPrompt = `You are a medical referral coordinator. Write a professional referral letter from a referring provider to a specialist. The letter must include:
1. Date
2. Referring provider name and the specialist's name
3. Patient demographics (name, DOB)
4. Reason for referral
5. Clinical summary with relevant history, findings, and prior workup
6. Urgency indicator if marked urgent
7. Request for consultation and return of findings
8. Referring provider signature block

Use professional medical correspondence tone. Do not include placeholder brackets — fill in all known fields from the provided data.`;

    const userPrompt = `Write a referral letter using the following information:

Patient Name: ${input.patientName}
Patient DOB: ${input.patientDob}
Referring Provider: ${input.referringProvider}
Specialist Name: ${input.specialistName}
Specialty: ${input.specialty}
Reason for Referral: ${input.reasonForReferral}
Clinical Summary:
"""${input.clinicalSummary}"""
Urgent: ${input.urgent ? 'Yes — indicate urgency in the letter' : 'No'}

Return ONLY a JSON object with this exact shape:
{
  "letter": "the full referral letter text"
}`;

    try {
      const result = await this.generateStructured<{ letter: string }>(
        `${systemPrompt}\n\n${userPrompt}`,
      );
      return { letter: result.letter || '' };
    } catch (err: any) {
      this.logger.error(`Referral letter generation failed: ${err.message}`);
      // Fallback: try plain text generation
      try {
        const letter = await this.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);
        return { letter };
      } catch (fallbackErr: any) {
        this.logger.error(`Referral letter fallback also failed: ${fallbackErr.message}`);
        throw new Error('Failed to generate referral letter.');
      }
    }
  }
}
