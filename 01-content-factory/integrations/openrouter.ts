import OpenAI from "openai";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface OpenRouterModel {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  inputCost: number;
  outputCost: number;
  isFree: boolean;
  capabilities: ('text' | 'vision' | 'reasoning')[];
}

export const OPENROUTER_MODELS: Record<string, OpenRouterModel> = {
  'deepseek-r1-free': {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (Free)',
    provider: 'deepseek',
    contextLength: 164000,
    inputCost: 0,
    outputCost: 0,
    isFree: true,
    capabilities: ['text', 'reasoning'],
  },
  'deepseek-v3': {
    id: 'deepseek/deepseek-chat-v3-0324',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    contextLength: 128000,
    inputCost: 0.14,
    outputCost: 0.28,
    isFree: false,
    capabilities: ['text'],
  },
  'llama-4-maverick-free': {
    id: 'meta-llama/llama-4-maverick:free',
    name: 'Llama 4 Maverick (Free)',
    provider: 'meta',
    contextLength: 128000,
    inputCost: 0,
    outputCost: 0,
    isFree: true,
    capabilities: ['text', 'vision'],
  },
  'llama-4-scout-free': {
    id: 'meta-llama/llama-4-scout:free',
    name: 'Llama 4 Scout (Free)',
    provider: 'meta',
    contextLength: 128000,
    inputCost: 0,
    outputCost: 0,
    isFree: true,
    capabilities: ['text', 'vision'],
  },
  'qwen3-235b': {
    id: 'qwen/qwen3-235b-a22b-instruct',
    name: 'Qwen 3 235B',
    provider: 'alibaba',
    contextLength: 131000,
    inputCost: 0.24,
    outputCost: 1.20,
    isFree: false,
    capabilities: ['text', 'reasoning'],
  },
  'mistral-small-free': {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    name: 'Mistral Small 3.1 (Free)',
    provider: 'mistral',
    contextLength: 96000,
    inputCost: 0,
    outputCost: 0,
    isFree: true,
    capabilities: ['text'],
  },
  'gemini-2.5-pro-free': {
    id: 'google/gemini-2.5-pro-exp-03-25:free',
    name: 'Gemini 2.5 Pro Exp (Free)',
    provider: 'google',
    contextLength: 1000000,
    inputCost: 0,
    outputCost: 0,
    isFree: true,
    capabilities: ['text', 'vision', 'reasoning'],
  },
  'deepseek-r1-distill-qwen-14b': {
    id: 'deepseek/deepseek-r1-distill-qwen-14b',
    name: 'DeepSeek R1 Distill Qwen 14B',
    provider: 'deepseek',
    contextLength: 131000,
    inputCost: 0.12,
    outputCost: 0.12,
    isFree: false,
    capabilities: ['text', 'reasoning'],
  },
};

