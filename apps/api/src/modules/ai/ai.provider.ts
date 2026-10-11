import { AIProvider } from './ai.types';

const REQUEST_TIMEOUT = 30_000;

const MODELS_USE_MAX_COMPLETION_TOKENS = ['o1', 'o3', 'gpt-5', 'gpt-4.1'];

function usesMaxCompletionTokens(model: string): boolean {
  return MODELS_USE_MAX_COMPLETION_TOKENS.some(prefix => model.startsWith(prefix));
}

export class OpenAIProvider implements AIProvider {
  name = 'openai' as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; maxTokens?: number; temperature?: number }
  ) {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: this.apiKey, timeout: REQUEST_TIMEOUT });
    const model = options?.model || 'gpt-4o-mini';
    const maxTokens = options?.maxTokens || 4096;

    const body: Record<string, any> = {
      model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.3,
      // Opt out of OpenAI's abuse-monitoring retention. Without this, the API
      // defaults to storing request and response payloads for up to 30 days for
      // their own safety review, which is a second copy of pseudonymous health
      // data held by a US company for a purpose we never agreed with the care
      // provider. It is set per request rather than at account level because
      // account-level configuration is invisible from the repo, and a control
      // nobody can see in the code is a control nobody can verify.
      store: false,
    };
    if (usesMaxCompletionTokens(model)) {
      body.max_completion_tokens = maxTokens;
    } else {
      body.max_tokens = maxTokens;
    }

    const res = await openai.chat.completions.create(body as any);

    return {
      content: res.choices[0]?.message?.content || '',
      promptTokens: res.usage?.prompt_tokens || 0,
      completionTokens: res.usage?.completion_tokens || 0,
      totalTokens: res.usage?.total_tokens || 0,
    };
  }

  /**
   * Text-to-speech for Mica's voice replies.
   *
   * Returns raw MP3 bytes rather than a URL so the client can pipe them
   * through Web Audio — that is what lets the orb react to the literal audio
   * amplitude instead of a synthetic envelope. Anthropic has no TTS API, so
   * this only exists on OpenAIProvider and callers must check before use.
   */
  async speech(
    text: string,
    options?: { voice?: string; model?: string; speed?: number }
  ): Promise<{ audio: Buffer; mime: string }> {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: this.apiKey, timeout: REQUEST_TIMEOUT });
    const res = await openai.audio.speech.create({
      model: options?.model || 'gpt-4o-mini-tts',
      voice: (options?.voice || 'coral') as any,
      input: text,
      response_format: 'mp3',
      ...(options?.speed ? { speed: options.speed } : {}),
    });
    const audio = Buffer.from(await res.arrayBuffer());
    return { audio, mime: res.headers?.get('content-type') || 'audio/mpeg' };
  }

  /**
   * One step of a tool-calling loop for Mica's question answering.
   *
   * Returns either the model's final prose or the tool calls it wants executed
   * — the caller runs them and calls again with the results appended. The loop
   * itself lives in the controller so the number of round trips, the org's
   * budget and the audit trail stay under our control, not the SDK's.
   */
  async chatWithTools(
    messages: Array<{ role: string; content: string } | { role: string; tool_calls?: unknown[]; name?: string; tool_call_id?: string; content: string | null }>,
    options?: { tools?: Array<Record<string, unknown>>; model?: string; maxTokens?: number }
  ) {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: this.apiKey, timeout: REQUEST_TIMEOUT });
    const body: Record<string, any> = {
      model: options?.model || 'gpt-4o-mini',
      messages: messages as any,
      temperature: 0.2,
      store: false,
    };
    if (options?.tools?.length) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }
    const res = await openai.chat.completions.create(body as any);
    const msg = res.choices[0]?.message as any;
    return {
      content: typeof msg?.content === 'string' ? msg.content : null,
      toolCalls: (msg?.tool_calls || []).map((tc: any) => ({
        id: tc.id as string,
        name: tc.function?.name as string,
        args: tc.function?.arguments as string,
      })),
      promptTokens: res.usage?.prompt_tokens || 0,
      completionTokens: res.usage?.completion_tokens || 0,
      totalTokens: res.usage?.total_tokens || 0,
    };
  }
}

