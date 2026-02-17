import OpenAI from 'openai'

export interface AIConfig {
  provider: string
  baseURL: string
  apiKey: string
  model: string
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIProvider {
  chat(messages: Message[]): Promise<string>
}

// 预设厂商 baseURL 映射
export const PROVIDER_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  deepseek: 'https://api.deepseek.com/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
}

// 预设厂商模型列表
export const PROVIDER_MODELS: Record<string, { id: string; name: string }[]> = {
  openrouter: [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder' },
  ],
  doubao: [
    { id: 'doubao-pro-32k', name: 'Doubao Pro 32K' },
    { id: 'doubao-lite-32k', name: 'Doubao Lite 32K' },
  ],
  qwen: [
    { id: 'qwen-turbo', name: 'Qwen Turbo' },
    { id: 'qwen-plus', name: 'Qwen Plus' },
    { id: 'qwen-max', name: 'Qwen Max' },
    { id: 'qwen-coder-turbo', name: 'Qwen Coder Turbo' },
  ],
}

export function createAIProvider(config: AIConfig): AIProvider {
  const openai = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    defaultHeaders: config.provider === 'openrouter' ? {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'GitHub Global',
    } : undefined,
  })

  return {
    async chat(messages: Message[]): Promise<string> {
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: messages as any,
        temperature: 0.3,
        max_tokens: 4096,
      })
      return response.choices[0].message.content || ''
    }
  }
}
