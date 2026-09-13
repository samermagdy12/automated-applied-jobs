import { candidateProfile, profileChunks } from './candidateProfile.js'
import { normalizeRequirements } from './jobExtractor.js'

const conceptGroups = [
  ['computer vision', ['computer vision', 'cv', 'opencv', 'image', 'cnn', 'object detection', 'segmentation', 'yolo', 'vision', 'mediapipe']],
  ['generative ai', ['generative ai', 'llm', 'large language model', 'large language models', 'rag', 'retrieval augmented generation', 'retrieval-augmented generation', 'prompt', 'ai agent', 'agents', 'function calling']],
  ['machine learning', ['machine learning', 'ml', 'deep learning', 'pytorch', 'tensorflow', 'scikit', 'xgboost', 'classification', 'regression']],
  ['nlp', ['nlp', 'natural language', 'spacy', 'text classification']],
  ['data analysis', ['data analyst', 'data science', 'power bi', 'pandas', 'numpy', 'visualization', 'dashboard']],
  ['deployment', ['mlops', 'flask', 'django', 'rest api', 'model serving', 'fastapi']]
]
const skillAliases = new Map([
  ['llms', 'large language models'], ['llm', 'large language models'], ['generative ai', 'large language models'],
  ['rag pipelines', 'rag'], ['retrieval augmented generation', 'rag'], ['retrieval-augmented generation', 'rag'],
  ['fastapi/flask', 'flask'], ['flask backend', 'flask'], ['python development', 'python'], ['git & docker', 'git']
])
const norm = (value) => String(value ?? '').toLowerCase().replace(/[&/+(),.-]/g, ' ').replace(/\s+/g, ' ').trim()
const jobText = (job) => norm([job.job_title, ...(job.skills ?? []), ...(job.requirements ?? []), ...(job.responsibilities ?? []), job.description].join(' '))
const canonical = (value) => skillAliases.get(norm(value)) ?? norm(value)
const groupFor = (value) => conceptGroups.find(([, terms]) => terms.some((term) => norm(value).includes(norm(term))))?.[0]
const unique = (items) => [...new Map(items.map((item) => [norm(item), String(item)])).values()]
const relevanceTerms = [
  'artificial intelligence', 'ai engineer', 'ai developer', 'ai researcher', 'ai research', 'ai powered', 'ai solutions', 'ai applications',
  'machine learning', 'ml engineer', 'ml developer', 'deep learning', 'natural language processing', 'nlp engineer', 'computer vision',
  'data science', 'data scientist', 'data analyst', 'generative ai', 'genai', 'large language model', 'llm', 'rag', 'retrieval augmented generation',
  'ai agent', 'agentic ai', 'prompt engineering', 'ai automation', 'intelligent automation', 'mlops', 'neural network', 'predictive modeling',
  'model development', 'ml pipeline', 'tensorflow', 'pytorch', 'keras', 'yolo', 'opencv', 'mediapipe', 'xgboost', 'scikit learn'
]
const relevanceGroups = new Set(['computer vision', 'generative ai', 'machine learning', 'nlp', 'data analysis', 'deployment'])
const relevanceTopics = (job) => { const text = jobText(job); const groups = conceptGroups.filter(([name, terms]) => relevanceGroups.has(name) && terms.some((term) => text.includes(norm(term)))).map(([name]) => name); const explicit = relevanceTerms.filter((term) => text.includes(norm(term))); return [...new Set([...groups, ...explicit])] }
export function isAiRelevantJob(job) { return relevanceTopics(job).length > 0 }

export function retrieveCandidateContext(job, profile = candidateProfile) {
  if (!job || !profile) throw new Error('A valid job and candidate profile are required')
  const text = jobText(job)
  return profileChunks(profile).map((chunk) => {
    const chunkText = norm(chunk.text)
    const score = conceptGroups.reduce((total, [, terms]) => total + (terms.some((term) => text.includes(norm(term))) && terms.some((term) => chunkText.includes(norm(term))) ? 1 : 0), 0)
    return { ...chunk, score }
  }).filter((chunk) => chunk.score > 0).sort((a, b) => b.score - a.score || a.id - b.id).slice(0, 6)
}

