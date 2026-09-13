import 'dotenv/config'
import { resolveAndFollowChannel, fetchRecentChannelPosts } from './channel.js'
import { extractPostText, isNewsletterJid, messageTimestampMs, selectMostRecentPost } from './messageParser.js'
import { createWhatsAppSocket } from './whatsapp.js'
import { extractJob } from './jobExtractor.js'

const config = {
  inviteCode: process.env.CHANNEL_INVITE_CODE ?? '0029Vb8LKeD7dmeV7rf9r338',
  authDir: process.env.AUTH_DIR ?? 'auth',
  catchUpCount: Number(process.env.CATCH_UP_MESSAGE_COUNT ?? 20),
  testMode: process.env.TEST_MODE?.trim().toLowerCase() === 'true',
  newsletterDiagnostic: process.env.NEWSLETTER_DIAGNOSTIC?.trim().toLowerCase() === 'true',
}

// This is the resolved JID for the configured public AI Jobs Channel. It is
// used only to capture historical sync events before metadata resolution ends.
const targetChannelJid = '120363427986007778@newsletter'

let reconnectTimer
let startupTimestamp = Date.now()
let channel
const seen = new Set()
const historicalPosts = new Map()
let testPostPrinted = false

function jsonSafe(value, maxLength = 12000) {
  const text = JSON.stringify(value, (_, item) => {
    if (Buffer.isBuffer(item) || item instanceof Uint8Array) return `[binary ${item.length} bytes]`
    return item
  }, 2)
  return text.length > maxLength ? `${text.slice(0, maxLength)}
... [truncated]` : text
}

function messageType(message) {
  if (!message?.message) return 'none'
  return Object.keys(message.message).find((key) => key !== 'messageContextInfo') ?? 'unknown'
}

function diagnosticEvent(eventName, payload, logger) {
  if (!config.newsletterDiagnostic) return
  const candidates = eventName === 'messages.upsert' ? payload?.messages ?? [] : [payload]
  for (const item of candidates) {
    const remoteJid = item?.key?.remoteJid ?? item?.id ?? item?.key?.participant
    if (remoteJid !== targetChannelJid) continue
    const post = item?.key ? item : undefined
    const text = post ? extractPostText(post.message).trim() : ''
    const caption = post?.message?.imageMessage?.caption ?? post?.message?.videoMessage?.caption ?? ''
    console.log(`
[NEWSLETTER DIAGNOSTIC]
Event: ${eventName}
Remote JID: ${remoteJid}
Message ID: ${post?.key?.id ?? item?.server_id ?? 'unknown'}
Timestamp: ${post ? new Date(messageTimestampMs(post)).toISOString() : 'unknown'}
Message Type: ${messageType(post)}
Actual text/caption: ${Boolean(text || caption)}
Text: ${text || '(none)'}
Caption: ${caption || '(none)'}
Full relevant message structure:
${jsonSafe(item)}
`)
    logger.info({ eventName, remoteJid, hasContent: Boolean(text || caption), messageType: messageType(post) }, 'Newsletter diagnostic event captured')
    if (post && (text || caption)) {
      console.log(`========================================
ðŸ§ª NEW CHANNEL POST TEST
========================================

Event: ${eventName}
Remote JID: ${remoteJid}
Message ID: ${post.key?.id ?? 'unknown'}
Timestamp: ${new Date(messageTimestampMs(post)).toISOString()}
Message Type: ${messageType(post)}
Text: ${text || '(none)'}
Caption: ${caption || '(none)'}
Full relevant message structure:
${jsonSafe(post)}
========================================
`)
    }
  }
}

function postIdentity(post) {
  return `${post?.key?.remoteJid ?? ''}:${post?.key?.id ?? post?.newsletterServerId ?? ''}:${messageTimestampMs(post)}`
}

async function printPost(post) {
  const text = extractPostText(post.message)
  if (!text.trim()) return
  const timestamp = new Date(messageTimestampMs(post)).toLocaleString('sv-SE').replace('T', ' ')
  console.log(`
========================================
ðŸš€ NEW AI JOB DETECTED
========================================

Channel: ${channel.name}
Timestamp: ${timestamp}

${text}

========================================
`)
  const job = extractJob(text, { sourcePostId: post.key?.id, sourceChannel: channel.id })
  console.log(`
========================================
ðŸ¤– JOB EXTRACTION
========================================
${JSON.stringify(job, null, 2)}
========================================
`)
}

