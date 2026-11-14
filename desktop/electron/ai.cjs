// The AI requests of the desktop app: one structured-output call per provider (Claude,
// ChatGPT, Gemini) with the same input (system prompt, text + base64 images, JSON schema) and
// the same result ({ ok, data } or { ok: false, error: short code }). Used by main.cjs.
const Anthropic = require('@anthropic-ai/sdk').default
const OpenAI = require('openai').default
const { GoogleGenAI, ApiError: GeminiError } = require('@google/genai')

const parse = (text, usage) => {
  try {
    return { ok: true, data: JSON.parse(text), usage }
  } catch {
    return { ok: false, error: 'bad-json', usage }
  }
}

async function runClaude(apiKey, { baseURL, model, system, content, schema, maxTokens, effort }, signal) {
  const client = new Anthropic({ apiKey, baseURL })
  try {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: maxTokens,
        // If a safety classifier declines, Anthropic's recommended fallback model answers instead.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        messages: [
          {
            role: 'user',
            content: content.map((c) => (c.type === 'image' ? { type: 'image', source: { type: 'base64', media_type: c.mime, data: c.data } } : { type: 'text', text: c.text })),
          },
        ],
        output_config: { effort, format: { type: 'json_schema', schema } },
      },
      { signal },
    )
    const msg = await stream.finalMessage()
    const usage = { input: msg.usage.input_tokens, output: msg.usage.output_tokens }
    if (msg.stop_reason === 'refusal') return { ok: false, error: 'refusal', usage }
    if (msg.stop_reason === 'max_tokens') return { ok: false, error: 'max-tokens', usage }
    return parse(msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), usage)
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return { ok: false, error: 'cancelled' }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return { ok: false, error: 'auth' }
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: 'rate-limit' }
    if (err instanceof Anthropic.NotFoundError) return { ok: false, error: 'model' }
    if (err instanceof Anthropic.APIError) return { ok: false, error: `api ${err.status ?? ''}: ${err.message}` }
    throw err
  }
}

async function runOpenAI(apiKey, { baseURL, model, system, content, schema, maxTokens, effort }, signal) {
  const client = new OpenAI({ apiKey, baseURL })
  try {
    const r = await client.responses.create(
      {
        model,
        instructions: system,
        input: [
          {
            role: 'user',
            content: content.map((c) => (c.type === 'image' ? { type: 'input_image', image_url: `data:${c.mime};base64,${c.data}`, detail: 'high' } : { type: 'input_text', text: c.text })),
          },
        ],
        text: { format: { type: 'json_schema', name: 'result', schema, strict: true } },
        reasoning: { effort },
        max_output_tokens: maxTokens,
        store: false,
      },
      { signal },
    )
    const usage = { input: r.usage?.input_tokens ?? 0, output: r.usage?.output_tokens ?? 0 }
    if (r.output?.some((o) => o.type === 'message' && o.content?.some((c) => c.type === 'refusal'))) return { ok: false, error: 'refusal', usage }
    if (r.status === 'incomplete') return { ok: false, error: r.incomplete_details?.reason === 'max_output_tokens' ? 'max-tokens' : `incomplete: ${r.incomplete_details?.reason ?? ''}`, usage }
    return parse(r.output_text, usage)
  } catch (err) {
    if (err instanceof OpenAI.APIUserAbortError) return { ok: false, error: 'cancelled' }
    if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError) return { ok: false, error: 'auth' }
    if (err instanceof OpenAI.RateLimitError) return { ok: false, error: 'rate-limit' }
    if (err instanceof OpenAI.NotFoundError) return { ok: false, error: 'model' }
    if (err instanceof OpenAI.APIError) return { ok: false, error: `api ${err.status ?? ''}: ${err.message}` }
    throw err
  }
}

async function runGemini(apiKey, { baseURL, model, system, content, schema, maxTokens, effort }, signal) {
  const ai = new GoogleGenAI({ apiKey, ...(baseURL ? { httpOptions: { baseUrl: baseURL } } : {}) })
  try {
    const r = await ai.interactions.create(
      {
        model,
        system_instruction: system,
        input: content.map((c) => (c.type === 'image' ? { type: 'image', data: c.data, mime_type: c.mime, resolution: 'high' } : { type: 'text', text: c.text })),
        response_format: { type: 'text', mime_type: 'application/json', schema },
        generation_config: { thinking_level: effort, max_output_tokens: maxTokens },
        store: false,
      },
      { fetchOptions: { signal } },
    )
    const usage = { input: r.usage?.total_input_tokens ?? 0, output: r.usage?.total_output_tokens ?? 0 }
    if (r.status === 'incomplete' || r.status === 'budget_exceeded') return { ok: false, error: 'max-tokens', usage }
    if (r.status === 'failed') return { ok: false, error: 'failed', usage }
    return parse(r.output_text ?? '', usage)
  } catch (err) {
    if (signal.aborted || err?.name === 'AbortError') return { ok: false, error: 'cancelled' }
    if (err instanceof GeminiError) {
      if (err.status === 401 || err.status === 403) return { ok: false, error: 'auth' }
      if (err.status === 429) return { ok: false, error: 'rate-limit' }
      if (err.status === 404) return { ok: false, error: 'model' }
      if (err.status === 400 && /api key/i.test(err.message)) return { ok: false, error: 'auth' }
      return { ok: false, error: `api ${err.status}: ${err.message}` }
    }
    throw err
  }
}

const runners = { claude: runClaude, openai: runOpenAI, gemini: runGemini }
module.exports = { runners }
