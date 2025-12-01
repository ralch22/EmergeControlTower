import { generateWithClaude } from '../integrations/anthropic';
import { openRouterClient } from '../integrations/openrouter';
import { healthMonitor } from './provider-health-monitor';

export interface TextGenerationResult {
  success: boolean;
  content?: string;
  provider?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
}

export interface TextGenerationOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  preferFree?: boolean;
  fallbackChain?: 'default' | 'free_only' | 'reasoning' | 'bulk_content';
}

function isAnthropicConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY);
}

const TEXT_PROVIDERS = [
  {
    name: 'anthropic',
    priority: 90,
    isFree: false,
    isConfigured: () => isAnthropicConfigured(),
    generate: async (prompt: string, options: TextGenerationOptions) => {
      const result = await generateWithClaude(
        options.systemPrompt || 'You are a helpful assistant.',
        prompt,
        {
          maxTokens: options.maxTokens || 4000,
          temperature: options.temperature || 0.7,
        }
      );
      return { success: true, content: result, provider: 'anthropic' };
    },
  },
  {
    name: 'openrouter_deepseek_r1',
    priority: 85,
    isFree: true,
    isConfigured: () => openRouterClient.isAvailable(),
    generate: async (prompt: string, options: TextGenerationOptions) => {
      const result = await openRouterClient.generateText({
        modelKey: 'deepseek-r1-free',
        messages: [
          ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        maxTokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
      });
      return { ...result, provider: 'openrouter_deepseek_r1' };
    },
  },
  {
    name: 'openrouter_llama4_maverick',
    priority: 82,
    isFree: true,
    isConfigured: () => openRouterClient.isAvailable(),
    generate: async (prompt: string, options: TextGenerationOptions) => {
      const result = await openRouterClient.generateText({
        modelKey: 'llama-4-maverick-free',
        messages: [
          ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        maxTokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
      });
      return { ...result, provider: 'openrouter_llama4_maverick' };
    },
  },
  {
    name: 'openrouter_mistral_small',
    priority: 78,
    isFree: true,
    isConfigured: () => openRouterClient.isAvailable(),
    generate: async (prompt: string, options: TextGenerationOptions) => {
      const result = await openRouterClient.generateText({
        modelKey: 'mistral-small-free',
        messages: [
          ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        maxTokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
      });
      return { ...result, provider: 'openrouter_mistral_small' };
    },
  },
  {
    name: 'openrouter_qwen3',
    priority: 75,
    isFree: false,
    isConfigured: () => openRouterClient.isAvailable(),
    generate: async (prompt: string, options: TextGenerationOptions) => {
      const result = await openRouterClient.generateText({
        modelKey: 'qwen3-235b',
        messages: [
          ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        maxTokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
      });
      return { ...result, provider: 'openrouter_qwen3' };
    },
  },
  {
    name: 'openrouter_deepseek_v3',
    priority: 72,
    isFree: false,
    isConfigured: () => openRouterClient.isAvailable(),
    generate: async (prompt: string, options: TextGenerationOptions) => {
      const result = await openRouterClient.generateText({
        modelKey: 'deepseek-v3',
        messages: [
          ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        maxTokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
      });
      return { ...result, provider: 'openrouter_deepseek_v3' };
    },
  },
];

const FALLBACK_CHAINS = {
  default: ['anthropic', 'openrouter_deepseek_r1', 'openrouter_llama4_maverick', 'openrouter_mistral_small'],
  free_only: ['openrouter_deepseek_r1', 'openrouter_llama4_maverick', 'openrouter_mistral_small'],
  reasoning: ['anthropic', 'openrouter_deepseek_r1', 'openrouter_qwen3'],
  bulk_content: ['openrouter_deepseek_v3', 'openrouter_mistral_small', 'openrouter_llama4_maverick', 'anthropic'],
};

export async function generateTextWithFallback(
  prompt: string,
  options: TextGenerationOptions = {}
): Promise<TextGenerationResult> {
  const { fallbackChain = 'default', preferFree = false } = options;
  
  const chainProviders = FALLBACK_CHAINS[fallbackChain];
  let orderedProviders = TEXT_PROVIDERS.filter(p => chainProviders.includes(p.name));
  
  if (preferFree) {
    orderedProviders = orderedProviders.sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return b.priority - a.priority;
    });
  } else {
    orderedProviders = orderedProviders.sort((a, b) => {
      const aIdx = chainProviders.indexOf(a.name);
      const bIdx = chainProviders.indexOf(b.name);
      return aIdx - bIdx;
    });
  }
  
  console.log(`[TextGeneration] Using fallback chain: ${orderedProviders.map(p => p.name).join(' → ')}`);
  
  let lastError = '';
  
  for (const provider of orderedProviders) {
    // CRITICAL: Check quarantine status BEFORE attempting (self-healing)
    if (healthMonitor.isProviderQuarantined(provider.name)) {
      console.log(`[TextGeneration] Skipping ${provider.name}: currently quarantined`);
      continue;
    }

    if (!provider.isConfigured()) {
      console.log(`[TextGeneration] ${provider.name} not configured, skipping...`);
      continue;
    }
    
    const startTime = Date.now();
    const requestId = `text_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    try {
      console.log(`[TextGeneration] Attempting with ${provider.name}...`);
      
      const result = await provider.generate(prompt, options);
      
      if (result.success && result.content) {
        const latency = Date.now() - startTime;
        const cost = 'usage' in result ? result.usage?.totalCost || 0 : 0;
        
        healthMonitor.recordRequest(
          provider.name,
          'text',
          requestId,
          { success: true, latencyMs: latency, costIncurred: cost }
        );
        
        console.log(`[TextGeneration] Success with ${provider.name} in ${latency}ms`);
        return result;
      }
      
      lastError = 'error' in result ? (result.error || 'Unknown error') : 'Unknown error';
      console.log(`[TextGeneration] ${provider.name} returned empty result, trying next...`);
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      lastError = error.message || 'Unknown error';
      
      const isRateLimit = error.status === 429 || lastError.includes('rate limit') || lastError.includes('quota');
      
      // Check for hard failures that warrant quarantine
      const hardFailurePatterns = [
        'not available', 'access denied', 'quota exceeded', 
        'model not found', 'forbidden', 'unauthorized',
        'not enabled', 'billing', 'subscription', 'invalid_api_key'
      ];
      const isHardFailure = hardFailurePatterns.some(pattern => 
        lastError.toLowerCase().includes(pattern)
      );
      
      if (isHardFailure) {
        console.log(`[TextGeneration] HARD FAILURE detected for ${provider.name}: ${lastError}`);
        await healthMonitor.quarantineProvider(provider.name, lastError);
      }
      
      healthMonitor.recordRequest(
        provider.name,
        'text',
        requestId,
        { 
          success: false, 
          latencyMs: latency, 
          errorMessage: lastError,
          errorCode: isRateLimit ? 'RATE_LIMIT' : (isHardFailure ? 'HARD_FAILURE' : 'PROVIDER_ERROR'),
        }
      );
      
      console.log(`[TextGeneration] ${provider.name} failed: ${lastError}`);
    }
  }
  
  return {
    success: false,
    error: `All text providers failed. Last error: ${lastError}`,
  };
}

export async function generateVideoScriptWithFallback(
  systemPrompt: string,
  userPrompt: string,
  options: Omit<TextGenerationOptions, 'systemPrompt'> = {}
): Promise<TextGenerationResult> {
  return generateTextWithFallback(userPrompt, {
    ...options,
    systemPrompt,
    maxTokens: options.maxTokens || 4000,
    temperature: options.temperature || 0.7,
    fallbackChain: 'default',
  });
}

export async function generateBlogWithFallback(
  topic: string,
  options: TextGenerationOptions = {}
): Promise<TextGenerationResult> {
  const systemPrompt = `You are an expert content writer who creates engaging, well-researched blog posts. 
Write in a professional yet accessible style, using clear headings, bullet points where appropriate, 
and compelling narratives.`;

  const prompt = `Write a comprehensive blog post about: ${topic}

Requirements:
- 1500-2000 words
- Engaging introduction with a hook
- Clear structure with H2 and H3 headings
- Actionable insights and examples
- Strong conclusion with call-to-action
- SEO-optimized with natural keyword usage

Output the blog post in markdown format.`;

  return generateTextWithFallback(prompt, {
    ...options,
    systemPrompt,
    maxTokens: 4000,
    fallbackChain: 'bulk_content',
  });
}

export async function generateSocialContentWithFallback(
  topic: string,
  platform: 'linkedin' | 'twitter' | 'instagram',
  options: TextGenerationOptions = {}
): Promise<TextGenerationResult> {
  const platformGuidelines = {
    linkedin: 'Professional tone, 1300 characters max, use line breaks for readability, include relevant hashtags',
    twitter: 'Concise and punchy, 280 characters max, engaging hook, strategic hashtags',
    instagram: 'Casual and engaging, emoji usage encouraged, 2200 characters max, call-to-action',
  };

  const systemPrompt = `You are a social media expert specializing in ${platform} content creation.`;

  const prompt = `Create a ${platform} post about: ${topic}

Platform guidelines: ${platformGuidelines[platform]}

Output just the post content, ready to publish.`;

  return generateTextWithFallback(prompt, {
    ...options,
    systemPrompt,
    maxTokens: 1000,
    fallbackChain: 'default',
  });
}

export { TEXT_PROVIDERS, FALLBACK_CHAINS };
