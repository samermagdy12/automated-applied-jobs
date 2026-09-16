import { candidateProfile } from './candidateProfile.js'

function relevantProfileText(job) {
  const terms = [job.job_title, ...(job.skills ?? []), ...(job.requirements ?? [])].filter(Boolean).join(' ').toLowerCase()
  return [...candidateProfile.experience, ...candidateProfile.projects].filter((item) => item.toLowerCase().split(/\W+/).some((word) => word.length > 2 && terms.includes(word))).slice(0, 4)
}

export function generateApplicationDraft(job, { instruction = '', cvPath = process.env.CV_PATH ?? 'data/Samer_CV.pdf' } = {}) {
  if (!job.application_email) return { ok: false, reason: job.application_url ? `This job requires applying through its URL: ${job.application_url}` : 'No application email or URL was extracted.' }
  const role = job.job_title ?? 'the advertised position'
  const company = job.company ?? 'your organization'
  const evidence = relevantProfileText(job)
  const emphasis = instruction ? `\n\nPlease tailor the message as follows: ${instruction}` : ''
  const body = [`Dear Hiring Team,`, '', `I am writing to apply for the ${role} position at ${company}. My background includes ${evidence.length ? evidence.join(' ') : 'relevant technical training and project experience'}`, '', 'I would welcome the opportunity to discuss how my experience could contribute to your team.', '', 'Best regards,', 'Samer Magdy', emphasis].join('\n')
  return { ok: true, to: job.application_email, subject: `Application for ${role} - Samer Magdy`, body, attachmentPath: cvPath }
}
