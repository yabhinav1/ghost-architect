# Ghost-Architect

Bus-factor radar for codebases that lost their authors. Paste a public GitHub repo and a list of departed engineers; get a heatmap of the files nobody understands anymore, an evidence-backed brief on why each one exists, and a one-page report for a manager.

## Run it

```bash
cp .env.example .env.local   # add a free Groq or Gemini key
npm install
npm run dev                  # http://localhost:3000
```

The LLM is only used for the "why does this code exist" brief. Everything else is plain git. All supported providers have a free tier:

| Provider | Key | Env |
| --- | --- | --- |
| Groq (default, fastest) | https://console.groq.com/keys | `LLM_BASE_URL=https://api.groq.com/openai/v1`, `LLM_MODEL=openai/gpt-oss-120b` |
| Google Gemini | https://aistudio.google.com/apikey | `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, `LLM_MODEL=gemini-2.0-flash` |
| Ollama (offline) | none | `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_API_KEY=ollama`, `LLM_MODEL=llama3.1` |

Optional: set `GITHUB_TOKEN` so PR lookups get 5000 requests/hour instead of 60.

Repository URLs must use HTTPS on `github.com`. Other hosts and custom ports are rejected. Use the current repository URL after a rename; authenticated git requests do not follow redirects.

## Sign in with GitHub

Click **Sign in with GitHub** on the landing page. The first time on a machine it goes to `/setup`, where one click creates a GitHub App called Ghost-Architect on your account (GitHub prefills everything from a manifest) and sends you straight into the login. The credentials land in `.cache/github-app.json` and `.env.local`. After that, every user signs in with their normal GitHub account and lands on the dashboard.

The dashboard lists every repository you can see. Private ones appear once the app is installed on them, which is the "Install on my repositories" button at the top of the dashboard, one click, pick "All repositories". Private repos are cloned with your token for that request only; the token lives in an encrypted, httpOnly cookie and is never written to disk.

