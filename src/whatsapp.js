import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from 'baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'

export async function createWhatsAppSocket({ authDir, onConnectionUpdate }) {
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()
  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    browser: Browsers.windows('WhatsApp Channel Listener'),
    markOnlineOnConnect: false,
    // Keep Baileys' stable defaults. In particular, do not override
    // shouldSyncHistoryMessage: its initial sync establishes LID mappings
    // required for a reliable linked-device session.
    generateHighQualityLinkPreview: false,
  })

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (connection === 'connecting') logger.info('Connecting to WhatsApp')

    if (qr) {
      // Baileys supplies a new value whenever WhatsApp refreshes the QR.
      console.log('\nScan this QR with the dedicated second number: WhatsApp > Settings > Linked devices > Link a device\n')
      qrcode.generate(qr, { small: true })
      logger.info('Fresh WhatsApp QR code generated; scan it before it expires')
    }

    if (connection === 'open') logger.info('WhatsApp connection is open')
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const loggedOut = statusCode === DisconnectReason.loggedOut
      logger.warn({ statusCode, loggedOut }, 'WhatsApp connection closed')
      onConnectionUpdate({
        reconnect: !loggedOut,
        loggedOut,
      })
    }
  })
  return { sock, logger }
}
