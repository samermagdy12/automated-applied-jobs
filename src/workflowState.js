import fs from 'node:fs'
import path from 'node:path'

export const WORKFLOW_STATES = ['IDLE', 'AWAITING_JOB_DECISION', 'GENERATING_APPLICATION', 'AWAITING_EMAIL_APPROVAL', 'EDITING_APPLICATION', 'SENDING_APPLICATION']

export function normalizeWhatsAppNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) return `${digits.slice(2)}@s.whatsapp.net`
  if (digits.startsWith('0')) return `20${digits.slice(1)}@s.whatsapp.net`
  return `${digits}@s.whatsapp.net`
}

function defaultState() {
  return { nextJobNumber: 1, jobs: {}, state: 'IDLE', activeJobId: null, editJobId: null }
}

export function createWorkflowStore(filePath = process.env.WORKFLOW_STATE_PATH ?? 'data/workflow-state.json') {
  const resolvedPath = path.resolve(filePath)
  function read() {
    try { return { ...defaultState(), ...JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) } } catch { return defaultState() }
  }
  function write(state) {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
    fs.writeFileSync(resolvedPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  }
  return {
    get: read,
    update(mutator) { const state = read(); const next = mutator(state) ?? state; write(next); return next },
    path: resolvedPath
  }
}

export function createJobId(state, now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '')
  const number = String(state.nextJobNumber ?? 1).padStart(3, '0')
  state.nextJobNumber = (state.nextJobNumber ?? 1) + 1
  return `JOB-${date}-${number}`
}

export function parseApprovalCommand(text) {
  const match = String(text ?? '').trim().match(/^(YES|NO|SEND|EDIT|CANCEL)(?:\s+(JOB-[A-Z0-9-]+))?$/i)
  return match ? { command: match[1].toUpperCase(), jobId: match[2]?.toUpperCase() ?? null } : null
}

export function selectJob(state, jobId) {
  if (jobId) return state.jobs[jobId] ? jobId : null
  const candidates = Object.values(state.jobs).filter((job) => ['AWAITING_JOB_DECISION', 'AWAITING_EMAIL_APPROVAL', 'EDITING_APPLICATION'].includes(job.status))
  return candidates.length === 1 ? candidates[0].id : null
}
