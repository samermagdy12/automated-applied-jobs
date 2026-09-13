import test from 'node:test'
import assert from 'node:assert/strict'
import { extractPostText, isNewsletterJid, selectMostRecentPost } from '../src/messageParser.js'
import { proto } from 'baileys'
import { decodeNewsletterHistoryResponse } from '../src/channel.js'

test('extracts text and media captions', () => {
  assert.equal(extractPostText({ conversation: 'text post' }), 'text post')
  assert.equal(extractPostText({ imageMessage: { caption: 'image caption' } }), 'image caption')
  assert.equal(extractPostText({ videoMessage: { caption: 'video caption' } }), 'video caption')
})

test('unwraps ephemeral messages and identifies newsletter JIDs', () => {
  assert.equal(extractPostText({ ephemeralMessage: { message: { extendedTextMessage: { text: 'wrapped' } } } }), 'wrapped')
  assert.equal(isNewsletterJid('123@newsletter'), true)
  assert.equal(isNewsletterJid('123@s.whatsapp.net'), false)
})

test('selects the newest historical post', () => {
  const oldest = { messageTimestamp: 100, key: { id: 'old' } }
  const newest = { messageTimestamp: 200, key: { id: 'new' } }
  assert.equal(selectMostRecentPost([oldest, newest]).key.id, 'new')
})

test('decodes an actual Baileys Newsletter history message payload', () => {
  const payload = proto.WebMessageInfo.encode(proto.WebMessageInfo.create({
    key: { id: 'inner-id' },
    messageTimestamp: 123,
    message: { conversation: 'historical Channel text' },
  })).finish()
  const response = {
    tag: 'iq', attrs: {}, content: [{
      tag: 'message_updates', attrs: {}, content: [{
        tag: 'message', attrs: { server_id: '456', t: '123' }, content: payload,
      }],
    }],
  }
  const [post] = decodeNewsletterHistoryResponse(response, '120363427986007778@newsletter', { warn() {} })
  assert.equal(post.key.remoteJid, '120363427986007778@newsletter')
  assert.equal(post.newsletterServerId, '456')
  assert.equal(extractPostText(post.message), 'historical Channel text')
})
