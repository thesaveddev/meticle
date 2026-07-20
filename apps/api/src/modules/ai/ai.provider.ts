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

export function getProvider(config: { provider: 'openai' | 'anthropic'; apiKey: string }): AIProvider {
  if (config.provider === 'anthropic') {
    return new AnthropicProvider(config.apiKey);
  }
  return new OpenAIProvider(config.apiKey);
}
