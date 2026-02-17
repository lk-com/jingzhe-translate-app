export interface Provider {
  id: string
  name: string
  nameEn: string
  baseURL: string
  models: { id: string; name: string }[]
}

export const AI_PROVIDERS: Provider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    nameEn: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    nameEn: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
    ],
  },
  {
    id: 'doubao',
    name: '豆包',
    nameEn: 'Doubao',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      { id: 'doubao-pro-32k', name: 'Doubao Pro 32K' },
      { id: 'doubao-lite-32k', name: 'Doubao Lite 32K' },
    ],
  },
  {
    id: 'qwen',
    name: '通义千问',
    nameEn: 'Qwen',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo' },
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-max', name: 'Qwen Max' },
      { id: 'qwen-coder-turbo', name: 'Qwen Coder Turbo' },
    ],
  },
  {
    id: 'custom',
    name: '自定义',
    nameEn: 'Custom',
    baseURL: '',
    models: [],
  },
]
