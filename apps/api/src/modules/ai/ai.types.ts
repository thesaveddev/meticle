export interface AIProvider {
  name: 'openai' | 'anthropic';
  chatCompletion(messages: Array<{ role: string; content: string }>, options?: { model?: string; maxTokens?: number; temperature?: number }): Promise<{ content: string; promptTokens: number; completionTokens: number; totalTokens: number }>;
  /** Optional tool-calling step for Mica's question loop. OpenAI-only; callers must check before use. */
  chatWithTools?(
    messages: unknown[],
    options?: { tools?: Array<Record<string, unknown>>; model?: string; maxTokens?: number }
  ): Promise<{ content: string | null; toolCalls: Array<{ id: string; name: string; args: string }>; promptTokens: number; completionTokens: number; totalTokens: number }>;
}

export interface AIConfig {
  enabled: boolean;
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  enabledFeatures: string[];
  /** Voice Mica speaks with — gpt-4o-mini-tts voice. Default coral. */
  ttsVoice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'nova' | 'sage' | 'shimmer' | 'verse';
  /** Monthly token budget — 0 means unlimited */
  monthlyTokenBudget?: number;
  /** Monthly cost cap in GBP — 0 means unlimited */
  monthlyCostCapGBP?: number;
  /** Fallback provider when primary fails */
  fallbackProvider?: 'openai' | 'anthropic';
  /** Fallback API key */
  fallbackApiKey?: string;
  /** Fallback model */
  fallbackModel?: string;
}
