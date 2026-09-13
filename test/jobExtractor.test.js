import test from 'node:test'
import assert from 'node:assert/strict'
import { extractJob, validateJob } from '../src/jobExtractor.js'
test('extracts complete job', () => { const j = extractJob("We're Hiring: AI Engineer\nCompany: Example Co\nLocation: Remote\nExperience Level: Junior\nSkills: Python, Machine Learning, RAG\nRequirements:\n- Build models\nApply: hr@example.com"); assert.equal(j.job_title, 'AI Engineer'); assert.equal(j.company, 'Example Co'); assert.deepEqual(j.skills, ['Python','Machine Learning','RAG']); assert.equal(j.application_email, 'hr@example.com') })
test('missing facts remain null', () => { const j = extractJob('AI Engineer needed. Python + ML. Apply at hr@example.com'); assert.equal(j.company, null); assert.equal(j.location, null); assert.equal(j.experience_level, null) })
test('Arabic and URL are preserved', () => { const j = extractJob('نبحث عن مهندس ذكاء اصطناعي\nLocation: القاهرة\nApply: https://example.com/jobs/1'); assert.match(j.job_title, /مهندس/); assert.equal(j.application_url, 'https://example.com/jobs/1'); assert.equal(j.application_email, null) })
test('empty input is valid and non-hallucinatory', () => { const j = extractJob(null); assert.equal(j.company, null); assert.equal(j.description, ''); assert.doesNotThrow(() => validateJob(j)) })