If you already have an OAuth App, set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env.local` instead and `/setup` is skipped.

Production sign-in requires `AUTH_SECRET` (a long random value) or `GITHUB_CLIENT_SECRET`; there is no built-in fallback secret. The Render blueprint generates `AUTH_SECRET` automatically. For local development without either value, sessions use a random key and expire when the server restarts. `/api/health` reports missing production session configuration.

Routes: `/` landing, `/setup` one-time app creation, `/dashboard` your repos, `/r/owner/name` analysis, `/analyse` any public repo without signing in.

## Three roles

Sign in from the menu at the top right of the landing page as a **User**, an **Organisation**, or an **Admin**. One GitHub account can hold all three; the choice only decides where you land.

| Role | Who | Sees | Does |
| --- | --- | --- | --- |
| User | An engineer | Own repos, own inbox, handovers where they are the leaver or the receiver | Analyses repos, records notes and links per file during a handover, ticks files off, acknowledges notices |
| Organisation (owner, manager) | The company | Members with GitHub login, name and git email; linked repos; the activity log of every commit matched to a member; notices and their read/acknowledge status; handover progress; audit log | Links repos, invites engineers, sets who is leaving and their last day, sends notices and letters from templates, assigns handovers from a leaver to a receiver, grants or revokes support access |
| Admin | The people running Ghost-Architect (`ADMIN_LOGINS`) | Platform metrics, health, model lanes, every organisation's existence and settings, platform audit | Nothing inside an organisation unless its owner has switched on support access, which is audited |

Routes: `/org` your organisations, `/org/<slug>` overview, `/org/<slug>/activity`, `/org/<slug>/notices`, `/org/<slug>/handovers`, `/org/<slug>/settings`, `/me` inbox and handovers, `/invite/<token>` join, `/letter/<id>` printable notice, `/admin`.

Records (organisations, members, invites, notices, handovers, audit) are JSON documents under `.cache/db/`, mirrored to Upstash when configured.

Organisation records and their indexes do not expire in Upstash. Startup repairs missing indexes from surviving local records and removes the old expiry from discoverable records. Partial recovery merges local and remote indexes. Configured durable-store failures are reported instead of silently claiming a successful save. This document store supports a single application server; multiple replicas need a shared transactional database. Data already lost from both local storage and Redis cannot be recovered by this repair.

## Accounts and access

Ghost-Architect is multi-user. Each GitHub account gets:

- **Private history.** "Recently analysed" on the dashboard is yours alone.
- **Saved scenarios per repo.** The departed list, who is leaving and their last day, "still here" overrides, and KT checklist ticks are saved to your account the moment you change them, and come back on any device. The repo header shows "Saved to your account".
- **Access checks everywhere.** A private repository's analysis, briefs, assistant answers, PR checks, reports and share links are only served to accounts whose GitHub token can read it. Anonymous visitors can analyse public repositories only. Shared analysis caches of public repos are reused across users; scenarios never are.
- **Settings** at `/settings`: account, what is stored, and a one-click "clear my data".

## Two modes

- **Notice period.** One engineer is leaving. Enter their git email and last day: you get their files ranked by what breaks if nobody picks them up, a suggested receiver per file (the still-here author with the largest share), one-click briefs for the top ten, a KT checklist with coverage percentage, and a countdown.
- **Layoffs.** Many people left at once. Paste the list or upload a CSV, see the blast radius on the heatmap, and watch knowledge-absorption curves for each departed author.

Both modes share the same engine and the same heatmap.

## Extras

- **Casper, the in-page assistant.** A mascot button on every repo page. He knows the app and the repo, reads any file you ask about before answering, streams replies, and pops up to offer an explanation when you open a red file.
- **Guided tour.** Five spotlight steps on the first visit to a repo page: heatmap, modes, who is leaving, the file panel, Casper. Replay from the Tour button in the repo header.
- **PR risk check.** Paste a pull request number or link: which of its files are orphaned, their scores, and who should review each one instead.
- **Heatmap PNG.** One button renders the treemap with title and legend to a PNG for a deck or a message.
- **Per-file sparkline.** Twelve months of commits in the file panel, with departed authors' commits in red.

- **Risk across your repositories.** The dashboard scans your most recent non-fork repos and shows a tile per repo: bus factor, top owner share, fragile files, and the riskiest path, each labelled fragile, watch, or healthy. One click into the full heatmap.
- **Handover export.** The handover plan downloads as Markdown, with the generated briefs and evidence links, ready for Notion, Confluence, or a PR description.

- **Ask the ghost.** A question box on any file that answers only from that file's commits and PRs, cites evidence IDs, and says "not documented" when nothing explains it.
- **Time machine.** A slider under the heatmap that rescores the repo as of any month in the last 30 months, from commit timelines (blame is not available for the past, so it is labelled commit-based).
- **Knowledge absorption.** For each departed author, the share of their files someone else has edited in the months since their last commit. Flat and low means the knowledge is rotting.
- **CODEOWNERS download.** Proposes a still-here owner for every file with score 30 or above. GitHub accepts email addresses in CODEOWNERS.
- **Share link.** Copies a URL that re-runs the same analysis with the same departed list or leaver, so a judge can open it on their own phone.

## How it works

1. `POST /api/analyze` clones the repo into `.cache/repos/`, picks the 250 most-changed code files, runs `git blame` on each to get line ownership, reads 3 years of history for per-file commit timelines, and builds a relative-import graph. Progress streams back as NDJSON. Result is cached in `.cache/analysis/`.
2. The browser computes the **Orphaned Criticality Score** per file from the departed list, so toggling a person updates the heatmap instantly:

   `orphanShare = 0.6 × blameShare + 0.4 × commitShare`
   `OCS = orphanShare × log(1 + commits12m) × (1 + importers)`

   Blame share is the fraction of lines last touched by departed authors. Commit share is their fraction of commits in the last 24 months. Blending the two means one formatting commit cannot flip a file's ownership.

3. `POST /api/explain` pulls the last 25 commits for a file plus any linked GitHub PRs, and asks the LLM for a brief where every claim cites a commit or PR ID. Claims without evidence are marked *inferred*; decisions nothing explains go under *reason not documented*.
4. `POST /api/explain-batch` streams briefs for several files in sequence, and `POST /api/ask` answers one question about one file under the same evidence rules.
5. Every brief is cached under `.cache/briefs/`, and `/report?repo=…&departed=…` is a printable one-pager that includes any briefs already generated for the top files.

## Before the demo

```bash
npm run warm                                  # pre-analyse the three sample repos
npm run warm -- https://github.com/org/repo   # or your own
```

Clones and analysis are cached in `.cache/`, so after warming, the stage demo only touches the network for the LLM brief and PR lookups.

The refresh button fetches the latest default branch before recalculating the analysis. If fetching fails, it reports an error and keeps the previous analysis. `GHOST_CACHE_DIR` can move runtime data to a persistent volume; it defaults to `.cache/`. Runtime data is excluded from lint, TypeScript checks and production file tracing.

## Deploy

The app shells out to `git` and writes to `.cache/`, so it needs a real filesystem: run it on a laptop, or on Railway, Fly, or Render with the included `Dockerfile`. It will not work on Vercel's serverless functions.

## Demo script

1. **Notice period mode.** Analyse `expressjs/express`, pick the top author as the leaver, set a last day two weeks out. Show the handover plan, the countdown, and the receiver per file. Hit **Generate briefs for the top 10** and let them stream in.
2. **Ask the ghost.** Open the reddest file and type a judge's question. Point at the evidence link or the "not documented" tag.
3. **Layoffs mode.** Click **top 3 authors leave**. The map turns red. Show the absorption curves.
4. **Live override.** Mark one author as still here and watch the map cool down.
5. **Time machine.** Drag the slider back a year to show the bus factor was already bad.
6. **Download CODEOWNERS** and open the report.

## Operating it

- **Self-warming.** On server start the app analyses the sample repos in the background (`WARM_REPOS` to change the list, `WARM_BRIEFS=5` to pre-write briefs too, `WARM_ON_BOOT=0` to disable), so a fresh deploy on an ephemeral disk is demo-ready in a few minutes without anyone touching it.
- **Health check.** `/api/health` (or `npm run doctor -- https://your-site`) validates the OAuth pair against GitHub, checks the server token and its quota, and reports the model and durable store, without revealing any values. Every credential error in the app links to it.
- **Self-healing config.** If the host's `GITHUB_CLIENT_SECRET` is wrong or contains a personal access token, sign-in falls through to the one-click `/setup` instead of failing, and a misplaced token is still used for API quota.
- **Throughput.** Briefs run across model lanes: the primary model plus `LLM_MODELS` on the same key, and an optional second provider via `LLM2_*`. Free tiers limit tokens per minute per model, so two lanes roughly double batch speed; single briefs always use the primary model.
- **History window.** `HISTORY_YEARS` (default 4) bounds the one-pass git log; files untouched for longer still get a last-touched date from a per-file lookup.
- **Import graph** follows intra-repo imports in JavaScript/TypeScript (relative and tsconfig aliases), Python, Go, Java/Kotlin/Scala, Rust, Ruby, C/C++, PHP and Dart.

