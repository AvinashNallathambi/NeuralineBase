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
          'openai/gpt-oss-120b:free',
        );
        // Free fallback models on OpenRouter (tried in order on 429)
        this.fallbackModels = [
          'openai/gpt-oss-120b:free',
          'meta-llama/llama-3.3-70b-instruct:free',
          'openai/gpt-oss-20b:free',
          'qwen/qwen3-next-80b-a3b-instruct:free',
          'nvidia/nemotron-3-super-120b-a12b:free',
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

    // Parse JSON from response (handles raw JSON, markdown-wrapped, and text with embedded JSON)
    try {
      // First try: extract from markdown code blocks
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim()) as T;
      }

      // Second try: extract the outermost JSON object from the text
      // (models sometimes add text before/after the JSON)
      const trimmed = raw.trim();
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = trimmed.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr) as T;
      }

      // Third try: parse the whole thing as JSON
      return JSON.parse(trimmed) as T;
    } catch (err: any) {
      this.logger.error(`Failed to parse AI response as JSON: ${err.message}`);
      this.logger.debug(`Raw response (first 500 chars): ${raw.slice(0, 500)}`);
      throw new Error('AI returned invalid JSON. Please try again.');
    }
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
      max_tokens: options?.maxTokens ?? 1024,
      response_format: { type: 'json_object' },
    };

    const result = await this.openaiFetch(body, true);
    return result.content;
  }
}
