function optional(label, value) {
  return value ? `${label}${value}\n` : ''
}

export function formatJobNotification(job, jobId) {
  return [
    'NEW JOB DETECTED',
    `JOB ID: ${jobId}`,
    '',
    `Role: ${job.job_title ?? 'Role not specified'}`,
    optional('Company: ', job.company).trimEnd(),
    optional('Location: ', job.location).trimEnd(),
    optional('Employment: ', job.employment_type).trimEnd(),
    optional('Apply email: ', job.application_email).trimEnd(),
    optional('Apply URL: ', job.application_url).trimEnd(),
    '',
    'Would you like to apply?',
    `Reply YES ${jobId} or NO ${jobId}`
  ].filter(Boolean).join('\n')
}

export function formatDraftNotification(draft) {
  return ['APPLICATION DRAFT', `JOB ID: ${draft.jobId}`, '', `To: ${draft.to}`, `Subject: ${draft.subject}`, '', 'Body:', draft.body, '', 'Attachment: Samer_CV.pdf', '', 'Reply SEND, EDIT, or CANCEL'].join('\n')
}
