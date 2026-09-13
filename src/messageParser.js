/** Pull visible text from common WhatsApp Channel post shapes. */
export function extractPostText(message) {
  let content = message

  // Unwrap message wrappers without modifying the original object.
  while (content?.ephemeralMessage?.message || content?.viewOnceMessage?.message || content?.viewOnceMessageV2?.message) {
    content = content.ephemeralMessage?.message
      ?? content.viewOnceMessage?.message
      ?? content.viewOnceMessageV2?.message
  }

  return content?.conversation
    ?? content?.extendedTextMessage?.text
    ?? content?.imageMessage?.caption
    ?? content?.videoMessage?.caption
    ?? content?.documentMessage?.caption
    ?? ''
}

export function messageTimestampMs(webMessage) {
  const value = webMessage?.messageTimestamp
  if (typeof value === 'number') return value * 1000
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value) * 1000
  if (value && typeof value.toNumber === 'function') return value.toNumber() * 1000
  return Date.now()
}

export function isNewsletterJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@newsletter')
}

export function selectMostRecentPost(posts) {
  return posts.reduce((latest, post) => {
    if (!latest || messageTimestampMs(post) > messageTimestampMs(latest)) return post
    return latest
  }, undefined)
}