export class AnthropicProvider implements AIProvider {
  name = 'anthropic' as const;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; maxTokens?: number; temperature?: number }
  ) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
      maxRetries: 0,
    });
    const model = options?.model || 'claude-sonnet-4-20250514';

    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);

    try {
      const res = await anthropic.messages.create(
        {
          model,
          max_tokens: options?.maxTokens || 4096,
          temperature: options?.temperature ?? 0.3,
          system: systemMessage,
          messages: userMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        },
        { signal: abortController.signal }
      );

      const content = res.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('\n');

      return {
        content,
        promptTokens: res.usage?.input_tokens || 0,
        completionTokens: res.usage?.output_tokens || 0,
        totalTokens: (res.usage?.input_tokens || 0) + (res.usage?.output_tokens || 0),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export type ProcessorId = 'openai' | 'anthropic';

/**
 * Processors this deployment is permitted to send care records to.
 *
 * `store: false` already stops OpenAI retaining payloads for its own abuse
 * monitoring, and Anthropic does not train on API data — but both of those are
 * properties of a processor's behaviour, observed from documentation, and
 * nothing in the codebase asserted them. If a future change added a third
 * provider, or pointed `fallbackProvider` at something new, the only thing
 * standing between a UK care record and an unvetted processor would have been
 * someone remembering to check. The allowlist makes that a build outcome.
 *
 * Defaults to the two processors this codebase actually implements. Setting it
 * to an empty or unknown value is a denial, not a fallback: an allowlist whose
 * default was "everything not explicitly forbidden" would approve a typo.
 */
export function approvedProcessors(): Set<string> {
  const configured = process.env.AI_APPROVED_PROCESSORS;
  if (configured === undefined) return new Set<ProcessorId>(['openai', 'anthropic']);
  return new Set(
    configured
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * The gate on crossing the boundary with special-category data.
 *
 * Sending pseudonymised health records to a US processor is a restricted
 * transfer under UK GDPR, and it is only lawful with a documented mechanism —
 * an Article 28 processor agreement plus IDTA or adequacy. That is a legal act,
 * not a code act, and it is tracked as T0-17b because nobody has done it yet.
 *
 * A tracked item is a promise, and promises do not stop a deploy. So the code
 * refuses in production until the acknowledgement is set, which turns the
 * outstanding legal work into a thing a deployment cannot accidentally walk
 * past. This is deliberately fail-closed: the alternative is that adding
 * `AI_TRANSFER_BASIS_ACKNOWLEDGED=false` to a config file is the only way to
 * *cause* a breach, which is the right direction for that variable to point.
 *
 * Acknowledging it means the legal work is done, and must not be set to unblock
 * a launch. Development, test and CI are exempt — a local run must not need a
 * signed DPA to execute a unit test.
 */
export function assertApprovedProcessor(provider: string): void {
  const allowed = approvedProcessors();
  if (!allowed.has(provider.toLowerCase())) {
    throw new Error(
      `AI processor "${provider}" is not in AI_APPROVED_PROCESSORS (currently: ${[...allowed].join(', ') || 'none'}). ` +
        `Every processor that receives care records needs a signed Article 28 agreement and a transfer mechanism on file before it can be enabled.`,
    );
  }
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.AI_TRANSFER_BASIS_ACKNOWLEDGED !== 'true') {
    throw new Error(
      `Refusing to send care records to ${provider}: AI_TRANSFER_BASIS_ACKNOWLEDGED is not "true". ` +
        `Pseudonymised health data is still special-category data, so a restricted transfer needs a signed ` +
        `Article 28 processor agreement and a lawful transfer mechanism (IDTA or adequacy) before production ` +
        `traffic. See T0-17b in docs/GO_LIVE_READINESS.md. Set it to "true" only when that work is complete.`,
    );
  }
}

/**
 * The one place a provider is constructed, so this is the one place a processor
 * can be approved. All twelve call sites — request handlers, the fallback path
 * and the background consumer — come through here.
 */
export function getProvider(config: { provider: ProcessorId; apiKey: string }): AIProvider {
  assertApprovedProcessor(config.provider);
  if (config.provider === 'anthropic') {
    return new AnthropicProvider(config.apiKey);
  }
  return new OpenAIProvider(config.apiKey);
}

/**
 * Text-to-speech, routed like getProvider: the factory is the only place a
 * speech-capable provider is built, so the processor allowlist holds for TTS
 * too and call sites cannot reach the class directly.
 *
 * TTS is an OpenAI-only capability — Anthropic has no speech API — so this
 * tries the primary provider and then a configured OpenAI fallback, returning
 * null when the org has no OpenAI key at all (the caller turns that into a
 * clear "configure an OpenAI provider" error rather than a 500).
 */
export async function synthesizeSpeech(
  config: {
    provider: ProcessorId;
    apiKey: string;
    fallbackProvider?: ProcessorId;
    fallbackApiKey?: string;
  },
  text: string,
  options?: { voice?: string },
): Promise<{ audio: Buffer; mime: string } | null> {
  if (config.provider === 'openai') {
    assertApprovedProcessor('openai');
    return new OpenAIProvider(config.apiKey).speech(text, options);
  }
  if (config.fallbackProvider === 'openai' && config.fallbackApiKey) {
    assertApprovedProcessor('openai');
    return new OpenAIProvider(config.fallbackApiKey).speech(text, options);
  }
  return null;
}
