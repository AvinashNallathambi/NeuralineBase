# AI Provider Options for Neuraline EMR

> **Goal**: Replace local Ollama with a cloud API provider that is cheap, precise, fast, and HIPAA-eligible
> **Status**: Planning document — implementation pending
> **Created**: 2026-07-12

---

## Quick Comparison Table

| Provider | Model | Input ($/1M) | Output ($/1M) | Speed | Precision | HIPAA (BAA) | JSON Mode |
|----------|-------|-------------|--------------|-------|-----------|-------------|-----------|
| **AWS Bedrock** | Claude 3 Haiku | $0.25 | $1.25 | Fast (2-5s) | High | ✅ Yes (AWS BAA) | ✅ Yes |
| **AWS Bedrock** | Claude 3.5 Haiku | $0.80 | $4.00 | Fast (2-5s) | Very High | ✅ Yes (AWS BAA) | ✅ Yes |
| **Google Gemini** | 2.5 Flash-Lite | $0.10 | $0.40 | Very Fast (1-3s) | Good | ✅ Yes (Google BAA) | ✅ Yes |
| **Google Gemini** | 2.5 Flash | $0.30 | $2.50 | Very Fast (1-3s) | High | ✅ Yes (Google BAA) | ✅ Yes |
| **OpenAI** | GPT-4o mini | $0.15 | $0.60 | Fast (1-3s) | High | ✅ Enterprise BAA only | ✅ Yes |
| **OpenAI** | GPT-4o | $2.50 | $10.00 | Fast (2-4s) | Very High | ✅ Enterprise BAA only | ✅ Yes |
| **Anthropic** | Claude 3 Haiku (direct) | $0.25 | $1.25 | Fast (2-5s) | High | ✅ Enterprise BAA | ✅ Yes |
| **Anthropic** | Claude 3.5 Haiku (direct) | $0.80 | $4.00 | Fast (2-5s) | Very High | ✅ Enterprise BAA | ✅ Yes |
| **Groq** | Llama 3.3 70B | $0.59 | $0.79 | Ultra Fast (400+ TPS) | High | ❌ No BAA | ✅ Yes |
| **Groq** | Llama 3.1 8B | $0.05 | $0.08 | Ultra Fast (840 TPS) | Medium | ❌ No BAA | ✅ Yes |
| **Together AI** | Llama 3 70B | $0.88 | $0.88 | Fast (3-5s) | High | ❌ No BAA | ✅ Yes |

---

## My Recommendation: AWS Bedrock with Claude 3 Haiku

### Why AWS Bedrock is the best choice for your EMR:

1. **HIPAA-Compliant**: Already covered under your AWS BAA — no separate agreement needed
2. **Cheapest HIPAA-eligible option**: $0.25/1M input, $1.25/1M output
3. **Good precision**: Claude 3 Haiku scores well on medical reasoning benchmarks
4. **Fast**: 2-5 second response times
5. **No infrastructure**: Managed service — no GPU instances, no Ollama containers
6. **AWS integration**: Uses IAM, CloudWatch, and VPC you already have
7. **JSON mode**: Supports structured output for your `generateStructured()` calls
8. **Intelligent Prompt Routing**: Can auto-route between Haiku and Sonnet based on complexity (saves 30%)

### Estimated Monthly Cost (AWS Bedrock)

Based on typical EMR usage (SOAP notes, code suggestions, lab summaries, triage):

| Usage Scenario | Tokens/Request | Requests/Day | Monthly Cost |
|---------------|---------------|-------------|-------------|
| SOAP note generation | ~2,000 in, ~1,000 out | 20 | ~$1.50 |
| Code suggestions | ~1,500 in, ~500 out | 20 | ~$0.75 |
| Lab result summarization | ~1,000 in, ~800 out | 10 | ~$0.45 |
| Lab triage scoring | ~2,000 in, ~1,000 out | 5 | ~$0.38 |
| NL lab query | ~500 in, ~300 out | 10 | ~$0.15 |
| Medication review | ~1,500 in, ~800 out | 10 | ~$0.38 |
| **Total estimated** | | **~75 req/day** | **~$3.60/month** |

Even at 10x usage (750 req/day): **~$36/month** — still cheaper than running an Ollama GPU instance.

---

## Alternative: Google Gemini 2.5 Flash-Lite (Cheapest)

If you want the absolute cheapest HIPAA-eligible option:

- **$0.10/1M input, $0.40/1M output** — 60% cheaper than Bedrock Haiku
- Sign BAA with Google Cloud
- Very fast (1-3s response)
- Good (not great) precision — may need more careful prompting for clinical tasks
- Same monthly cost estimate: **~$1.50/month** at typical usage