## Safety on a public host

- Rate limits: 30 model calls and 10 analyses per 10 minutes per anonymous address, three times that per signed-in account, plus a server-wide ceiling so spoofed addresses cannot multiply the quota. Over the limit returns a clear 429 instead of silently burning the free LLM quota.
- Optional durable cache: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (free tier) and analyses and briefs survive redeploys on hosts with an ephemeral disk. Without them the local `.cache/` is the only store.

- Repos over 300 MB (configurable with `MAX_REPO_MB`) are refused. The GitHub API's size field catches them before cloning; a watchdog on the clone itself kills anything that grows past the limit, so the guard holds even when the API is rate-limited.
- On a shared host like Render, set `GITHUB_TOKEN` to a fine-grained personal access token with public read access. Anonymous GitHub API calls share one 60/hour quota per IP, which other tenants exhaust; a token gives the server 5000/hour for size checks and PR evidence.
- `deploy/keepalive.yml` is a GitHub Actions workflow that pings the live site every 10 minutes so the free Render instance never sleeps before a demo. Copy it to `.github/workflows/` (GitHub requires the `workflow` permission to push that path, so do it from the GitHub web UI or your own terminal), or point a free UptimeRobot monitor at the site instead.
- `npm run warm -- --remote https://your-site` pre-analyses the sample repos on the live server.
- `npm test` covers scoring, access rules, imports, repository URL validation, session encryption, durable-record recovery and expiry, and refreshing a real temporary Git repository. `npm run lint` and `npm run build` check the application separately from downloaded repository contents.

## Honest limits

- `git blame` shows who last edited a line, not who understood it. We blend in 24 months of commit history and show both numbers, and a human can mark anyone as still here.
- The import graph counts intra-repo imports only; dynamic imports, build-time aliases beyond tsconfig, and framework magic are not followed.
- Not on the roadmap for the hackathon: Slack and Jira context, full AST dependency maps, auto-generated tests.
