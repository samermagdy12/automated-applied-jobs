import nodemailer from 'nodemailer'
import fs from 'node:fs'

export function createEmailService({ sendMail = null } = {}) {
  async function sendDraft(draft) {
    if (!draft?.to) throw new Error('Draft recipient is missing')
    if (!draft.attachmentPath || !fs.existsSync(draft.attachmentPath)) throw new Error(`CV file not found: ${draft.attachmentPath}`)
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
    const sender = sendMail ?? transport.sendMail.bind(transport)
    return sender({ from: process.env.EMAIL_FROM ?? process.env.SMTP_USER, to: draft.to, subject: draft.subject, text: draft.body, attachments: [{ filename: 'Samer_CV.pdf', path: draft.attachmentPath }] })
  }
  return { sendDraft }
}