**Trade-off**: Slightly lower precision on complex clinical reasoning vs Claude. Fine for summarization and simple queries, may struggle with complex differential diagnosis.

---

## Alternative: Groq (Fastest, but NOT HIPAA-eligible)

If you can defer HIPAA compliance (e.g., development/demo phase):

- **$0.05-0.59/1M input** — cheapest of all options
- **400-840 tokens/sec** — 10-20x faster than any other provider
- Open-source models (Llama 3, Qwen, GPT-OSS)
- **Cannot be used with real PHI** — no BAA available

**Use case**: Development, testing, demo — switch to Bedrock before going live with patient data.

---

## Implementation Plan: Make AiService Provider-Agnostic

### Current State
Your `AiService` is hardcoded to call Ollama's API (`/api/generate`, `/api/chat`). All other services (LaboratoryAiService, DenialAiService, etc.) depend on AiService's 4 methods:
- `generate(prompt, options) → string`
- `chat(messages, options) → string`
- `generateStructured<T>(prompt, options) → T (JSON)`
- `healthCheck() → { status, model, available }`

### Proposed Change: Provider Pattern

```
AI_PROVIDER env var → selects provider
  ├── "ollama"  → OllamaProvider (current, for local dev)
  ├── "bedrock" → BedrockProvider (AWS Claude, for production)
  ├── "gemini"  → GeminiProvider (Google, cheapest)
  ├── "openai"  → OpenAiProvider (GPT-4o, if preferred)
  └── "groq"    → GroqProvider (fastest, dev only)
```

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `ai-provider.interface.ts` | **New** | Common interface all providers implement |
| `ai.providers/bedrock.provider.ts` | **New** | AWS Bedrock implementation |
| `ai.providers/gemini.provider.ts` | **New** | Google Gemini implementation |
| `ai.providers/openai.provider.ts` | **New** | OpenAI implementation |
| `ai.providers/groq.provider.ts` | **New** | Groq implementation |
| `ai.providers/ollama.provider.ts` | **New** | Refactor current Ollama code |
| `ai.service.ts` | **Modify** | Delegate to selected provider |
| `ai.module.ts` | **Modify** | Provider factory based on env var |
| `.env` / `.env.example` | **Modify** | Add `AI_PROVIDER`, API keys |

### New Environment Variables

