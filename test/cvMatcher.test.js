import test from 'node:test'
import assert from 'node:assert/strict'
import { candidateProfile } from '../src/candidateProfile.js'
import { matchJobToProfile, retrieveCandidateContext } from '../src/cvMatcher.js'
const job=(o={})=>({job_title:'Computer Vision Engineer',skills:['Python','OpenCV','CNN'],requirements:['object detection'],responsibilities:[],description:'Build real-time computer vision models',application_email:'x@y.com',...o})
test('computer vision role matches CV projects',()=>{const r=matchJobToProfile(job()); assert.ok(r.match_score>=0.7); assert.equal(r.decision,'ACCEPT'); assert.ok(r.relevant_projects.length>0)})
test('LLM RAG role retrieves relevant CV context',()=>{const r=matchJobToProfile(job({job_title:'LLM RAG Engineer',skills:['Python','LLMs','RAG'],description:'Build agentic RAG workflows'})); assert.ok(r.match_score>=0.7); assert.ok(retrieveCandidateContext(job({job_title:'LLM RAG Engineer',skills:['LLMs','RAG']})).some(x=>x.text.includes('Claims Automation')))})
test('unrelated role scores lower',()=>{const r=matchJobToProfile(job({job_title:'Power BI Data Analyst',skills:['Power BI'],requirements:[],responsibilities:[],description:'Create business dashboards'})); assert.equal(r.decision,'REJECT'); assert.ok(r.match_score<0.7)})
test('missing profile/job fails gracefully',()=>{assert.throws(()=>matchJobToProfile(null,candidateProfile),/valid job/); assert.throws(()=>matchJobToProfile(job(),null),/candidate profile/)})


