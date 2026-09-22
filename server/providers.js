/**
 * Provider adapters.
 *
 * Two shapes are supported — Anthropic's Messages API and OpenAI's Chat
 * Completions API — behind one interface, so the rest of the server never
 * branches on provider. Each adapter does three things: list the models the
 * key can actually reach, validate a key, and stream a completion.
 *
 * Models are listed from the provider rather than hard-coded. Hard-coded model
 * identifiers rot: they get retired, and the console then offers the operator a
 * menu of names that no longer resolve.
 */

export const PROVIDERS = ['anthropic', 'openai']

const TIMEOUT_MS = 120_000

function timeoutSignal(ms = TIMEOUT_MS) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  return { signal: ac.signal, done: () => clearTimeout(timer) }
}

// ── Model listing / key validation ──────────────────────────────────────────

export async function listModels(provider, apiKey) {
  const { signal, done } = timeoutSignal(20_000)
  try {
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        signal,
      })
      if (!res.ok) return { ok: false, status: res.status, message: await shortBody(res) }
      const json = await res.json()
      const models = (json.data ?? []).map((m) => ({ id: m.id, label: m.display_name || m.id }))
      return { ok: true, models }
    }

    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { authorization: `Bearer ${apiKey}` },
      signal,
    })
    if (!res.ok) return { ok: false, status: res.status, message: await shortBody(res) }
    const json = await res.json()
    const models = (json.data ?? [])
      .map((m) => m.id)
      // Chat-capable families only; the raw list is full of embedding,
      // moderation, audio and image endpoints that cannot answer a question.
      .filter((id) => /^(gpt|o[1-9]|chatgpt)/i.test(id) && !/(embed|whisper|tts|dall|moderation|audio|image|realtime|transcribe)/i.test(id))
      .sort()
      .map((id) => ({ id, label: id }))
    return { ok: true, models }
  } catch (err) {
    return { ok: false, status: 0, message: err.name === 'AbortError' ? 'Request timed out' : String(err.message ?? err) }
  } finally {
    done()
  }
}

async function shortBody(res) {
  try {
    const text = await res.text()
    try {
      const j = JSON.parse(text)
      return j?.error?.message ?? text.slice(0, 300)
    } catch { return text.slice(0, 300) }
  } catch { return res.statusText }
}

// ── Streaming completion ────────────────────────────────────────────────────

/**
 * Streams assistant text.
 * @param onDelta called with each text fragment
 * @returns { ok, status?, message? }
 */
export async function streamCompletion({ provider, apiKey, model, system, messages, maxTokens = 1500 }, onDelta) {
  const { signal, done } = timeoutSignal()
  try {
    const res = provider === 'anthropic'
      ? await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, stream: true }),
          signal,
        })
      : await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model,
            max_completion_tokens: maxTokens,
            messages: [{ role: 'system', content: system }, ...messages],
            stream: true,
          }),
          signal,
        })

    if (!res.ok || !res.body) {
      return { ok: false, status: res.status, message: await shortBody(res) }
    }

    // Both providers speak SSE; the event payloads differ, the framing does not.
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { value, done: finished } = await reader.read()
      if (finished) break
      buffer += decoder.decode(value, { stream: true })

      let nl
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue
        let evt
        try { evt = JSON.parse(payload) } catch { continue }

        if (provider === 'anthropic') {
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') onDelta(evt.delta.text)
          if (evt.type === 'error') return { ok: false, status: 500, message: evt.error?.message ?? 'stream error' }
        } else {
          const piece = evt.choices?.[0]?.delta?.content
          if (piece) onDelta(piece)
        }
      }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err.name === 'AbortError' ? 'Request timed out' : String(err.message ?? err),
    }
  } finally {
    done()
  }
}
