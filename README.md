# WhatsApp Channel Listener POC

This Node.js proof of concept links a **dedicated, second WhatsApp number**, follows one public WhatsApp Channel (called a *Newsletter* internally), and prints new text/image/video-caption posts from that Channel only. It neither sends messages nor handles normal chats.

## Important limitations

This uses the maintained upstream [`baileys`](https://github.com/WhiskeySockets/Baileys) package, pinned to `7.0.0-rc14` after checking its current Newsletter API. It provides `newsletterMetadata('invite', code)`, `newsletterFollow(jid)`, `subscribeNewsletterUpdates(jid)`, `newsletterFetchMessages(...)`, and the `messages.upsert` event used here. Baileys is an unofficial WhatsApp Web implementation, so WhatsApp changes can break it or restrict the linked account. Use only your dedicated number and comply with WhatsApp's terms.

There has been a reported upstream issue with rapid consecutive Newsletter posts being coalesced in `messages.upsert`. This POC filters and deduplicates live events and fetches a recent window when it starts, but it cannot promise lossless delivery during a WhatsApp/Baileys outage. Treat it as a POC and monitor logs.

## Windows setup

1. Install Node.js **20 or later** (Node 22 LTS is a good choice). Verify with `node --version`.
2. In PowerShell, open this project folder and run `npm.cmd install`. (`npm.cmd` avoids a common PowerShell execution-policy issue with `npm.ps1`.)
3. Copy `.env.example` to `.env`. QR authentication is the only supported authentication method in this POC; any old `AUTH_METHOD` or `SECOND_WHATSAPP_NUMBER` entries can be removed from `.env` because they are no longer used.
4. Start it with `npm.cmd start`.

## Authenticate the second number with QR

Run the app and scan the rendered terminal QR code on the **second phone**: **WhatsApp > Settings > Linked devices > Link a device**. Do not use your primary number. The terminal automatically renders a replacement whenever the code expires. Credentials are saved under `auth/`; later launches reuse them without another scan.

## Verify and test

When authentication succeeds, expect logs similar to:

```text
Channel resolved  { channel: 'AI Jobs', jid: '...@newsletter' }
Followed Channel
Listening for new posts from: AI Jobs (...@newsletter)
```

Open the Channel in the second account to confirm the **Following** state. Then wait for a new post. Only a new text post, or an image/video post with a caption, from the configured Channel prints as `ðŸš€ NEW AI JOB DETECTED`. Posts already present at startup are intentionally ignored.

### Historical-post test mode

To verify the history-to-parser path without waiting for a new post, set `TEST_MODE=true` in `.env` and start the listener. After the Channel resolves, the listener calls Baileys' `newsletterFetchMessages(jid, count)` API for a small window and decodes its raw `message_updates > message` payloads as `WebMessageInfo`. It also captures history-sync events as a fallback. It accepts only `120363427986007778@newsletter`, prints the newest decoded post as `ðŸ§ª HISTORICAL CHANNEL POST TEST`, then continues normal live listening. Set `TEST_MODE=false` for normal production behavior.

### New-post diagnostic mode

Set `NEWSLETTER_DIAGNOSTIC=true` in `.env` and run the listener. The program logs relevant `messages.upsert`, `newsletter.reaction`, `newsletter.view`, participant, and settings events strictly for `120363427986007778@newsletter`. Publish one text or captioned image/video post in the AI Jobs Channel. If actual content arrives, it prints `ðŸ§ª NEW CHANNEL POST TEST`; otherwise the diagnostic shows the metadata-only event and its structure. Set it back to `false` afterward.

## Troubleshooting

- **`npm` is blocked by execution policy:** use `npm.cmd`, as in the commands above.
- **QR does not scan or was rejected:** wait for the next automatically rendered QR. If a previous incomplete attempt remains, stop the app and run `Remove-Item -Recurse -Force .\auth` from this project directory, then start it again. This removes only this project's local session for the dedicated number.
- **Logged out / bad credentials:** stop the process, delete the local `auth` folder, and authenticate the dedicated number again. Never commit or share that folder.
- **Channel resolution fails:** verify `CHANNEL_INVITE_CODE` is exactly the code from the public Channel URL and that the account can open that Channel in WhatsApp.
- **No posts appear:** leave the process running, make sure it says `Listening`, and test with a post made after startup. The app purposely ignores chat traffic and old Channel history.

## Local validation

Run `npm.cmd run check` for syntax and `npm.cmd test` for parser tests. Channel authentication and live post receipt require the user's second WhatsApp account, so they must be completed interactively.

## Job extraction milestone

The current flow is: WhatsApp Channel â†’ listener â†’ local schema-validated Job Extraction â†’ terminal JSON. New posts with text or captions are parsed into `job_title`, company/location/employment fields, skills, requirements, responsibilities, application email/URL, description, source identifiers, and the original `raw_text`. Missing facts remain `null` or empty arrays; no external LLM or API key is required. Set `TEST_MODE=false` and `NEWSLETTER_DIAGNOSTIC=false` for normal listening, then run `npm.cmd start`. Tests run with `npm.cmd test`.

## Improved Job Extraction

New posts now use an OpenAI-compatible structured-output request when LLM_API_KEY is configured. Set LLM_PROVIDER=openai, LLM_MODEL (default gpt-4o-mini), and LLM_API_KEY in the ignored .env. The model receives a strict schema and must return only supported facts; WhatsApp source metadata and raw text are attached by the application. If the key is missing, the provider fails, or the response is invalid, the deterministic extractor runs and the raw post is preserved with extraction_mode=deterministic_fallback and an error reason. Unit tests inject a fake structured response and never call the network. Run 
pm.cmd test for tests; to run a real extraction, configure the variables and publish a new Channel post.