export function matchJobToProfile(job, profile = candidateProfile, { threshold = Number(process.env.MATCH_THRESHOLD ?? 0.7) } = {}) {
  if (!job || !profile?.skills || !job.job_title) throw new Error('A valid job and candidate profile are required')
  const context = retrieveCandidateContext(job, profile)
  const text = jobText(job)
  const requirements = unique(normalizeRequirements([...(job.requirements ?? []), ...(job.skills ?? [])]))
  const topics = relevanceTopics(job)
  const aiRelevant = topics.length > 0
  const relevanceScore = aiRelevant ? 1 : 0
  if (requirements.length === 0) return { match_score: relevanceScore, ai_relevance_score: relevanceScore, ai_relevant: aiRelevant, decision: aiRelevant ? 'ACCEPT' : 'REJECT', matched_skills: [], partial_skills: [], missing_skills: [], relevant_experience: context.filter((chunk) => /Intern|Trainee/.test(chunk.text)).map((chunk) => chunk.text), relevant_projects: context.filter((chunk) => !/Intern|Trainee/.test(chunk.text)).map((chunk) => chunk.text), reason: aiRelevant ? `Accepted because the role is related to ${topics.slice(0, 4).join(', ')}; requirements were not structured enough for candidate coverage.` : 'Rejected because the job has no meaningful AI, machine learning, data science, data analysis, or related career scope.', retrieved_context: context.map((chunk) => chunk.text) }
  const matchedSkills = []
  const partialSkills = []
  const missingSkills = []
  const evidenceSupports = (component) => profile.skills.some((skill) => canonical(skill) === canonical(component) || (groupFor(skill) && groupFor(skill) === groupFor(component))) || context.some((chunk) => norm(chunk.text).includes(norm(component)))
  for (const requirement of requirements) {
    const components = requirement.split(/\s*(?:\/|&|,|\band\b)\s*/i).map((item) => item.trim()).filter(Boolean)
    const supported = components.filter(evidenceSupports)
    const exact = profile.skills.find((skill) => canonical(skill) === canonical(requirement)) ?? context.find((chunk) => norm(chunk.text).includes(norm(requirement)))?.text
    const semantic = !/(?:langchain|langgraph|llamaindex|docker|vector database|power bi)/i.test(requirement) ? profile.skills.find((skill) => groupFor(skill) && groupFor(skill) === groupFor(requirement)) : null
    if (components.length > 1 && supported.length > 0 && supported.length < components.length) partialSkills.push({ skill: requirement, match_type: 'partial', evidence: supported, missing: components.filter((component) => !supported.includes(component)) })
    else if (exact || semantic) matchedSkills.push({ skill: requirement, match_type: exact ? 'exact' : 'semantic', evidence: exact ?? semantic ?? requirement })
    else missingSkills.push(requirement)
  }
  const groups = new Set(conceptGroups.filter(([, terms]) => terms.some((term) => text.includes(norm(term)) && context.some((chunk) => norm(chunk.text).includes(norm(term))))).map(([name]) => name))
  const decision = aiRelevant ? 'ACCEPT' : 'REJECT'
  const evidenceWords = groups.size ? [...groups].join(', ') : 'limited overlapping skills'
  const status = missingSkills.length === 0 && partialSkills.length === 0
    ? `All ${requirements.length} requirement(s) are supported by candidate evidence`
    : `${matchedSkills.length} matched, ${partialSkills.length} partial, and ${missingSkills.length} missing requirement(s)`
  return {
    match_score: relevanceScore, ai_relevance_score: relevanceScore, ai_relevant: aiRelevant, decision, matched_skills: matchedSkills, partial_skills: partialSkills, missing_skills: missingSkills,
    relevant_experience: context.filter((chunk) => /Intern|Trainee/.test(chunk.text)).map((chunk) => chunk.text),
    relevant_projects: context.filter((chunk) => !/Intern|Trainee/.test(chunk.text)).map((chunk) => chunk.text),
    reason: aiRelevant ? `Accepted because the role is related to ${topics.slice(0, 4).join(', ')}. ${status}; ${evidenceWords} CV evidence is contextual.` : `Rejected because the role has no meaningful AI career scope. ${status}; ${evidenceWords} CV evidence is contextual.`,
    retrieved_context: context.map((chunk) => chunk.text)
  }
}