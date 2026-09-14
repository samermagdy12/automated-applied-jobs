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
const AI_RELEVANCE_THRESHOLD = 0.6
const CANDIDATE_FIT_WEIGHT = 0.6
const AI_RELEVANCE_WEIGHT = 0.4
const ACCEPT_THRESHOLD = 0.75
const REVIEW_THRESHOLD = 0.55
const fitWeights = { skills: 0.35, experience: 0.25, projects: 0.2, semantic: 0.1, education: 0.1 }
const relevanceTopics = (job) => { const text = jobText(job); const groups = conceptGroups.filter(([name, terms]) => relevanceGroups.has(name) && terms.some((term) => text.includes(norm(term)))).map(([name]) => name); const explicit = relevanceTerms.filter((term) => text.includes(norm(term))); return [...new Set([...groups, ...explicit])] }
const relevanceScore = (job, topics) => { const title = norm(job.job_title); const body = norm([job.description, ...(job.skills ?? []), ...(job.requirements ?? []), ...(job.responsibilities ?? [])].join(' ')); const titleSignals = topics.filter((topic) => title.includes(norm(topic))).length; const bodySignals = topics.filter((topic) => body.includes(norm(topic))).length; return Number((titleSignals > 0 ? Math.min(1, 0.9 + Math.min(0.1, bodySignals * 0.03)) : Math.min(1, 0.6 + Math.min(0.35, bodySignals * 0.08))).toFixed(2)) }
export function isAiRelevantJob(job) { return relevanceTopics(job).length > 0 }
const confidenceLevel = (value) => value >= ACCEPT_THRESHOLD ? 'HIGH' : value >= REVIEW_THRESHOLD ? 'MEDIUM' : 'LOW'
const categoryScore = (items, denominator) => denominator ? Math.min(1, items / denominator) : 0

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
  const aiRelevanceScore = aiRelevant ? relevanceScore(job, topics) : 0
  const relevantExperience = context.filter((chunk) => /Intern|Trainee/.test(chunk.text)).map((chunk) => chunk.text)
  const relevantProjects = context.filter((chunk) => !/Intern|Trainee/.test(chunk.text)).map((chunk) => chunk.text)
  if (requirements.length === 0) {
    const skillEvidence = profile.skills.filter((skill) => text.includes(norm(skill)) || (groupFor(skill) && topics.some((topic) => topic === groupFor(skill)))).length
    const candidateFitScore = Number((fitWeights.skills * categoryScore(skillEvidence, 4) + fitWeights.experience * categoryScore(relevantExperience.length, 1) + fitWeights.projects * categoryScore(relevantProjects.length, 2) + fitWeights.semantic * categoryScore(context.length, 3)).toFixed(2))
    const finalConfidence = Number((AI_RELEVANCE_WEIGHT * aiRelevanceScore + CANDIDATE_FIT_WEIGHT * candidateFitScore).toFixed(2))
    const decision = aiRelevanceScore < AI_RELEVANCE_THRESHOLD ? 'REJECT' : finalConfidence >= ACCEPT_THRESHOLD ? 'ACCEPT' : finalConfidence >= REVIEW_THRESHOLD ? 'REVIEW' : 'REJECT'
    return { match_score: finalConfidence, ai_relevance_score: aiRelevanceScore, ai_relevance: aiRelevant, ai_relevant: aiRelevant, candidate_fit_score: candidateFitScore, final_confidence: finalConfidence, confidence_level: confidenceLevel(finalConfidence), decision, ai_relevance_evidence: topics.slice(0, 6), matched_skills: [], partial_skills: [], missing_skills: [], relevant_experience: relevantExperience, relevant_projects: relevantProjects, reason: aiRelevant ? `${decision === 'ACCEPT' ? 'Accepted' : decision === 'REVIEW' ? 'Review recommended' : 'Rejected'} because the role is related to ${topics.slice(0, 4).join(', ')}. Candidate fit is ${confidenceLevel(candidateFitScore).toLowerCase()} based on available CV evidence; requirements were not structured.` : 'Rejected because the role has no meaningful AI, machine learning, data science, data analysis, or related career scope.', retrieved_context: context.map((chunk) => chunk.text) }
  }
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
  const requirementSkillAlignment = (matchedSkills.length + partialSkills.reduce((total, item) => total + item.evidence.length / (item.evidence.length + item.missing.length), 0)) / requirements.length
  const semanticSkillEvidence = profile.skills.filter((skill) => text.includes(norm(skill)) || (groupFor(skill) && topics.some((topic) => topic === groupFor(skill)))).length
  const skillAlignment = Math.max(requirementSkillAlignment, categoryScore(semanticSkillEvidence, 4))
  const experienceAlignment = categoryScore(relevantExperience.length, 2)
  const projectAlignment = categoryScore(relevantProjects.length, 3)
  const semanticEvidence = categoryScore(context.length, 4)
  const educationRelevant = /degree|bachelor|master|education|certif/i.test(text)
  const educationEvidence = educationRelevant && profileChunks(profile).some((chunk) => /Bachelor|Master|certif/i.test(chunk.text)) ? 1 : 0
  const candidateFitScore = Number((fitWeights.skills * skillAlignment + fitWeights.experience * experienceAlignment + fitWeights.projects * projectAlignment + fitWeights.semantic * semanticEvidence + fitWeights.education * educationEvidence).toFixed(2))
  const finalConfidence = Number((AI_RELEVANCE_WEIGHT * aiRelevanceScore + CANDIDATE_FIT_WEIGHT * candidateFitScore).toFixed(2))
  const decision = aiRelevanceScore < AI_RELEVANCE_THRESHOLD ? 'REJECT' : finalConfidence >= ACCEPT_THRESHOLD ? 'ACCEPT' : finalConfidence >= REVIEW_THRESHOLD ? 'REVIEW' : 'REJECT'
  const evidenceWords = groups.size ? [...groups].join(', ') : 'limited overlapping skills'
  const status = missingSkills.length === 0 && partialSkills.length === 0
    ? `All ${requirements.length} requirement(s) are supported by candidate evidence`
    : `${matchedSkills.length} matched, ${partialSkills.length} partial, and ${missingSkills.length} missing requirement(s)`
  return {
    match_score: finalConfidence, ai_relevance_score: aiRelevanceScore, ai_relevance: aiRelevant, ai_relevant: aiRelevant, candidate_fit_score: candidateFitScore, final_confidence: finalConfidence, confidence_level: confidenceLevel(finalConfidence), decision, ai_relevance_evidence: topics.slice(0, 6), matched_skills: matchedSkills, partial_skills: partialSkills, missing_skills: missingSkills,
    relevant_experience: relevantExperience,
    relevant_projects: relevantProjects,
    reason: aiRelevant ? `${decision === 'ACCEPT' ? 'Accepted' : decision === 'REVIEW' ? 'Review recommended' : 'Rejected'} because the role is related to ${topics.slice(0, 4).join(', ')}. ${status}; candidate fit is ${confidenceLevel(candidateFitScore).toLowerCase()} based on CV evidence.` : `Rejected because the role has no meaningful AI career scope. ${status}; candidate fit is contextual only.`,
    retrieved_context: context.map((chunk) => chunk.text)
  }
}