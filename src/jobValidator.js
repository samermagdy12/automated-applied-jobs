export function validateBasicJob(job, { seenPostIds = new Set() } = {}) {
  const hasContent = Boolean(job?.description || job?.skills?.length || job?.requirements?.length || job?.responsibilities?.length)
  const duplicate = Boolean(job?.source_post_id && seenPostIds.has(job.source_post_id))
  const isJob = Boolean(job?.job_title) && hasContent
  const hasApplicationMethod = Boolean(job?.application_email || job?.application_url)
  if (job?.source_post_id) seenPostIds.add(job.source_post_id)
  const reasons = []
  if (!isJob) reasons.push('Missing job title or meaningful job content.')
  if (!hasApplicationMethod) reasons.push('No application email or URL.')
  if (duplicate) reasons.push('Duplicate source_post_id.')
  return { is_job: isJob, has_application_method: hasApplicationMethod, has_sufficient_information: isJob, is_duplicate: duplicate, should_match: isJob && hasApplicationMethod && !duplicate, quality_score: Number(([Boolean(job?.job_title), hasContent, hasApplicationMethod, Boolean(job?.company), Boolean(job?.location)].filter(Boolean).length / 5).toFixed(2)), reason: reasons.join(' ') || 'Job data is structurally sufficient for candidate matching.' }
}
