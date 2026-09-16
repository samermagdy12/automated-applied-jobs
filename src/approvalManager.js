import { createJobId, normalizeWhatsAppNumber, parseApprovalCommand, selectJob } from './workflowState.js'
import { formatDraftNotification, formatJobNotification } from './notificationService.js'
import { generateApplicationDraft } from './applicationGenerator.js'

export function createApprovalManager({ primaryNumber, store, sendWhatsApp, emailService, cvPath = process.env.CV_PATH ?? 'data/Samer_CV.pdf', logger = console, now = () => new Date() }) {
  const primaryJid = normalizeWhatsAppNumber(primaryNumber)
  if (!primaryJid) throw new Error('PRIMARY_WHATSAPP_NUMBER is not configured')

  async function notifyJob(job) {
    const existing = Object.values(store.get().jobs).find((record) => job.source_post_id && record.job?.source_post_id === job.source_post_id)
    if (existing) return existing.id
    const state = store.update((current) => { const duplicate = Object.values(current.jobs).find((record) => job.source_post_id && record.job?.source_post_id === job.source_post_id); if (duplicate) return current; const id = createJobId(current, now()); current.jobs[id] = { id, job, status: 'AWAITING_JOB_DECISION', createdAt: now().toISOString() }; current.state = 'AWAITING_JOB_DECISION'; current.activeJobId = id; return current })
    const id = state.activeJobId
    if (!id || !state.jobs[id]) return id
    await sendWhatsApp(primaryJid, formatJobNotification(state.jobs[id].job, id))
    logger.info(`[NOTIFY] Job notification sent: ${id}`)
    return id
  }

  async function handleMessage(message) {
    if (message?.key?.fromMe || message?.key?.remoteJid !== primaryJid) return false
    const text = message.message?.conversation ?? message.message?.extendedTextMessage?.text ?? ''
    const state = store.get()
    const command = parseApprovalCommand(text)
    if (!command && state.state === 'EDITING_APPLICATION' && text.trim()) {
      const jobId = state.editJobId ?? selectJob(state)
      const record = jobId ? state.jobs[jobId] : null
      if (!record) return false
      const draft = generateApplicationDraft(record.job, { instruction: text.trim(), cvPath })
      if (!draft.ok) { await sendWhatsApp(primaryJid, draft.reason); return true }
      store.update((current) => { current.jobs[jobId].draft = draft; current.jobs[jobId].status = 'AWAITING_EMAIL_APPROVAL'; current.state = 'AWAITING_EMAIL_APPROVAL'; current.editJobId = null; return current })
      await sendWhatsApp(primaryJid, formatDraftNotification({ ...draft, jobId }))
      return true
    }
    if (!command) return false
    if (command.command === 'CANCEL') {
      store.update((current) => { if (command.jobId && current.jobs[command.jobId]) current.jobs[command.jobId].status = 'CANCELLED'; current.state = 'IDLE'; current.activeJobId = null; current.editJobId = null; return current })
      await sendWhatsApp(primaryJid, 'APPLICATION CANCELLED')
      return true
    }
    const jobId = selectJob(state, command.jobId)
    const record = jobId ? state.jobs[jobId] : null
    if (!record) { await sendWhatsApp(primaryJid, 'No single pending job matches that command. Include the JOB ID.'); return true }
    if (command.command === 'NO') {
      store.update((current) => { current.jobs[jobId].status = 'SKIPPED'; current.state = 'IDLE'; current.activeJobId = null; return current })
      await sendWhatsApp(primaryJid, 'JOB SKIPPED')
      return true
    }
    if (command.command === 'YES') {
      store.update((current) => { current.jobs[jobId].status = 'GENERATING_APPLICATION'; current.state = 'GENERATING_APPLICATION'; current.activeJobId = jobId; return current })
      const draft = generateApplicationDraft(record.job, { cvPath })
      if (!draft.ok) { store.update((current) => { current.jobs[jobId].status = 'IDLE'; current.state = 'IDLE'; return current }); await sendWhatsApp(primaryJid, draft.reason); return true }
      store.update((current) => { current.jobs[jobId].draft = draft; current.jobs[jobId].status = 'AWAITING_EMAIL_APPROVAL'; current.state = 'AWAITING_EMAIL_APPROVAL'; return current })
      await sendWhatsApp(primaryJid, formatDraftNotification({ ...draft, jobId }))
      logger.info(`[APPROVAL] YES received for ${jobId}`)
      return true
    }
    if (command.command === 'EDIT') {
      if (record.status !== 'AWAITING_EMAIL_APPROVAL' || !record.draft) { await sendWhatsApp(primaryJid, 'No application draft is ready to edit. Reply YES first.'); return true }
      store.update((current) => { current.jobs[jobId].status = 'EDITING_APPLICATION'; current.state = 'EDITING_APPLICATION'; current.editJobId = jobId; return current })
      await sendWhatsApp(primaryJid, 'What would you like to change?')
      return true
    }
    if (command.command === 'SEND') {
      if (record.status !== 'AWAITING_EMAIL_APPROVAL' || !record.draft) { await sendWhatsApp(primaryJid, 'No approved application draft is ready to send.'); return true }
      store.update((current) => { current.jobs[jobId].status = 'SENDING_APPLICATION'; current.state = 'SENDING_APPLICATION'; return current })
      try {
        await emailService.sendDraft(record.draft)
        store.update((current) => { current.jobs[jobId].status = 'SENT'; current.state = 'IDLE'; current.activeJobId = null; return current })
        await sendWhatsApp(primaryJid, `APPLICATION SENT\nJOB ID: ${jobId}\nTo: ${record.draft.to}\nCV attached`)
      } catch (error) {
        store.update((current) => { current.jobs[jobId].status = 'AWAITING_EMAIL_APPROVAL'; current.state = 'AWAITING_EMAIL_APPROVAL'; return current })
        await sendWhatsApp(primaryJid, `APPLICATION FAILED\nReason: ${error.message}`)
      }
      return true
    }
    return false
  }

  return { primaryJid, notifyJob, handleMessage }
}
