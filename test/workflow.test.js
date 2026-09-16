import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApprovalManager } from '../src/approvalManager.js'
import { createEmailService } from '../src/emailService.js'
import { formatJobNotification } from '../src/notificationService.js'
import { createWorkflowStore, normalizeWhatsAppNumber } from '../src/workflowState.js'

function fixture() {
  const file = path.join(os.tmpdir(), `workflow-${Date.now()}-${Math.random()}.json`)
  const cv = path.join(os.tmpdir(), `cv-${Date.now()}-${Math.random()}.pdf`)
  fs.writeFileSync(cv, 'test cv')
  const sent = []
  const emailService = createEmailService({ sendMail: async (mail) => { sent.push(mail); return { messageId: 'test' } } })
  const messages = []
  const manager = createApprovalManager({ primaryNumber: '01024095090', store: createWorkflowStore(file), sendWhatsApp: async (jid, text) => messages.push({ jid, text }), emailService, cvPath: cv, logger: { info() {} }, now: () => new Date('2026-09-16T19:30:00Z') })
  return { manager, messages, sent, file, cv }
}

function incoming(text, jid = '201024095090@s.whatsapp.net') { return { key: { remoteJid: jid, fromMe: false }, message: { conversation: text } } }

test('normalizes the configured Egyptian primary number', () => { assert.equal(normalizeWhatsAppNumber('01024095090'), '201024095090@s.whatsapp.net') })
test('formats a readable notification with job id', () => { const text = formatJobNotification({ job_title: 'AI Engineer', company: 'Example', location: 'Remote', application_email: 'jobs@example.com' }, 'JOB-001'); assert.match(text, /NEW JOB DETECTED/); assert.match(text, /JOB-001/); assert.match(text, /YES JOB-001/) })
test('only the primary number can control the workflow', async () => { const { manager, messages } = fixture(); await manager.notifyJob({ job_title: 'AI Engineer', application_email: 'jobs@example.com' }); await manager.handleMessage(incoming('NO', '201111111111@s.whatsapp.net')); assert.equal(messages.at(-1).text.includes('SKIPPED'), false) })
test('YES creates a draft but does not send email', async () => { const { manager, messages, sent, cv } = fixture(); await manager.notifyJob({ job_title: 'AI Engineer', company: 'Example', application_email: 'jobs@example.com' }); await manager.handleMessage(incoming('YES')); assert.equal(sent.length, 0); assert.match(messages.at(-1).text, /APPLICATION DRAFT/); assert.match(messages.at(-1).text, /Samer_CV/) ; fs.unlinkSync(cv) })
test('SEND sends only the approved draft with the CV attached', async () => { const { manager, messages, sent, cv, file } = fixture(); await manager.notifyJob({ job_title: 'AI Engineer', company: 'Example', application_email: 'jobs@example.com' }); await manager.handleMessage(incoming('YES')); await manager.handleMessage(incoming('SEND')); assert.equal(sent.length, 1); assert.equal(sent[0].to, 'jobs@example.com'); assert.equal(sent[0].attachments[0].path, cv); assert.match(messages.at(-1).text, /APPLICATION SENT/); fs.unlinkSync(cv); fs.unlinkSync(file) })
test('NO and CANCEL clear pending state', async () => { const { manager, file } = fixture(); await manager.notifyJob({ job_title: 'AI Engineer', application_email: 'jobs@example.com' }); await manager.handleMessage(incoming('NO')); assert.equal(manager.primaryJid, '201024095090@s.whatsapp.net'); assert.equal(JSON.parse(fs.readFileSync(file)).state, 'IDLE'); fs.unlinkSync(file) })
test('EDIT regenerates a draft and SEND remains explicit', async () => { const { manager, messages, sent, cv, file } = fixture(); await manager.notifyJob({ job_title: 'AI Engineer', application_email: 'jobs@example.com' }); await manager.handleMessage(incoming('YES')); await manager.handleMessage(incoming('EDIT')); assert.match(messages.at(-1).text, /What would you like/); await manager.handleMessage(incoming('Emphasize LLM and RAG experience')); assert.match(messages.at(-1).text, /APPLICATION DRAFT/); assert.equal(sent.length, 0); await manager.handleMessage(incoming('CANCEL')); assert.equal(JSON.parse(fs.readFileSync(file)).state, 'IDLE'); fs.unlinkSync(cv); fs.unlinkSync(file) })
test('CANCEL interrupts edit mode', async () => { const { manager, messages, cv, file } = fixture(); await manager.notifyJob({ job_title: 'AI Engineer', application_email: 'jobs@example.com' }); await manager.handleMessage(incoming('YES')); await manager.handleMessage(incoming('EDIT')); await manager.handleMessage(incoming('CANCEL')); assert.match(messages.at(-1).text, /CANCELLED/); assert.equal(JSON.parse(fs.readFileSync(file)).state, 'IDLE'); fs.unlinkSync(cv); fs.unlinkSync(file) })
test('multiple jobs are not overwritten and bare commands become ambiguous', async () => { const { manager, messages, file } = fixture(); await manager.notifyJob({ job_title: 'AI Engineer', application_email: 'a@example.com' }); await manager.notifyJob({ job_title: 'ML Engineer', application_email: 'b@example.com' }); await manager.handleMessage(incoming('YES')); assert.match(messages.at(-1).text, /No single pending job/); const state = JSON.parse(fs.readFileSync(file)); assert.equal(Object.keys(state.jobs).length, 2); fs.unlinkSync(file) })
test('missing email is handled without pretending to send', async () => { const { manager, messages, file } = fixture(); await manager.notifyJob({ job_title: 'AI Engineer', application_url: 'https://example.com/apply' }); await manager.handleMessage(incoming('YES')); assert.match(messages.at(-1).text, /URL/); fs.unlinkSync(file) })
test('duplicate source posts notify only once', async () => { const { manager, messages, file } = fixture(); const job = { job_title: 'AI Engineer', source_post_id: 'post-1', application_email: 'jobs@example.com' }; await manager.notifyJob(job); await manager.notifyJob(job); assert.equal(messages.filter((item) => /NEW JOB DETECTED/.test(item.text)).length, 1); fs.unlinkSync(file) })
test('SEND fails safely when the CV file is missing', async () => { const { manager, messages, file, cv } = fixture(); await manager.notifyJob({ job_title: 'AI Engineer', application_email: 'jobs@example.com' }); await manager.handleMessage(incoming('YES')); fs.unlinkSync(cv); await manager.handleMessage(incoming('SEND')); assert.match(messages.at(-1).text, /APPLICATION FAILED/); fs.unlinkSync(file) })
