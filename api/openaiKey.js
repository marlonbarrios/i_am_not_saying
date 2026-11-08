/** True when the value is missing or still the sample key from .env. */
export function isPlaceholderApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return true;
  const key = apiKey.trim();
  if (!key) return true;
  return /your[-_].*key|placeholder|example[-_]?key|changeme|your_openai/i.test(key);
}
