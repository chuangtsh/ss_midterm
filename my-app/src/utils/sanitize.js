import DOMPurify from 'dompurify'

export const sanitizeText = (input = '') => {
  const cleaned = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
  return cleaned.trim()
}

export const tokenize = (input = '') => {
  const normalized = sanitizeText(input).toLowerCase()
  if (!normalized) return []
  return [...new Set(normalized.split(/\s+/).filter((token) => token.length > 1))]
}
