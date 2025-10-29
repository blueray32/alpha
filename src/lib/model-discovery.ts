/**
 * Model Discovery Service
 * Automatically discovers available AI models with fallback chain:
 * Anthropic (Sonnet → Opus → Haiku) → OpenAI
 */

export interface ModelConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  apiKey: string;
}

interface AnthropicModelsResponse {
  data: Array<{
    id: string;
    type: string;
    display_name: string;
  }>;
}

export class ModelDiscovery {
  private cachedConfig: ModelConfig | null = null;

  /**
   * Discover the best available model at runtime
   * Never logs API keys or sensitive data
   */
  async discover(): Promise<ModelConfig> {
    // Return cached if available
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    // Try Anthropic first
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const anthropicModel = await this.tryAnthropicDiscovery(anthropicKey);
      if (anthropicModel) {
        this.cachedConfig = anthropicModel;
        console.log(`✅ Discovered model: ${anthropicModel.provider}/${this.maskModel(anthropicModel.model)}`);
        return anthropicModel;
      }
    }

    // Fallback to OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const openaiModel = this.getOpenAIConfig(openaiKey);
      this.cachedConfig = openaiModel;
      console.log(`✅ Using fallback: ${openaiModel.provider}/${openaiModel.model}`);
      return openaiModel;
    }

    throw new Error('No API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
  }

  /**
   * Try to discover available Anthropic models
   */
  private async tryAnthropicDiscovery(apiKey: string): Promise<ModelConfig | null> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!response.ok) {
        console.warn('⚠️  Anthropic models API unavailable, trying fallback...');
        return null;
      }

      const data = (await response.json()) as AnthropicModelsResponse;
      const availableModels = data.data.map((m) => m.id);

      // Preference order: sonnet → opus → haiku
      const preferredModel = this.selectBestModel(availableModels);

      if (preferredModel) {
        return {
          provider: 'anthropic',
          model: preferredModel,
          apiKey,
        };
      }

      console.warn('⚠️  No preferred Anthropic models available, trying fallback...');
      return null;
    } catch (error) {
      console.warn('⚠️  Anthropic discovery failed, trying fallback...', error instanceof Error ? error.message : '');
      return null;
    }
  }

  /**
   * Select best model from available models
   * Priority: sonnet → opus → haiku
   */
  private selectBestModel(availableModels: string[]): string | null {
    // Preference patterns (order matters)
    const patterns = [
      /sonnet/i,
      /opus/i,
      /haiku/i,
    ];

    for (const pattern of patterns) {
      const match = availableModels.find((model) => pattern.test(model));
      if (match) {
        return match;
      }
    }

    // If no preferred models, return first available
    return availableModels[0] || null;
  }

  /**
   * Get OpenAI configuration from environment
   */
  private getOpenAIConfig(apiKey: string): ModelConfig {
    const model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';
    return {
      provider: 'openai',
      model,
      apiKey,
    };
  }

  /**
   * Mask model ID for logging (show first few chars only)
   */
  private maskModel(model: string): string {
    if (model.length <= 20) return model;
    return `${model.substring(0, 20)}...`;
  }

  /**
   * Clear cached configuration (for testing)
   */
  clearCache(): void {
    this.cachedConfig = null;
  }
}

// Singleton instance
export const modelDiscovery = new ModelDiscovery();