function captureHistoricalPost(post) {
  if (!config.testMode || post?.key?.remoteJid !== targetChannelJid || !post.message) return
  historicalPosts.set(postIdentity(post), post)
}

function printHistoricalTestPost(logger) {
  if (!config.testMode || testPostPrinted || !channel) return
  const post = selectMostRecentPost([...historicalPosts.values()])
  if (!post) {
    logger.warn({ targetChannelJid }, 'TEST_MODE found no historical posts for the target Channel in this sync')
    return
  }
  testPostPrinted = true
  const timestamp = new Date(messageTimestampMs(post)).toLocaleString('sv-SE').replace('T', ' ')
  const text = extractPostText(post.message).trim() || '[No text or supported media caption was present in this post.]'
  console.log(`
========================================
ðŸ§ª HISTORICAL CHANNEL POST TEST
===============================

Channel: ${channel.name}
Post ID: ${post.key?.id ?? 'unknown'}
Timestamp: ${timestamp}
Text:
${text}

===
`)
}

async function start() {
  const { sock, logger } = await createWhatsAppSocket({
    ...config,
    onConnectionUpdate: ({ reconnect, loggedOut }) => {
      if (loggedOut) {
        console.error('Authentication was logged out. Delete only the auth folder and authenticate the dedicated second number again.')
      } else if (reconnect && !reconnectTimer) {
        channel = undefined
        reconnectTimer = setTimeout(() => { reconnectTimer = undefined; start().catch(console.error) }, 3_000)
      }
    },
  })

  if (config.newsletterDiagnostic) {
    logger.info({ targetChannelJid }, 'NEWSLETTER_DIAGNOSTIC enabled; publish one test post in the Channel')
    for (const eventName of ['messages.upsert', 'newsletter.reaction', 'newsletter.view', 'newsletter-participants.update', 'newsletter-settings.update']) {
      sock.ev.on(eventName, (payload) => diagnosticEvent(eventName, payload, logger))
    }
  }

  if (config.testMode) {
    logger.info({ targetChannelJid }, 'TEST_MODE enabled: capturing historical Channel posts from sync events')
    sock.ev.on('messaging-history.set', ({ messages }) => {
      for (const post of messages) captureHistoricalPost(post)
    })
    sock.ev.on('messaging-history.status', ({ status }) => {
      if (status !== 'complete') return
      // Let any final history-set batch for this sync flush first.
      setTimeout(() => printHistoricalTestPost(logger), 250)
    })
  }

  sock.ev.on('connection.update', async ({ connection }) => {
    if (connection !== 'open' || channel) return
    try {
      channel = await resolveAndFollowChannel(sock, config.inviteCode, logger)
      console.log(`Listening for new posts from: ${channel.name} (${channel.id})`)
      if (config.testMode && channel.id !== targetChannelJid) {
        logger.warn({ resolvedJid: channel.id, targetChannelJid }, 'Resolved Channel JID differs from the TEST_MODE target; no historical post will be printed')
      }
      const catchUp = await fetchRecentChannelPosts(sock, channel.id, config.catchUpCount, logger)
      for (const item of catchUp) {
        seen.add(postIdentity(item.message ?? item))
        captureHistoricalPost(item)
      }
      startupTimestamp = Date.now()
      logger.info({ ignored: catchUp.length }, 'Listener ready; existing posts are ignored')
      printHistoricalTestPost(logger)
    } catch (error) {
      logger.error({ err: error }, 'Channel setup failed')
    }
  })

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    for (const post of messages) {
      // Some history paths surface messages.upsert rather than a history-set.
      // TEST_MODE captures them before normal production filtering is active.
      captureHistoricalPost(post)
      if (!channel || type !== 'notify') continue
      if (post.key?.remoteJid !== channel.id || !isNewsletterJid(post.key?.remoteJid) || !post.message) continue
      const identity = postIdentity(post)
      if (seen.has(identity)) continue
      seen.add(identity)
      if (seen.size > 2_000) seen.clear()
      if (messageTimestampMs(post) < startupTimestamp - 5_000) continue
      logger.info({ jid: channel.id, id: post.key?.id }, 'New Channel post detected')
      void printPost(post)
    }
  })
}

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
start().catch((error) => { console.error(error); process.exitCode = 1 })




