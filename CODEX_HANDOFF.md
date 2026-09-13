# Codex Handoff

## 1. Project overview

This project is a Node.js proof of concept that listens to one WhatsApp Newsletter/Channel, extracts job advertisements, validates their structure, retrieves relevant evidence from the candidate CV, and produces a candidate-fit decision.

The repository is private and contains no committed CV, WhatsApp session, `.env`, or API secrets.

## 2. Project goal

Current goal: prove and improve the pipeline:

WhatsApp Channel -> job extraction -> structural validation -> CV retrieval -> evidence-based candidate matching -> ACCEPT/REJECT.

Application generation, email sending, human approval, application tracking, LangGraph, vector databases, and other downstream automation are explicitly out of scope.

## 3. Current architecture / pipeline

1. Baileys authenticates a dedicated second WhatsApp account using persisted credentials in `auth/`.
2. The configured public Channel is resolved and followed.
3. New Newsletter messages are filtered to the configured Channel.
4. Supported post text/captions are parsed.
5. Groq/OpenAI-compatible structured extraction is attempted.
6. If the LLM request fails, deterministic extraction is used.
7. Structural validation checks whether the extracted object is usable.
8. The CV matcher retrieves relevant profile chunks and compares requirements against candidate evidence.
9. The terminal prints a concise job summary and final ACCEPT/REJECT decision.

## 4. GitHub repository

Remote: `https://github.com/samermagdy12/automated-applied-jobs.git`

Local project: `D:\automated applied jobs`

Current branch: `main`

The latest committed remote state before the current uncommitted iteration is commit `c7275b4`.

## 5. Important Git commits

- `a364cc7 feat: add job validation and filtering` — initial structural/job filtering milestone.
- `da2c8da feat: add job extraction pipeline` — deterministic extraction pipeline.
- `13a790d feat: improve job extraction with llm` — LLM extraction integration.
- `85dd868 fix: await job extraction result` — fixed asynchronous extraction handling.
- `07f0ace feat: add groq llm extraction` — Groq-compatible extraction configuration.
- `c7275b4 feat: add CV job matching` — candidate profile, lightweight retrieval/matching, structural validator refactor, tests, and documentation.

The latest extraction/matching improvements in the current working tree are intentionally uncommitted and must not be committed until reviewed.

## 6. Implemented milestones

Implemented:

- WhatsApp QR authentication and persisted Baileys auth.
- Public Channel resolution, follow, and live update listening.
- Newsletter post parsing.
- Historical/diagnostic modes developed during earlier debugging.
- Deterministic job extraction fallback.
- Groq structured extraction.
- Structural job validation.
- CV-derived candidate profile.
- Lightweight job-aware CV retrieval.
- Evidence-oriented candidate matching.
- Concise production CLI output.

Planned/not implemented:

- Application generation.
- Email sending.
- CV attachment handling.
- Human approval.
- Application tracking.
- LangChain/LangGraph workflow.
- Production vector database.
- Automated applications.

## 7. WhatsApp Channel architecture

The listener uses Baileys `7.0.0-rc14`.

Authentication uses QR-code linking, not pairing-code linking. Credentials persist in the ignored `auth/` directory and must not be deleted during normal reconnects.

The listener resolves/follows the public Channel after connection and listens for new Newsletter updates. Strict filtering is required so only the target Channel is processed.

The earlier diagnostic established that historical Newsletter fetches returned no decryptable messages (`requested: 20`, `decoded: 0`) and live notification metadata can contain only values such as `server_id`, `forwards_count`, and `reactions`. Actual new post content, when available, is handled through message events such as `messages.upsert`.

The warning `Unknown newsletter notification child` is protocol-level Baileys noise and must not be treated as the application pipeline failure.

## 8. Channel JIDs used for testing

Primary target Channel JID:

`120363427986007778@newsletter`

Public invite code configured in the application:

`0029Vb8LKeD7dmeV7rf9r338`

The human-readable Channel name observed in tests is `AI Jobs`.

## 9. Groq configuration and extraction model

The project uses an OpenAI-compatible chat-completions request. Provider selection is controlled by environment variables loaded through `dotenv`.

Relevant environment variables:

- `LLM_PROVIDER=groq`
- `LLM_API_KEY=<secret, never commit>`
- `LLM_MODEL` is configured in `.env`; earlier real tests used a Groq model compatible with the structured extraction request, including `openai/gpt-oss-20b` in tests.
- `MATCH_THRESHOLD=0.70` is documented in `.env.example` and defaults to `0.70` in the matcher.