```bash
# ── AI Provider Selection ─────────────────────────────────────────
# Options: ollama, bedrock, gemini, openai, groq
AI_PROVIDER=bedrock

# ── AWS Bedrock (recommended for HIPAA) ───────────────────────────
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
# Uses AWS IAM credentials (no separate API key needed)
# Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env

# ── Google Gemini (cheapest HIPAA option) ─────────────────────────
GOOGLE_API_KEY=your-google-api-key
GEMINI_MODEL=gemini-2.5-flash-lite

# ── OpenAI (Enterprise BAA required) ──────────────────────────────
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_ORGANIZATION_ID=org-...  # Optional

# ── Groq (NOT HIPAA-eligible — dev only) ──────────────────────────
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# ── Ollama (local, free — keep for dev) ───────────────────────────
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

### API Differences to Handle

| Feature | Ollama | AWS Bedrock | Google Gemini | OpenAI | Groq |
|---------|--------|-------------|---------------|--------|------|
| **Endpoint** | `/api/generate` | `bedrock-runtime:InvokeModel` | `generativelanguage.googleapis.com` | `api.openai.com/v1/chat/completions` | `api.groq.com/openai/v1/chat/completions` |
| **Auth** | None | AWS Sig v4 (IAM) | API key (query param) | Bearer token | Bearer token |
| **JSON Mode** | `format: 'json'` | `{"text": "{\"key\": \"value\"}"}` in response | `responseMimeType: 'application/json'` | `response_format: {type: 'json_object'}` | `response_format: {type: 'json_object'}` |
| **Response** | `data.response` | `parsed.body.content[0].text` | `candidate[0].content.parts[0].text` | `choices[0].message.content` | `choices[0].message.content` |
| **Max tokens** | `num_predict` | `max_tokens` | `maxOutputTokens` | `max_tokens` | `max_tokens` |
| **SDK** | `fetch` | `@aws-sdk/client-bedrock-runtime` | `@google/generative-ai` | `openai` npm | `openai` npm (compatible) |

### Example: AWS Bedrock Provider Implementation

```typescript
// ai.providers/bedrock.provider.ts (simplified)
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export class BedrockProvider implements AiProvider {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor(config: ConfigService) {
    this.client = new BedrockRuntimeClient({
      region: config.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: config.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.modelId = config.get('BEDROCK_MODEL_ID', 'anthropic.claude-3-haiku-20240307-v1:0');
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const response = await this.client.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    return body.content[0].text.trim();
  }

  async generateStructured<T>(prompt: string, options?: GenerateOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON.`;
    const raw = await this.generate(jsonPrompt, { ...options, temperature: 0.1 });
    // Same JSON parsing logic as current Ollama implementation
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    return JSON.parse(jsonString) as T;
  }

  async healthCheck(): Promise<{ status: string; model: string; available: boolean }> {
    try {
      await this.generate('Health check', { maxTokens: 5 });
      return { status: 'ok', model: this.modelId, available: true };
    } catch {
      return { status: 'unavailable', model: this.modelId, available: false };
    }
  }
}
```

---

## Decision Matrix

| Criteria | AWS Bedrock | Google Gemini | OpenAI | Groq |
|----------|-------------|---------------|--------|------|
| **HIPAA (BAA)** | ✅ Best (AWS BAA) | ✅ Good (Google BAA) | ⚠️ Enterprise only | ❌ No |
| **Cost** | $0.25/$1.25 (good) | $0.10/$0.40 (cheapest) | $0.15/$0.60 (cheap) | $0.05/$0.08 (cheapest) |
| **Precision** | High (Claude) | Good (Gemini) | High (GPT-4o) | Medium (Llama) |
| **Speed** | Fast (2-5s) | Very Fast (1-3s) | Fast (1-3s) | Ultra Fast (<1s) |
| **JSON mode** | ✅ | ✅ | ✅ | ✅ |
| **AWS integration** | ✅ Native | ❌ | ❌ | ❌ |
| **No extra account** | ✅ (use AWS) | ❌ (need Google) | ❌ (need OpenAI) | ❌ (need Groq) |
| **No infra to manage** | ✅ | ✅ | ✅ | ✅ |
| **Est. monthly cost** | ~$3.60 | ~$1.50 | ~$2.50 | ~$0.50 (no PHI) |

---

## Final Recommendation

### For Production (HIPAA): AWS Bedrock + Claude 3 Haiku
- You already have an AWS account
- BAA is already signed (or will be) with AWS
- No separate vendor agreement needed
- Good balance of cost, precision, and speed
- Native AWS integration (IAM, CloudWatch, VPC)

### For Development/Demo: Groq + Llama 3.1 8B
- $0.05/1M tokens — practically free
- 840 tokens/sec — instant responses
- No PHI during development, so no BAA needed
- OpenAI-compatible API (easy to swap)

### For Maximum Savings (HIPAA): Google Gemini 2.5 Flash-Lite
- $0.10/$0.40 per 1M tokens — 60% cheaper than Bedrock
- Sign BAA with Google Cloud
- Good enough for summarization and simple queries
- May need more careful prompting for complex clinical reasoning

---

## Implementation Checklist (When Ready)

- [ ] Choose provider (recommend: AWS Bedrock)
- [ ] Create `ai-provider.interface.ts`
- [ ] Create `bedrock.provider.ts` (or chosen provider)
- [ ] Refactor `ollama.provider.ts` from current code
- [ ] Update `ai.service.ts` to delegate to provider
- [ ] Update `ai.module.ts` with provider factory
- [ ] Add `AI_PROVIDER` and provider-specific env vars to `.env`
- [ ] Install AWS SDK: `npm install @aws-sdk/client-bedrock-runtime`
- [ ] Test all AI endpoints with new provider
- [ ] Remove Ollama container from production docker-compose (keep for dev)
- [ ] Update AGENTS.md with new AI provider config

---

## Whisper (Speech-to-Text) Alternative

Currently using a self-hosted Whisper container. Cloud alternatives:

| Provider | Model | Price | HIPAA | Speed |
|----------|-------|-------|-------|-------|
| **AWS Transcribe** | Medical | $0.001/min | ✅ (AWS BAA) | Real-time |
| **Google Speech-to-Text** | Medical | $0.005/min | ✅ (Google BAA) | Real-time |
| **OpenAI Whisper API** | whisper-1 | $0.006/min | ⚠️ Enterprise | Fast |
| **Self-hosted Whisper** | faster-whisper | Free | ✅ (on your server) | Depends on CPU |

**Recommendation**: Keep self-hosted Whisper for now (free, already working). If it's too slow on CPU, switch to **AWS Transcribe Medical** ($0.001/min — costs ~$0.50/month at 500 min usage).
