export interface AIProvider {
  name: 'openai' | 'anthropic';
  chatCompletion(messages: Array<{ role: string; content: string }>, options?: { model?: string; maxTokens?: number; temperature?: number }): Promise<{ content: string; promptTokens: number; completionTokens: number; totalTokens: number }>;
}

export interface AIConfig {
  enabled: boolean;
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  enabledFeatures: string[];
}