The extractor sends a strict JSON-schema request with temperature `0`, then attaches source metadata and raw text in application code.

A real test showed intermittent `fetch failed`. The fallback must remain active. The current implementation catches extraction errors and returns deterministic fallback output with `extraction_mode: deterministic_fallback` and `extraction_error`.

## 10. Job extraction implementation

File: `src/jobExtractor.js`

Exports include:

- `extractJob`
- `extractJobWithLLM`
- `extractJobDeterministic`
- `validateJob`
- `JOB_FIELDS`

The structured schema contains title, company, location, employment type, experience level, skills, requirements, responsibilities, application email, application URL, description, and source metadata.

The deterministic fallback extracts labels such as `Position`, `Role`, `Job Title`, `Skills`, `Requirements`, `Responsibilities`, email addresses, and URLs. The latest working-tree iteration also attempts generic title cues (`seeking`, `looking for`, `hiring`) and company cues (`at COMPANY`, `@ COMPANY`, `Company:`, `Join COMPANY`).

Known historical fallback failures:

- `Dear Connections,` was incorrectly used as a title.
- `motivated Junior Data Scientist` retained the adjective.
- `Looking for a talented AI Engineer at Plexe AI` was not reliably split into title and company.
- Mojibake emoji/promotion text appeared in titles.

Generic cleanup was added, but live WhatsApp verification is still required.

## 11. Job validation implementation

File: `src/jobValidator.js`

`validateBasicJob(job, { seenPostIds })` is structural only. It checks:

- title and meaningful job content;
- application email or URL;
- duplicate `source_post_id` within the running process;
- deterministic completeness `quality_score`.

It returns fields including:

- `is_job`
- `has_application_method`
- `has_sufficient_information`
- `is_duplicate`
- `should_match`
- `quality_score`
- `reason`

Validation must not decide whether the candidate is suitable. Candidate suitability belongs exclusively to CV matching.

## 12. CV/profile implementation

Files:

- `data/Samer_CV.pdf` — sole source of truth, ignored by Git.
- `src/candidateProfile.js` — checked-in derived profile, not the PDF itself.

The CV facts explicitly represented include Python, C/C++, Java, TensorFlow, PyTorch, Keras, Scikit-learn, XGBoost, OpenCV, MediaPipe, YOLO, LLMs, Prompt Engineering, AI Agents, Function Calling, RAG, spaCy, Pandas, NumPy, Flask, Django, Streamlit, databases, and Git.

Experience represented:

- AI & Automation Intern at Exology: LLMs, AI Agents, RAG, MCP, tool integration, structured workflows, intelligent automation.
- Computer Vision Intern at Cellula: ML/CV, segmentation, TensorFlow, PyTorch, OpenCV, healthcare and flood mapping.
- AI & Data Science Trainee at DEPI: Python, ML, deep learning, NLP, CV, YOLO, Scikit-learn, XGBoost.
- Machine Learning Engineer Intern at Cellula: classification/regression, Flask, Django, MLOps, REST APIs.

Projects represented include Claims Automation using LLMs/RAG/agents, EyeDrive CNN/SVM, AI Data Analytics Assistant using LLM/function calling, gesture recognition, Arabic sign language, vehicle detection, and FaceNet recognition.

Do not invent Excel, SQL, Power BI, LangChain, LangGraph, LlamaIndex, Docker, vector database, or other unsupported skills.

## 13. CV retrieval implementation

File: `src/cvMatcher.js`

`retrieveCandidateContext(job, profile)` scores profile chunks by job concept overlap and returns a small ranked context window.

The retrieval is intended to be job-aware:

- AI/LLM/RAG jobs should prioritize Exology, Claims Automation, AI Data Analytics Assistant, LLM/RAG/agent evidence.
- Computer vision jobs should prioritize Cellula CV, EyeDrive, sign language, vehicle detection, OpenCV, YOLO, MediaPipe, CNN.
- ML/Data Science jobs should prioritize Cellula ML, DEPI, ML projects, Python, TensorFlow, PyTorch, XGBoost.
- Web/full-stack jobs should retrieve only genuinely relevant Flask/Django/MLOps/API evidence.

## 14. Job/CV matching implementation

Current matcher output includes:

- `match_score`
- `decision`
- `matched_skills` with `skill`, `match_type`, and evidence
- `partial_skills` for compound requirements
- `missing_skills`
- `relevant_experience`
- `relevant_projects`
- `reason`
- `retrieved_context`

The current working-tree matcher distinguishes `exact`, `semantic`, `partial`, and `missing` states. Examples intended by design:

- `Generative AI & LLMs` -> semantic match to Large Language Models.
- `RAG Pipelines` -> match to RAG.
- `FastAPI/Flask` -> partial/Flask-supported, FastAPI unsupported.
- `Git & Docker` -> partial/Git-supported, Docker missing.
- `LangGraph`, `LlamaIndex`, vector databases, Docker, Power BI, and SQL remain missing unless explicit CV evidence exists.

Compound requirements must never be reported as both fully matched and missing component-by-component. If only part is supported, classify it as partial.

## 15. MATCH_THRESHOLD and scoring behavior

`MATCH_THRESHOLD` defaults to `0.70`.

The current working-tree score uses a transparent weighted combination of:

- required requirement coverage;
- concept-group evidence coverage;
- retrieved CV evidence depth.

The score is capped below 1.0 (`0.98`) so a strong but imperfect candidate is not automatically displayed as 100%.

The exact current representative results after the latest local iteration were:

- AI Engineer: `0.83`, `ACCEPT`.
- Junior Data Scientist: approximately `0.98`, `ACCEPT`.
- Data Analyst with Power BI/Excel/SQL: low/rejected; unsupported Power BI, Excel, and SQL are not invented.
- Junior Full-Stack Developer with JavaScript/HTML/CSS: `0`, `REJECT`.

Earlier real results before these improvements included:

- AI Engineer: `0.73`, `ACCEPT`, but semantic duplicates were incorrectly shown as missing.
- Junior Data Scientist: `1.00`, `ACCEPT`, considered too aggressive.
- Data Analyst: `0.16`, `REJECT`, with polluted missing lists containing full sentences.
- Full-Stack: JavaScript was matched while HTML/CSS were also listed missing, which was logically inconsistent.
- A separate runtime bug previously stopped after extraction/validation because matcher output was missing; that was fixed in `src/index.js`.

## 16. Real WhatsApp test results

The account successfully authenticated, connected, resolved/followed the target Channel, subscribed to live updates, received a real Channel post, and Groq extraction worked.

The earlier runtime output showed extraction followed by no validation/matching output. Investigation found `src/index.js` called `validateBasicJob` but then stopped; `matchJobToProfile(job)` and final decision printing were missing. The minimal integration block was then restored.

The latest real quality test exposed the scores and contradictions documented above. No real WhatsApp test was run after the latest working-tree matcher/extractor changes. A new live verification is still required.

## 17. Known bugs and problems

- Groq occasionally fails with `fetch failed`; fallback works, but timeout/retry behavior has not been deeply improved.
- Real runtime verification of the latest matcher/extractor changes has not yet been performed.
- Some source files historically suffered UTF-8/mojibake artifacts from Windows shell edits. Normal job output was changed to ASCII-safe labels, but diagnostic/test-only legacy strings may still contain corrupted text.
- `Unknown newsletter notification child` may still appear if emitted directly by Baileys; it should not be treated as application output or protocol failure.
- The checked-in candidate profile is derived from the CV; the PDF is not loaded dynamically at runtime.
- The matcher remains lightweight/in-memory retrieval, not embeddings or a production vector store.
- The latest code has uncommitted edits and must be reviewed before commit.

## 18. Exact latest matching failures / issues to preserve

The next Codex must not lose these requirements:

1. Do not report a semantic duplicate as missing.
2. Do not report a compound requirement as exact when only one component is supported.
3. Do not classify soft skills such as analytical/problem-solving as technical missing skills.
4. Do not classify years-of-experience or education sentences as missing technical skills.
5. Do not produce `Matched: None` when retrieved evidence clearly supports the role.
6. Do not give Junior Data Scientist an unjustified perfect score.
7. Do not infer Excel, SQL, Power BI, Docker, LangChain, LangGraph, LlamaIndex, or vector databases without CV evidence.
8. Do not use job title keywords as a substitute for candidate evidence.

## 19. CLI/logging problems

The previous CLI printed raw extraction/matching JSON and corrupted emoji strings such as `Ãƒ...`. This was cleaned in the working tree to concise ASCII-safe output:

- `NEW JOB DETECTED`
- title/company/location/application method
- `[1] JOB VALIDATION`
- `[2] CV MATCHING`
- score, decision, matched, missing, relevant evidence, reason
- final decision

Normal output must not dump raw text, source IDs, source channel, retrieved context, or internal API/debug objects. Detailed JSON should only be used in an explicit diagnostic mode if needed.

## 20. What has already been fixed

- QR authentication flow and persisted auth were implemented earlier.
- Pairing-code flow was removed/disabled.
- Newsletter target filtering and listener behavior work.
- Structural validation was separated from candidate matching.
- Missing matcher integration in `src/index.js` was restored.
- Semantic aliases and partial compound matching were added.
- Deterministic title fallback was improved.
- Candidate evidence is required for matching.
- Normal CLI output was made concise/ASCII-safe.
- Regression tests increased from 17 to 21 and currently pass.

## 21. What must NOT be changed

Do not change:

- WhatsApp authentication or QR behavior.
- `auth/` contents or session data.
- Target Channel configuration/JID.
- Baileys protocol handling unless a separately approved task requires it.
- The Groq extraction contract unnecessarily.
- The CV source of truth.
- `.env` secrets.
- The structural-only role of validation.
- The existing production duplicate protection.
- Any downstream features not requested.

Do not commit the CV, `.env`, auth credentials, API keys, or `node_modules`.

## 22. Current task / next objective

Next objective: run a careful review and one real WhatsApp verification of the latest uncommitted extraction/matching/CLI changes. Confirm that representative live posts produce correct title/company extraction, relevant evidence, exact/semantic/partial/missing sections, calibrated score, and concise output.

Do not commit or push until the user reviews the results and explicitly requests it.

## 23. Testing requirements

Before reporting completion, run:

```powershell
npm.cmd run check
npm.cmd test
```

The latest successful local result is:

- syntax check passed;
- 21 tests passed, 0 failed.

Also inspect:

```powershell
git diff
git status
```

Real WhatsApp verification should cover:

- AI Engineer / LLM / RAG
- Junior Data Scientist
- Computer Vision / ML
- Data Analyst
- Junior Full-Stack

## 24. Git/commit/push rules

Do not commit or push during the current review iteration.

When the user later approves a commit:

- commit only the focused milestone;
- do not force-push;
- push to `origin/main`;
- keep `data/`, `.env`, `auth/`, and `node_modules/` ignored;
- verify `git status`, `git log`, and `git remote -v` afterward.

## 25. Important files

- `src/index.js` — WhatsApp event handling, extraction, validation, matching, CLI output.
- `src/whatsapp.js` — Baileys socket/authentication/reconnect behavior.
- `src/channel.js` — Channel resolution/follow/history operations.
- `src/messageParser.js` — text/caption extraction, Newsletter filtering, timestamps.
- `src/jobExtractor.js` — Groq/OpenAI-compatible extraction and deterministic fallback.
- `src/jobValidator.js` — structural validation only.
- `src/candidateProfile.js` — CV-derived candidate facts and chunks.
- `src/cvMatcher.js` — retrieval, semantic/partial matching, scoring, decision.
- `test/jobExtractor.test.js` — extraction/fallback tests.
- `test/cvMatcher.test.js` — matching/calibration tests.
- `test/jobValidator.test.js` — structural validation tests.
- `test/messageParser.test.js` — WhatsApp message parsing tests.
- `.env.example` — safe configuration template.
- `.gitignore` — protects secrets, auth, dependencies, and `data/`.
- `README.md` — project usage and milestone documentation.
- `data/Samer_CV.pdf` — local private CV, ignored and never committed.

## 26. Architectural decisions

- QR authentication is used because the second phone did not expose pairing-code linking.
- Auth credentials persist across reconnects; valid auth is not deleted automatically.
- Newsletter metadata notifications are not treated as post content.
- The listener processes only the configured target Newsletter.
- Historical Channel retrieval was tested but returned zero decoded posts in the installed Baileys version; the goal shifted to proving live post delivery.
- Validation and candidate matching are intentionally separate.
- Candidate facts must come only from the CV; unsupported skills must remain missing.
- Lightweight deterministic retrieval is acceptable for this milestone; no external vector database is used.
- LLM extraction is optional and mockable; deterministic fallback is mandatory.
- Human-readable CLI output is preferred over raw internal JSON in production mode.