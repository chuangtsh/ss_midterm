export const sanitizeText = (input = '') => {
  if (typeof input !== 'string') return ''
  return input.trim()
}

export const tokenize = (input = '') => {
  const normalized = sanitizeText(input).toLowerCase()
  if (!normalized) return []
  return [...new Set(normalized.split(/\s+/).filter((token) => token.length > 1))]
}
