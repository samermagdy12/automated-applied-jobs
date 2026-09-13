import test from 'node:test'
import assert from 'node:assert/strict'
import { validateBasicJob } from '../src/jobValidator.js'
const job={job_title:'Frontend Developer',description:'Build web UI',skills:['React'],application_email:'x@y.com',source_post_id:'1'}
test('basic validation does not classify career relevance',()=>{const r=validateBasicJob(job); assert.equal(r.is_job,true); assert.equal(r.should_match,true)})
test('rejects missing title/content',()=>{const r=validateBasicJob({application_email:'x@y.com'}); assert.equal(r.should_match,false)})
test('rejects missing application method',()=>{const r=validateBasicJob({...job,application_email:null}); assert.equal(r.has_application_method,false)})
test('deduplicates post ids',()=>{const s=new Set(); assert.equal(validateBasicJob(job,{seenPostIds:s}).is_duplicate,false); assert.equal(validateBasicJob(job,{seenPostIds:s}).is_duplicate,true)})
