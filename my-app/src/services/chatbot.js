const OPENAI_URL = 'https://api.openai.com/v1/responses'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export const askBot = async (message, history = []) => {
  const provider = import.meta.env.VITE_BOT_PROVIDER || 'openai'

  if (provider === 'gemini') {
    const key = import.meta.env.VITE_GEMINI_API_KEY
    if (!key) throw new Error('Missing VITE_GEMINI_API_KEY')

    const response = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
          { role: 'user', parts: [{ text: message }] },
        ],
      }),
    })

    const json = await response.json()
    return json?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.'
  }

  const key = import.meta.env.VITE_OPENAI_API_KEY
  if (!key) throw new Error('Missing VITE_OPENAI_API_KEY')

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        ...history.map((h) => ({ role: h.role, content: [{ type: 'input_text', text: h.text }] })),
        { role: 'user', content: [{ type: 'input_text', text: message }] },
      ],
    }),
  })

  const json = await response.json()
  return json?.output?.[0]?.content?.[0]?.text || 'No response.'
}
