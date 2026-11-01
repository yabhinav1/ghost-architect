# Ghost-Architect: what it is, why it is different, why it matters

## The problem in one line

When an engineer leaves, their code stays and their understanding walks out the door. Six months later someone has to change a file nobody understands, and the only person who knew why it exists is gone.

Every company has this. Layoffs make it happen to twenty people at once. Notice periods give you thirty days to capture what someone knows, and almost nobody uses them well.

## What Ghost-Architect does

Point it at a GitHub repository and tell it who left (or who is leaving). It then:

1. **Finds the orphaned code.** Runs git blame and git log on the real history and scores every file by how much of it was written by people who are gone, how often it changes, and how many other files depend on it. The result is a heatmap: red files are the ones that will hurt.
2. **Explains why the code exists.** For any file it reads the commits and pull requests that created it and writes a brief: purpose, claims with evidence links, what is undocumented, risks, and a checklist before you change it. Every claim is marked "documented" (it cites a commit or PR) or "inferred" (the model guessed). Casper, the assistant, answers questions about a file the same way.
3. **Runs the handover.** For a person on notice, a manager assigns a handover of the files they own to a receiver. The leaver writes notes and links per file, the receiver ticks them off, and both see a readiness score.
4. **Shows the work in flight.** Open pull requests they authored, issues assigned to them, branches only they pushed with unmerged commits, and TODO comments they wrote. The things that silently die when someone leaves.
5. **Tests that knowledge actually transferred.** A knowledge check generated from the leaver's own notes and the file briefs. The receiver has to pass it. The score feeds the readiness number.
6. **Hands the receiver a day-one packet.** A printable brief: who left and when, first-week checklist, every file with why it exists, the leaver's notes, risks, evidence and links, and the open work. Also as Markdown for Notion or a PR description.
7. **Counts down.** A calendar from today to the last day with every handover due date and what is still open.
8. **Works as a product, not a script.** GitHub sign-in, three roles (user, organisation owner/manager, platform admin), organisation activity logs that match commits to members, notice letters from templates with read and acknowledge status, email delivery, audit log, and work handoffs that can add the new owner as a collaborator or transfer the repository on GitHub when they accept.

## How it is different from what exists

| What people use today | What it gives you | What it misses |
|---|---|---|
| GitHub Insights / contributors graph | Who committed how much | Nothing about risk. A file with 100% of its lines by a departed author looks the same as any other. |
| CODEOWNERS files | Who to ask for review | Written by hand, goes stale, says nothing when the owner is gone. Ghost-Architect generates one from the real blame data. |
| Confluence / Notion handover docs | A place to write things down | Blank page problem. Nobody knows which files matter, so the doc covers the wrong things. Ghost-Architect picks the files from the data and asks for notes on exactly those. |
| Code-quality tools (SonarQube, CodeScene) | Hotspots, complexity, churn | Measure code, not people. CodeScene's knowledge maps are the closest cousin, but they are an enterprise add-on with no handover workflow, no evidence-backed explanations, and no notice-period process. |
| AI code chat (Copilot, Cursor) | Explains what code does | Explains the "what" from the code. Ghost-Architect explains the "why" from the history, cites the commit or PR, and says when it is guessing. |
| HR offboarding checklists | Return the laptop, revoke access | Nothing about the code. The access gets revoked before the knowledge is captured. |

The combination is the point: the risk map tells you where to look, the briefs tell you what you are looking at, the handover and quiz make sure a human actually absorbed it, and the packet means the next person starts on day one instead of week three.

## Why the approach is sound

- **Evidence, not vibes.** The criticality score is a formula over real git data: orphan share (0.6 blame + 0.4 recent commits) times recent activity times inbound dependencies. The briefs cite commits and pull requests, and the model is told to say "not documented" rather than invent.
- **Honest about AI.** Documented versus inferred claims are labelled in the UI. The knowledge check is written only from the leaver's notes and the briefs, never from the model's general knowledge.
- **Works in minutes, on any repo.** No agents to install, no CI integration. Paste a GitHub URL. Public repos need no sign-in. Private repos use the viewer's own GitHub access on every request, so nobody sees code they cannot already read.
- **Free to run.** Groq's free tier for the model, Render's free tier for hosting, Brevo's free tier for email. The whole stack costs nothing.
- **Built for the two moments it matters.** Layoffs mode: who left, what is now orphaned, generate briefs for the worst files. Notice-period mode: who is leaving, what they own, run the handover before the last day.

## Who it is for and what they get

- **Engineering managers** get a ranked list of what breaks when someone leaves, and a handover process with a number on it instead of "I think they wrote it down somewhere."
- **The engineer leaving** gets a short list of files that actually matter, instead of being asked to "document everything."
- **The engineer inheriting the code** gets a day-one packet, evidence for every claim, and a quiz that tells them what they do not yet understand.
- **Open-source maintainers** get a bus-factor check on their own project: run it on any public repo and see how many people the project really depends on.

## Demo in ninety seconds

1. Analyse `expressjs/express`. Switch to Layoffs, click "top 3 authors leave". The map turns red.
2. Open the reddest file, ask Casper why it exists. Point at the commit it cites.
3. Open the organisation. One engineer is leaving in two weeks; the countdown and the work in flight are on screen.
4. Open the receiver's inbox: the knowledge check, then the day-one packet. Print it.

## Where it goes next

Slack and Jira signals for pending work, GitLab and Bitbucket, a weekly bus-factor digest for every repository in an organisation, and team-level risk (what happens if this whole team is cut).
