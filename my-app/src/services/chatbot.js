const PROVIDER = (import.meta.env.VITE_CHATBOT_PROVIDER || 'gemini').toLowerCase()
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash-lite'
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo'

export const CHATBOT_UID = 'bot_assistant'

export const CHATBOT_PROFILE = {
	uid: CHATBOT_UID,
	email: 'bot@studio.local',
	emailLower: 'bot@studio.local',
	username: 'StudioBot',
	usernameLower: 'studiobot',
	phone: '',
	address: '',
	photoURL: 'https://avatars.githubusercontent.com/u/1342004?s=80&v=4',
}

export const getChatbotProvider = () => PROVIDER

const assertKey = (key, providerName) => {
	if (!key) {
		throw new Error(`${providerName} API key is missing. Add it to your .env file.`)
	}
}

const buildGeminiContents = (messages) =>
	messages.map((message) => ({
		role: message.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: message.content }],
	}))

const generateGeminiReply = async ({ messages, systemPrompt }) => {
	assertKey(GEMINI_API_KEY, 'Gemini')

	const fallbackModels = [
		GEMINI_MODEL,
		'gemini-2.5-flash',
		'gemini-2.0-flash',
		'gemini-2.0-flash-lite',
		'gemini-1.5-flash-latest',
		'gemini-1.5-flash-8b',
	].filter(Boolean)

	let lastError = ''

	for (const model of fallbackModels) {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					systemInstruction: {
						parts: [{ text: systemPrompt }],
					},
					contents: buildGeminiContents(messages),
					generationConfig: {
						temperature: 0.7,
						topP: 0.9,
						maxOutputTokens: 512,
					},
				}),
			},
		)

		if (!response.ok) {
			lastError = await response.text().catch(() => '')
			if (response.status === 404) {
				continue
			}
			throw new Error(`Gemini request failed. ${lastError}`)
		}

		const data = await response.json()
		const parts = data?.candidates?.[0]?.content?.parts || []
		const text = parts.map((part) => part?.text).filter(Boolean).join('')
		if (text) return text
	}

	throw new Error(`Gemini request failed. ${lastError || 'No available Gemini model responded.'}`)
}

const generateOpenAIReply = async ({ messages, systemPrompt }) => {
	assertKey(OPENAI_API_KEY, 'OpenAI')

	const payload = {
		model: OPENAI_MODEL,
		messages: [
			{ role: 'system', content: systemPrompt },
			...messages.map((message) => ({
				role: message.role,
				content: message.content,
			})),
		],
		temperature: 0.7,
	}

	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${OPENAI_API_KEY}`,
		},
		body: JSON.stringify(payload),
	})

	if (!response.ok) {
		const errorText = await response.text().catch(() => '')
		throw new Error(`OpenAI request failed. ${errorText}`)
	}

	const data = await response.json()
	const text = data?.choices?.[0]?.message?.content || ''
	return text || 'Sorry, I had trouble generating a response.'
}

export const generateChatbotReply = async ({ messages, systemPrompt }) => {
	if (PROVIDER === 'gemini') {
		return generateGeminiReply({ messages, systemPrompt })
	}

	if (PROVIDER === 'openai' || PROVIDER === 'chatgpt') {
		return generateOpenAIReply({ messages, systemPrompt })
	}

	throw new Error(`Unsupported chatbot provider: ${PROVIDER}`)
}
