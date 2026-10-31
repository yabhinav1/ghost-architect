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

## Sign in with GitHub

Click **Sign in with GitHub** on the landing page. The first time on a machine it goes to `/setup`, where one click creates a GitHub App called Ghost-Architect on your account (GitHub prefills everything from a manifest) and sends you straight into the login. The credentials land in `.cache/github-app.json` and `.env.local`. After that, every user signs in with their normal GitHub account and lands on the dashboard.

The dashboard lists every repository you can see. Private ones appear once the app is installed on them, which is the "Install on my repositories" button at the top of the dashboard, one click, pick "All repositories". Private repos are cloned with your token for that request only; the token lives in an encrypted, httpOnly cookie and is never written to disk.

If you already have an OAuth App, set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env.local` instead and `/setup` is skipped.

Routes: `/` landing, `/setup` one-time app creation, `/dashboard` your repos, `/r/owner/name` analysis, `/analyse` any public repo without signing in.

## Two modes

- **Notice period.** One engineer is leaving. Enter their git email and last day: you get their files ranked by what breaks if nobody picks them up, a suggested receiver per file (the still-here author with the largest share), one-click briefs for the top ten, a KT checklist with coverage percentage, and a countdown.
- **Layoffs.** Many people left at once. Paste the list or upload a CSV, see the blast radius on the heatmap, and watch knowledge-absorption curves for each departed author.

Both modes share the same engine and the same heatmap.

## Extras

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

## Deploy

The app shells out to `git` and writes to `.cache/`, so it needs a real filesystem: run it on a laptop, or on Railway, Fly, or Render with the included `Dockerfile`. It will not work on Vercel's serverless functions.

## Demo script

1. **Notice period mode.** Analyse `expressjs/express`, pick the top author as the leaver, set a last day two weeks out. Show the handover plan, the countdown, and the receiver per file. Hit **Generate briefs for the top 10** and let them stream in.
2. **Ask the ghost.** Open the reddest file and type a judge's question. Point at the evidence link or the "not documented" tag.
3. **Layoffs mode.** Click **top 3 authors leave**. The map turns red. Show the absorption curves.
4. **Live override.** Mark one author as still here and watch the map cool down.
5. **Time machine.** Drag the slider back a year to show the bus factor was already bad.
6. **Download CODEOWNERS** and open the report.

## Safety on a public host

- Repos over 300 MB (configurable with `MAX_REPO_MB`) are refused. The GitHub API's size field catches them before cloning; a watchdog on the clone itself kills anything that grows past the limit, so the guard holds even when the API is rate-limited.
- On a shared host like Render, set `GITHUB_TOKEN` to a fine-grained personal access token with public read access. Anonymous GitHub API calls share one 60/hour quota per IP, which other tenants exhaust; a token gives the server 5000/hour for size checks and PR evidence.
- `deploy/keepalive.yml` is a GitHub Actions workflow that pings the live site every 10 minutes so the free Render instance never sleeps before a demo. Copy it to `.github/workflows/` (GitHub requires the `workflow` permission to push that path, so do it from the GitHub web UI or your own terminal), or point a free UptimeRobot monitor at the site instead.
- `npm run warm -- --remote https://your-site` pre-analyses the sample repos on the live server.
- `npm test` runs 12 unit tests over scoring, receivers, CODEOWNERS, the time machine, absorption curves, and the portfolio summary.

## Honest limits

- `git blame` shows who last edited a line, not who understood it. We blend in 24 months of commit history and show both numbers, and a human can mark anyone as still here.
- History is read for the last 3 years only, which keeps huge repos tractable. Files untouched for longer show no last-touched date.
- Import graph covers relative imports in JS/TS and Python only. Other languages get a load-bearing factor of 1.
- Not on the roadmap for the hackathon: Slack and Jira context, full AST dependency maps, auto-generated tests.
