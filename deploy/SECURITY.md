# Security checklist

## Secrets that must be rotated after the hackathon
Anything that was ever pasted into a chat, screenshot, or shared document is compromised by definition.

- **Groq API key** (`LLM_API_KEY`): regenerate at https://console.groq.com/keys, update `.env.local` and Render.
- **GitHub personal access token** (`GITHUB_TOKEN`): regenerate at https://github.com/settings/personal-access-tokens, update `.env.local` and Render.
- **OAuth App client secret** (`GITHUB_CLIENT_SECRET`): regenerate at https://github.com/settings/developers, update Render.
- **"GitHub CLI" authorization** used for pushes: revoke under GitHub Settings → Applications → Authorized OAuth Apps.
- **`AUTH_SECRET`**: rotating it signs every user out, which is fine; set a new random string on Render.

## What the app does with credentials
- A user's GitHub token lives only in an AES-256-GCM encrypted, httpOnly cookie. It is used per request to clone private repos and is never written to disk or logs.
- The server's `GITHUB_TOKEN` needs public read access only. If a token is accidentally placed in `GITHUB_CLIENT_SECRET`, the app still uses it for API quota but sign-in will fail until the real secret is restored; `/api/health` says exactly which variable is wrong.
- `.env.local`, `.cache/` and `deploy/*.local` are gitignored. Never commit them.

## Runtime protections
- Private repositories are only served to accounts whose own token can read them, on every endpoint.
- Per-IP rate limits on model and analysis endpoints, plus a server-wide ceiling as a backstop.
- Repositories over `MAX_REPO_MB` (default 300) are refused before and during clone.

## Verify a deployment
`npm run doctor -- https://your-site` prints the health report: OAuth pair valid, token quota, model configured, durable store on or off.
