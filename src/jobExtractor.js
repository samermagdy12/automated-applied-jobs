const CHANNEL_JID = '120363427986007778@newsletter'
export const JOB_FIELDS = ['job_title','company','location','employment_type','experience_level','skills','requirements','responsibilities','application_email','application_url','description','source_post_id','source_channel','raw_text']
const valueAfter = (text, labels) => { const line = text.split(/\r?\n/).find((x) => labels.some((l) => new RegExp(`^\\s*${l}\\s*[:\\-]`, 'i').test(x))); return line ? line.replace(/^\s*[^:\-]+[:\-]\s*/i, '').trim() || null : null }
const listAfter = (text, labels) => { const lines = text.split(/\r?\n/); const i = lines.findIndex((x) => labels.some((l) => new RegExp(`^\\s*${l}\\s*[:\\-]?\\s*$`, 'i').test(x))); if (i < 0) return []; const out = []; for (const x of lines.slice(i + 1)) { if (!/^\s*(?:[-•*]|\d+[.)])\s+/.test(x)) break; out.push(x.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim()) } return out }
export function validateJob(job) { for (const field of JOB_FIELDS) if (!(field in job)) throw new Error(`Missing job field: ${field}`); if (typeof job.job_title !== 'string' || !Array.isArray(job.skills) || !Array.isArray(job.requirements) || !Array.isArray(job.responsibilities)) throw new Error('Invalid job schema types'); return job }
export function extractJob(rawText, { sourcePostId = null, sourceChannel = CHANNEL_JID } = {}) {
  const text = typeof rawText === 'string' ? rawText.trim() : ''
  const first = text.split(/\r?\n/).map((x) => x.trim()).find(Boolean) ?? ''
  const title = valueAfter(text, ['job title','position','role','title']) ?? (first.replace(/^[^\p{L}\p{N}]*/u, '').replace(/^(we'?re hiring|hiring|vacancy)\s*[:\-]?\s*/i, '').trim() || 'Unspecified role')
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null
  const url = text.match(/https?:\/\/[^\s)]+/i)?.[0]?.replace(/[.,;]+$/, '') ?? null
  const skillsLine = valueAfter(text, ['skills','tech stack','technologies'])
  const skills = skillsLine ? skillsLine.split(/[,|+]/).map((x) => x.trim()).filter(Boolean) : listAfter(text, ['skills'])
  const job = { job_title: title, company: valueAfter(text, ['company','employer']), location: valueAfter(text, ['location','where']), employment_type: valueAfter(text, ['employment type','type']), experience_level: valueAfter(text, ['experience level','experience','seniority']), skills: [...new Map(skills.map((x) => [x.toLowerCase(), x])).values()], requirements: listAfter(text, ['requirements','qualifications']), responsibilities: listAfter(text, ['responsibilities','what you will do','what you’ll do']), application_email: email, application_url: url, description: text, source_post_id: sourcePostId, source_channel: sourceChannel, raw_text: text }
  return validateJob(job)
}
