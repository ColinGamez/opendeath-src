/** Classify the reported failure without treating connectivity as proof of model access. */
export function connectionError(message: string) {
  if (/free usage limit|quotaexceeded|quota exceeded|subscription_sharing_usage_limit_exceeded|provider\.(free-limit|quota|go-limit)/i.test(message))
    return "quota"
  if (/rate.?limit|too many requests|\b429\b/i.test(message)) return "rate"
  if (/econnreset|econnrefused|err_connection|timed? ?out|network error|provider\.transport/i.test(message))
    return "network"
  if (/unauthorized|invalid.?api.?key|provider\.auth|\b401\b/i.test(message)) return "auth"
  return "unknown"
}
