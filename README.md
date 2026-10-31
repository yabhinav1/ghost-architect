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

## How it works

1. `POST /api/analyze` clones the repo into `.cache/repos/`, picks the 250 most-changed code files, runs `git blame` on each to get line ownership, counts commits in the last 12 months, and builds a relative-import graph. Result is cached in `.cache/analysis/`.
2. The browser computes the **Orphaned Criticality Score** per file from the departed list, so toggling a person updates the heatmap instantly:

   `orphanShare = 0.6 × blameShare + 0.4 × commitShare`
   `OCS = orphanShare × log(1 + commits12m) × (1 + importers)`

   Blame share is the fraction of lines last touched by departed authors. Commit share is their fraction of commits in the last 24 months. Blending the two means one formatting commit cannot flip a file's ownership.

3. `POST /api/explain` pulls the last 25 commits for a file plus any linked GitHub PRs, and asks the LLM for a brief where every claim cites a commit or PR ID. Claims without evidence are marked *inferred*; decisions nothing explains go under *reason not documented*.
4. Every brief is cached under `.cache/briefs/`, and `/report?repo=…&departed=…` is a printable one-pager that includes any briefs already generated for the top files.

## Before the demo

```bash
npm run warm                                  # pre-analyse the three sample repos
npm run warm -- https://github.com/org/repo   # or your own
```

Clones and analysis are cached in `.cache/`, so after warming, the stage demo only touches the network for the LLM brief and PR lookups.

## Deploy

The app shells out to `git` and writes to `.cache/`, so it needs a real filesystem: run it on a laptop, or on Railway, Fly, or Render with the included `Dockerfile`. It will not work on Vercel's serverless functions.

## Demo script

1. Analyse `expressjs/express`. Click **top 3 authors leave**.
2. Click the reddest tile. Show the three factors and who touched it.
3. Hit **Why does this code exist?** and point at the evidence links.
4. Click **mark as still here** on one author and watch the map cool down.
5. Open the report and print to PDF.

## Honest limits

- `git blame` shows who last edited a line, not who understood it. We blend in 24 months of commit history and show both numbers, and a human can mark anyone as still here.
- History is read for the last 3 years only, which keeps huge repos tractable. Files untouched for longer show no last-touched date.
- Import graph covers relative imports in JS/TS and Python only. Other languages get a load-bearing factor of 1.
- Not on the roadmap for the hackathon: Slack and Jira context, full AST dependency maps, auto-generated tests.