class OpenRouterClient {
  private client: OpenAI | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.isConfigured = !!OPENROUTER_API_KEY;
    if (this.isConfigured) {
      this.client = new OpenAI({
        baseURL: OPENROUTER_BASE_URL,
        apiKey: OPENROUTER_API_KEY,
        defaultHeaders: {
          "HTTP-Referer": "https://emerge-control-tower.replit.app",
          "X-Title": "Emerge Digital Control Tower",
        },
      });
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  async testConnection(): Promise<{ success: boolean; message: string; models?: string[] }> {
    if (!this.client) {
      return { success: false, message: "OpenRouter API key not configured" };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: OPENROUTER_MODELS['mistral-small-free'].id,
        messages: [{ role: "user", content: "Say 'connected' in one word" }],
        max_tokens: 10,
      });

      return {
        success: true,
        message: `Connected to OpenRouter. Response: ${response.choices[0]?.message?.content}`,
        models: Object.keys(OPENROUTER_MODELS),
      };
    } catch (error: any) {
      return {
        success: false,
        message: `OpenRouter connection failed: ${error.message}`,
      };
    }
  }

  async generateText(options: {
    modelKey: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }): Promise<{
    success: boolean;
    content?: string;
    usage?: { inputTokens: number; outputTokens: number; totalCost: number };
    model?: string;
    error?: string;
  }> {
    if (!this.client) {
      return { success: false, error: "OpenRouter API key not configured" };
    }

    const modelConfig = OPENROUTER_MODELS[options.modelKey];
    if (!modelConfig) {
      return { success: false, error: `Unknown model: ${options.modelKey}` };
    }

    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: modelConfig.id,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: false,
      });

      const content = response.choices[0]?.message?.content || '';
      const usage = response.usage;

      const inputTokens = usage?.prompt_tokens || 0;
      const outputTokens = usage?.completion_tokens || 0;
      const totalCost = modelConfig.isFree 
        ? 0 
        : (inputTokens * modelConfig.inputCost + outputTokens * modelConfig.outputCost) / 1000000;

      console.log(`[OpenRouter] ${modelConfig.name} completed in ${Date.now() - startTime}ms, tokens: ${inputTokens}/${outputTokens}, cost: $${totalCost.toFixed(6)}`);

      return {
        success: true,
        content,
        usage: { inputTokens, outputTokens, totalCost },
        model: modelConfig.name,
      };
    } catch (error: any) {
      console.error(`[OpenRouter] Error with ${modelConfig.name}:`, error.message);
      
      if (error.status === 429) {
        return { success: false, error: `Rate limited on ${modelConfig.name}` };
      }
      
      return { success: false, error: error.message };
    }
  }

  async generateWithFallback(options: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    preferFree?: boolean;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    success: boolean;
    content?: string;
    usage?: { inputTokens: number; outputTokens: number; totalCost: number };
    model?: string;
    error?: string;
  }> {
    const freeModels = ['deepseek-r1-free', 'llama-4-maverick-free', 'mistral-small-free', 'gemini-2.5-pro-free'];
    const paidModels = ['deepseek-v3', 'qwen3-235b', 'deepseek-r1-distill-qwen-14b'];
    
    const modelOrder = options.preferFree !== false 
      ? [...freeModels, ...paidModels]
      : [...paidModels, ...freeModels];

    for (const modelKey of modelOrder) {
      console.log(`[OpenRouter] Trying ${modelKey}...`);
      
      const result = await this.generateText({
        modelKey,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });

      if (result.success) {
        return result;
      }

      console.log(`[OpenRouter] ${modelKey} failed: ${result.error}`);
    }

    return { success: false, error: "All OpenRouter models failed" };
  }

  async generateBlogContent(topic: string, keywords: string[]): Promise<{
    success: boolean;
    content?: string;
    model?: string;
    error?: string;
  }> {
    const systemPrompt = `You are an expert content writer. Write engaging, well-researched blog posts that are SEO-optimized and provide genuine value to readers. Structure your posts with clear headings, subheadings, and actionable insights.`;

    const userPrompt = `Write a comprehensive blog post about: "${topic}"

Target keywords to naturally include: ${keywords.join(', ')}

Requirements:
- Minimum 1500 words
- Include an engaging introduction with a hook
- Use H2 and H3 headings for structure
- Include practical examples and actionable tips
- Add a compelling conclusion with a call-to-action
- Write in a conversational yet authoritative tone`;

    return this.generateWithFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      preferFree: true,
      temperature: 0.7,
      maxTokens: 4096,
    });
  }

  async generateSocialContent(topic: string, platform: 'linkedin' | 'twitter' | 'instagram'): Promise<{
    success: boolean;
    content?: string;
    model?: string;
    error?: string;
  }> {
    const platformConfig = {
      linkedin: {
        maxLength: 3000,
        style: 'professional, thought-leadership focused, use line breaks for readability',
      },
      twitter: {
        maxLength: 280,
        style: 'concise, punchy, use hashtags sparingly',
      },
      instagram: {
        maxLength: 2200,
        style: 'engaging, use emojis appropriately, include hashtags at the end',
      },
    };

    const config = platformConfig[platform];

    const systemPrompt = `You are a social media expert specializing in ${platform} content. Create posts that drive engagement and provide value.`;

    const userPrompt = `Create a ${platform} post about: "${topic}"

Style: ${config.style}
Max length: ${config.maxLength} characters

Make it compelling and shareable.`;

    return this.generateWithFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      preferFree: true,
      temperature: 0.8,
      maxTokens: 1024,
    });
  }

  async analyzeContent(content: string, analysisType: 'seo' | 'readability' | 'sentiment'): Promise<{
    success: boolean;
    analysis?: Record<string, any>;
    model?: string;
    error?: string;
  }> {
    const analysisPrompts = {
      seo: `Analyze this content for SEO optimization. Return a JSON object with:
- score (1-100)
- keywordDensity
- recommendations (array of strings)
- missingElements (array of strings)`,
      readability: `Analyze this content for readability. Return a JSON object with:
- fleschScore (number)
- gradeLevel (string)
- avgSentenceLength (number)
- recommendations (array of strings)`,
      sentiment: `Analyze the sentiment of this content. Return a JSON object with:
- overall (positive/negative/neutral)
- confidence (0-1)
- emotionalTone (string)
- keyPhrases (array of strings)`,
    };

    const result = await this.generateWithFallback({
      messages: [
        { role: 'system', content: 'You are a content analysis expert. Always respond with valid JSON only.' },
        { role: 'user', content: `${analysisPrompts[analysisType]}\n\nContent to analyze:\n${content}` },
      ],
      preferFree: true,
      temperature: 0.3,
      maxTokens: 1024,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    try {
      const jsonMatch = result.content?.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      
      return {
        success: true,
        analysis,
        model: result.model,
      };
    } catch (parseError) {
      return {
        success: true,
        analysis: { raw: result.content },
        model: result.model,
      };
    }
  }

  getAvailableModels(): OpenRouterModel[] {
    return Object.values(OPENROUTER_MODELS);
  }

  getFreeModels(): OpenRouterModel[] {
    return Object.values(OPENROUTER_MODELS).filter(m => m.isFree);
  }
}

export const openRouterClient = new OpenRouterClient();
