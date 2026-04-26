'use strict';

const axios = require('axios');

// ─── Base provider class ──────────────────────────────────────────────────────
class Provider {
  constructor(id, model, apiKeyEnv, baseUrl) {
    this.id      = id;
    this.model   = model;
    this._keyEnv = apiKeyEnv;
    this._base   = baseUrl;
  }
  get apiKey() { return process.env[this._keyEnv] || ''; }
  get available() { return Boolean(this.apiKey); }

  /** @returns {Promise<string>} */
  async chat(_messages, _opts) {
    throw new Error('chat() not implemented');
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────
class OpenAIProvider extends Provider {
  constructor() {
    super('openai', process.env.OPENAI_MODEL || 'gpt-4o-mini', 'OPENAI_API_KEY', 'https://api.openai.com');
  }
  async chat(messages, { max_tokens = 1024, temperature = 0.7 } = {}) {
    const res = await axios.post(`${this._base}/v1/chat/completions`, {
      model: this.model, messages, max_tokens, temperature,
    }, { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 30_000 });
    return res.data.choices[0].message.content;
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────
class AnthropicProvider extends Provider {
  constructor() {
    super('anthropic', process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307', 'ANTHROPIC_API_KEY', 'https://api.anthropic.com');
  }
  async chat(messages, { max_tokens = 1024, temperature = 0.7 } = {}) {
    // Separate system message
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const msgs   = messages.filter((m) => m.role !== 'system');
    const body   = { model: this.model, max_tokens, temperature, messages: msgs };
    if (system) body.system = system;
    const res = await axios.post(`${this._base}/v1/messages`, body, {
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 30_000,
    });
    return res.data.content[0].text;
  }
}

// ─── Google Gemini ────────────────────────────────────────────────────────────
class GeminiProvider extends Provider {
  constructor() {
    super('gemini', process.env.GEMINI_MODEL || 'gemini-1.5-flash', 'GEMINI_API_KEY', 'https://generativelanguage.googleapis.com');
  }
  async chat(messages, { max_tokens = 1024, temperature = 0.7 } = {}) {
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const systemInstruction = messages.find((m) => m.role === 'system')?.content;
    const body = {
      contents,
      generationConfig: { maxOutputTokens: max_tokens, temperature },
    };
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
    const res = await axios.post(
      `${this._base}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      body, { timeout: 30_000 }
    );
    return res.data.candidates[0].content.parts[0].text;
  }
}

// ─── Groq ─────────────────────────────────────────────────────────────────────
class GroqProvider extends Provider {
  constructor() {
    super('groq', process.env.GROQ_MODEL || 'llama-3.1-8b-instant', 'GROQ_API_KEY', 'https://api.groq.com');
  }
  async chat(messages, { max_tokens = 1024, temperature = 0.7 } = {}) {
    const res = await axios.post(`${this._base}/openai/v1/chat/completions`, {
      model: this.model, messages, max_tokens, temperature,
    }, { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 20_000 });
    return res.data.choices[0].message.content;
  }
}

// ─── Mistral ──────────────────────────────────────────────────────────────────
class MistralProvider extends Provider {
  constructor() {
    super('mistral', process.env.MISTRAL_MODEL || 'mistral-small-latest', 'MISTRAL_API_KEY', 'https://api.mistral.ai');
  }
  async chat(messages, { max_tokens = 1024, temperature = 0.7 } = {}) {
    const res = await axios.post(`${this._base}/v1/chat/completions`, {
      model: this.model, messages, max_tokens, temperature,
    }, { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 25_000 });
    return res.data.choices[0].message.content;
  }
}

// ─── Cohere ───────────────────────────────────────────────────────────────────
class CohereProvider extends Provider {
  constructor() {
    super('cohere', process.env.COHERE_MODEL || 'command-r', 'COHERE_API_KEY', 'https://api.cohere.com');
  }
  async chat(messages, { max_tokens = 1024, temperature = 0.7 } = {}) {
    const systemMsg  = messages.find((m) => m.role === 'system')?.content || '';
    const chatHistory = messages
      .filter((m) => m.role !== 'system')
      .slice(0, -1)
      .map((m) => ({ role: m.role === 'assistant' ? 'CHATBOT' : 'USER', message: m.content }));
    const lastUser = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
    const res = await axios.post(`${this._base}/v1/chat`, {
      model: this.model,
      message: lastUser,
      chat_history: chatHistory,
      preamble: systemMsg,
      max_tokens,
      temperature,
    }, { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 25_000 });
    return res.data.text;
  }
}

// ─── Cloudflare AI (free tier with CF token) ──────────────────────────────────
class CloudflareProvider extends Provider {
  constructor() {
    super('cloudflare', '@cf/meta/llama-3.1-8b-instruct', 'CF_AI_TOKEN', 'https://api.cloudflare.com');
  }
  get available() { return Boolean(this.apiKey) && Boolean(process.env.CF_ACCOUNT_ID); }
  async chat(messages, { max_tokens = 512, temperature = 0.7 } = {}) {
    const accountId = process.env.CF_ACCOUNT_ID;
    const res = await axios.post(
      `${this._base}/client/v4/accounts/${accountId}/ai/run/${this.model}`,
      { messages, max_tokens },
      { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 20_000 }
    );
    return res.data.result.response;
  }
}

// ─── OpenRouter (free models) ─────────────────────────────────────────────────
class OpenRouterProvider extends Provider {
  constructor() {
    super('openrouter', process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free', 'OPENROUTER_API_KEY', 'https://openrouter.ai');
  }
  async chat(messages, { max_tokens = 1024, temperature = 0.7 } = {}) {
    const res = await axios.post(`${this._base}/api/v1/chat/completions`, {
      model: this.model, messages, max_tokens, temperature,
    }, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://olife.app',
        'X-Title': 'O LIFE Supreme Intelligence',
      },
      timeout: 30_000,
    });
    return res.data.choices[0].message.content;
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────
const ALL_PROVIDERS = [
  new OpenAIProvider(),
  new AnthropicProvider(),
  new GeminiProvider(),
  new GroqProvider(),
  new MistralProvider(),
  new CohereProvider(),
  new CloudflareProvider(),
  new OpenRouterProvider(),
];

module.exports = {
  list:   () => ALL_PROVIDERS.filter((p) => p.available).map((p) => p.id),
  all:    () => ALL_PROVIDERS.filter((p) => p.available),
  get:    (id) => ALL_PROVIDERS.find((p) => p.id === id && p.available) || null,
  subset: (ids) => ALL_PROVIDERS.filter((p) => ids.includes(p.id) && p.available),
};
