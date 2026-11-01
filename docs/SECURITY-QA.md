# Security: what to say when judges ask

Short, true answers. Do not overclaim; the honest gaps are listed at the end and are fine to say out loud.

## "What database do you use and what is in it?"

There is no SQL database and there are no passwords anywhere in the system. Records are JSON documents in a document store on the server (`.cache/db/`): organisations, members, invites, notices, handovers, work handoffs, audit entries. Optionally they are mirrored to Upstash Redis over TLS so they survive redeploys. Repository analyses and file briefs are cached the same way.

What is in there: GitHub logins and display names, the git email a member chose to match commits (already public in git history), notice text, handover notes and links, quiz questions and attempts, and an audit trail. Nothing a user typed as a password, because there is none.

## "How do you log people in?"

GitHub OAuth only. The user signs in on github.com; GitHub sends us a code; we exchange it server-side for a token. We never see or store a password, and GitHub's own 2FA applies.

## "Where is the GitHub token kept?"

In the user's browser, not on our server. The token is sealed with AES-256-GCM using a server secret and set as an httpOnly, Secure, SameSite=Lax cookie. The server only has the token while it is handling that user's request. There is no table of user tokens to leak.

The one exception is deliberate: when a sender chooses "add them as collaborator" or "transfer ownership" on a work handoff, their token is sealed with the same AES-256-GCM key and kept on that handoff record until the recipient accepts. It is used once, then deleted; it is also deleted on decline or cancel, and it expires after seven days. In production this requires `AUTH_SECRET` to be set or the feature refuses to run.

## "If your storage leaked, what would an attacker get?"

Names, logins, git emails, notice and handover text, and audit entries. They would not get passwords (none exist), user GitHub tokens (not stored), or the sealed handoff tokens in usable form (AES-256-GCM, key lives only in the host environment, never in the store). Private source code is not stored in the database; clones live on disk and are read per request with the viewer's own access.

## "Do you hash sensitive data?"

Hashing is for passwords, and we have none. For secrets that must be read back (GitHub tokens) hashing is the wrong tool, so we use authenticated encryption, AES-256-GCM with a random nonce and an auth tag, keyed from `AUTH_SECRET`. Notice text and handover notes are stored as written so managers can read them; they are business text, not credentials. (See gaps.)

## "Can one organisation see another's data?"

No. Every organisation route checks membership on every request. Managers see their organisation; members see only their own notices and handovers. Platform admins cannot open an organisation unless its owner switches on "support access" in settings, and every admin action inside it is written to the audit log with the admin's login.

## "Can someone read a private repository through you?"

No. Every endpoint that touches a repository calls the same authorisation function with the viewer's own GitHub token: if GitHub says they cannot see it, we return 404. Clones are fetched with the token passed in a header for that command only, never written to disk config. Files are read with `git show HEAD:<path>` after path validation, so `../` and symlink tricks cannot escape the repository. Work-in-flight lookups are limited to repositories linked to the organisation and readable by the caller.

## "What about the admin? Can your staff see everything?"

Admins see platform health, model status, organisation names and counts, and the platform audit log. They do not see organisation content unless that organisation's owner grants support access, which is audited and reversible. Admins are a fixed list of GitHub logins set on the host.

## "How do you stop abuse?"

Rate limits per IP, per account and server-wide on everything expensive or outward-facing: analysis, model calls, quiz generation, pending-work lookups, and handoff emails (10 per user per 10 minutes). Handoff emails never auto-link text a user typed, and the footer says who sent it and that the content was not checked.

## "What happens in transit?"

HTTPS everywhere (Render terminates TLS), GitHub and Groq over HTTPS, Upstash over TLS, email via Brevo's HTTPS API. Cookies are Secure in production.

## "Who reviewed it?"

An independent adversarial review of the whole codebase was run on 1 November 2026. It found three high-severity issues (quiz answer keys reachable through two listing routes and a save response; quiz brute-forceable by retrying; pending-work endpoint able to read code from any repository cached on the server) and several medium ones (manager could lock out an owner; setup page could replace GitHub credentials; sealed tokens never expired; handoff email could carry attacker links). All were fixed the same day and verified. The review's "checked and fine" list covered OAuth state, cookie flags, IDOR on every id route, git argument injection, SSRF, path traversal, XSS, CSRF and secret leakage in errors.

## Honest gaps (say them before they ask)

- Notice text and handover notes are stored as plain JSON at rest; encryption at rest is the host disk's and Redis's, not field-level. Field-level encryption with `AUTH_SECRET` is a small change if a customer requires it.
- The document store is fine for a team; a company deployment would move to Postgres with row-level tenancy.
- Email delivery depends on the recipient having that address verified on GitHub for handoffs; notices use the git email the member set.
- GitHub only. No GitLab or Bitbucket yet.
- Render's free tier wipes the disk on redeploy; Upstash fixes that and is optional.
