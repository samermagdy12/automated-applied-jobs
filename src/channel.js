import { getBinaryNodeChild, getBinaryNodeChildren, proto } from 'baileys'

function normalizedInviteCode(value) {
  const candidate = value.trim()
  const urlMatch = candidate.match(/whatsapp\.com\/channel\/([^/?#]+)/i)
  return urlMatch?.[1] ?? candidate
}

export async function resolveAndFollowChannel(sock, inviteCode, logger) {
  const code = normalizedInviteCode(inviteCode)
  if (!/^[A-Za-z0-9]+$/.test(code)) {
    throw new Error('CHANNEL_INVITE_CODE must be an invite code or a whatsapp.com/channel URL.')
  }

  logger.info({ inviteCode: code }, 'Resolving WhatsApp Channel invite')
  const metadata = await sock.newsletterMetadata('invite', code)
  if (!metadata?.id) throw new Error('WhatsApp did not return a Channel JID for this invite code.')

  logger.info({ channel: metadata.name, jid: metadata.id }, 'Channel resolved')
  const role = metadata.viewer_metadata?.view_role
  if (role !== 'SUBSCRIBER' && role !== 'ADMIN' && role !== 'OWNER') {
    await sock.newsletterFollow(metadata.id)
    logger.info({ jid: metadata.id }, 'Followed Channel')
  } else {
    logger.info({ jid: metadata.id, role }, 'Already following Channel')
  }
  const subscription = await sock.subscribeNewsletterUpdates(metadata.id)
  logger.info({ jid: metadata.id, duration: subscription?.duration }, 'Subscribed to live Channel updates')
  return metadata
}

export function decodeNewsletterHistoryResponse(response, jid, logger) {
  const updates = getBinaryNodeChild(response, 'message_updates') ?? response
  const messageNodes = getBinaryNodeChildren(updates, 'message')
  const posts = []

  for (const node of messageNodes) {
    if (!(node.content instanceof Uint8Array)) continue
    try {
      const decoded = proto.WebMessageInfo.decode(node.content).toJSON()
      posts.push({
        ...decoded,
        key: {
          ...decoded.key,
          remoteJid: jid,
          id: decoded.key?.id ?? node.attrs?.server_id,
        },
        newsletterServerId: node.attrs?.server_id,
        messageTimestamp: decoded.messageTimestamp ?? node.attrs?.t,
      })
    } catch (error) {
      logger.warn({ err: error, serverId: node.attrs?.server_id }, 'Could not decode a Newsletter history message')
    }
  }
  return posts
}

export async function fetchRecentChannelPosts(sock, jid, count, logger) {
  try {
    // Baileys 7 exposes the Newsletter history request as a raw BinaryNode.
    // Its bundled `getBinaryNodeMessages` utility confirms that each `message`
    // child contains a serialized proto.WebMessageInfo.
    const response = await sock.newsletterFetchMessages(jid, count)
    const posts = decodeNewsletterHistoryResponse(response, jid, logger)
    logger.info({ jid, requested: count, decoded: posts.length }, 'Fetched recent Newsletter post payloads')
    return posts
  } catch (error) {
    logger.warn({ err: error }, 'Could not fetch recent Channel posts; live listening continues')
    return []
  }
}
