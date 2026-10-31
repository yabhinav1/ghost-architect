type Guide = { title: string; introduction: string; details: string; suggestions: string[] };

export const ASSISTANT_PAGES = {
  home: {
    title: "Welcome to Ghost-Architect",
    introduction: "Hi, I’m Casper. Ghost-Architect helps teams find code at risk when engineers leave and plan a handover. Sign in with GitHub to see your repositories, or choose Analyse a public repo to try it without signing in.",
    details: "The landing page has Sign in with GitHub and Analyse a public repo. The top-right Sign in menu offers User, Organisation and Admin. Choosing a role changes the destination, not the permissions. The developer sign-in panel is only for local development and is unavailable in production.",
    suggestions: ["What does this website do?", "How do I get started?", "Which sign-in option should I choose?", "Can I try it without signing in?"],
  },
  dashboard: {
    title: "Your repositories",
    introduction: "This is your repository dashboard. Choose a repository and select Analyse to explore ownership and handover risks. Recently analysed takes you back to earlier work; the navigation also leads to your organisations and inbox.",
    details: "The signed-in dashboard shows accessible repositories, search/filter controls, Recently analysed, and risk summaries across repositories. A GitHub App installation button can grant the app access to chosen repositories. Do not assume the user has installed the app or that any private repository is available. The navigation includes My repositories, Organisations, Inbox and Analyse any repo; Admin is available only to platform admins.",
    suggestions: ["Walk me through this dashboard", "How do I analyse a repository?", "Why is a private repository missing?", "What do the risk summaries mean?"],
  },
  analyse: {
    title: "Analyse a repository",
    introduction: "Paste an HTTPS GitHub repository URL or choose a sample to start. Once the analysis loads, I can explain the heatmap, help you choose who is leaving, and walk through individual files.",
    details: "This is the repository input page. Public repositories work without sign-in. Private repositories require a GitHub account that can read them. Samples include Express, Flask and Axios. An analysis may still be loading or may have failed; do not assume a heatmap is available unless analysis context is supplied.",
    suggestions: ["How do I start an analysis?", "Which sample should I try?", "Can I analyse a private repository?", "What happens during analysis?"],
  },
  repository: {
    title: "Repository analysis",
    introduction: "This page analyses a repository’s ownership and history. Once it finishes loading, choose an engineer who is leaving to see which files need a handover. Click a file and I can help explain its score and code.",
    details: "The repository workspace contains the heatmap, Notice period and Layoffs modes, file details, explanations and handover tools. Commit activity below the heatmap has 7/30/90-day Chart and Table views; select a day to inspect recent commit details. Wait for supplied repository context before claiming that files or scores have loaded.",
    suggestions: ["Explain this page", "How do I choose who is leaving?", "What does the heatmap show?", "How does a handover work?"],
  },
  organisations: {
    title: "Your organisations",
    introduction: "Here you can open an organisation you belong to or create one for your team. Creating one makes you its owner. If your team already has an organisation, ask a manager for an invite link.",
    details: "The organisation hub lists memberships and has a Create an organisation form. Owners and managers link repositories, invite people, send notices and assign handovers. Platform admins cannot automatically read organisation contents.",
    suggestions: ["How do I create an organisation?", "How do I join my team?", "What can an organisation owner do?"],
  },
  "org-overview": {
    title: "Organisation overview",
    introduction: "This is your organisation’s workspace for members, linked repositories and handovers. Use the organisation navigation to explore Activity, Notices, Handovers or Settings. Your membership role controls what you can change.",
    details: "Owners and managers manage members, GitHub logins and git emails, departure status and last days, and linked repositories. Member emails connect people to Git history. Do not assume the current user is an owner or manager.",
    suggestions: ["Walk me through this organisation", "How do we link a repository?", "How do we record someone leaving?"],
  },
  "org-activity": {
    title: "Organisation activity",
    introduction: "Activity connects commits from analysed, linked repositories to your team’s git email addresses. I can explain the activity view and help you understand why a member’s commits might not be matched.",
    details: "The activity table uses cached repository analysis and matches commit author emails to organisation members. It is not a live feed of every GitHub event. A missing or different git email can prevent a match.",
    suggestions: ["What does the activity table show?", "Why are a member’s commits missing?", "How do git emails affect this view?"],
  },
  "org-notices": {
    title: "Organisation notices",
    introduction: "Notices let owners and managers send messages to members inside Ghost-Architect and track whether they were read or acknowledged. I can explain the templates and how members find their notices.",
    details: "Notices use templates and are delivered to the app inbox, not automatically by email. Members can acknowledge notices; printable letters are available. Casper can explain the workflow but cannot send or acknowledge notices itself.",
    suggestions: ["How do notices work?", "Where does a member receive a notice?", "What does acknowledged mean?"],
  },
  "org-handovers": {
    title: "Organisation handovers",
    introduction: "Handovers connect an engineer who is leaving with someone taking over. Owners and managers choose the repository, people and due date; the assigned engineers then record notes, links and completion for each file.",
    details: "Handover assignments use two different organisation members, a repository and optionally a due date and file list. Cached analysis can suggest files based on the leaver’s git email. Assigned engineers work on handovers from their Inbox page.",
    suggestions: ["How do I assign a handover?", "How are handover files suggested?", "Where do engineers add their notes?"],
  },
  "org-settings": {
    title: "Organisation settings",
    introduction: "These settings cover your organisation’s name, support access and audit history. Support access lets platform admins view organisation data when help is needed; changes to that access are recorded.",
    details: "Owners and managers control organisation settings. Platform admins need the organisation’s support-access grant to view its contents; support access does not give them manager editing rights. Casper does not change permissions.",
    suggestions: ["What does support access allow?", "Who can change these settings?", "What is recorded in the audit log?"],
  },
  inbox: {
    title: "Your inbox and handovers",
    introduction: "Your inbox holds notices addressed to you and handovers where you are leaving or receiving knowledge. Open a handover to add notes and links, then tick off files as you work through them.",
    details: "The Inbox page has notices with read/acknowledge actions, organisation memberships, assigned handover workspaces and Transfer unfinished work. A sender with repository write/admin access can address notes, remaining work and a branch/PR reference to a recipient's verified GitHub email. Organisation transfers name a current owner or manager as the recipient. Delivery is in-app after a matching verified sign-in, not SMTP email. Recipients mark read, accept or decline; senders can cancel pending work. After acceptance, the sender can separately request a GitHub write-access invitation if they have admin permission and their token allows it. GitHub invitations require acceptance on GitHub; repository ownership is not transferred. Every dashboard has an inbox box and a bell, refreshed every 30 seconds while visible. Existing GitHub Apps may need Email addresses read permission and reauthorisation; invitations require repository Administration write permission or can be handled on GitHub. Casper has not read message bodies and cannot send, accept or invite on the user's behalf.",
    suggestions: ["How do I transfer unfinished work by email?", "Does a handoff give GitHub access?", "Why is my inbox empty?"],
  },
  settings: {
    title: "Account settings",
    introduction: "Here you can review your account, saved scenarios and analysis history, or sign out. Clear my data removes your saved scenarios and history on this server; it does not delete GitHub repositories.",
    details: "Settings shows account information, saved-scenario and recent-history counts, storage status, Sign out and Clear my data. Shared public analysis caches are separate from per-account scenarios. Casper cannot clear data or sign the user out.",
    suggestions: ["What data does this app save?", "What does Clear my data do?", "How is private repository access checked?"],
  },
  admin: {
    title: "Platform administration",
    introduction: "This page is for platform operators. It shows platform metrics, service health and organisation support-access status. Being a platform admin does not automatically grant access to private organisation contents.",
    details: "Admin access depends on the server’s ADMIN_LOGINS configuration, not on choosing Admin in the sign-in menu. Metrics, model lanes and audit summaries are shown to authorised admins. If access is denied, selecting the role cannot grant it. Casper has no live metrics or organisation records.",
    suggestions: ["What can platform admins see?", "Why is admin access denied?", "What does the health check show?"],
  },
  setup: {
    title: "GitHub sign-in setup",
    introduction: "This is the one-time setup for the GitHub App behind sign-in. The setup button takes you to GitHub to review and create the app, then returns you here. I can explain the steps and permissions.",
    details: "Setup creates a GitHub App with read access to repository contents, metadata, pull requests and user email addresses. Verified emails support work handoff delivery. Repository administration write permission is not requested by default, so optional collaborator invitations may need to be handled on GitHub. It is deployment configuration, not a step every team member needs to repeat. Credentials must stay in server configuration, never in chat. Production requires a session secret.",
    suggestions: ["Why does GitHub need an app?", "What permissions does setup request?", "Does everyone need to do this?"],
  },
  invite: {
    title: "Organisation invitation",
    introduction: "This page lets you review an organisation invitation and join with your GitHub account. Check which organisation and account are shown before accepting. I can explain what joining means.",
    details: "Invite links contain private tokens. Never ask the user to paste the token. Casper has no access to the invitation record and cannot accept it or verify its validity. The page handles sign-in and acceptance.",
    suggestions: ["How do I accept an invitation?", "What does joining an organisation allow?"],
  },
  letter: {
    title: "Printable notice",
    introduction: "This is the printable version of an organisation notice. I can explain how notices and acknowledgements work. The assistant stays out of the printed document.",
    details: "The letter page is a printable notice available only to authorised users. Casper has not read its contents and cannot acknowledge or modify it.",
    suggestions: ["How do I print this notice?", "Where do I acknowledge a notice?"],
  },
  report: {
    title: "Repository report",
    introduction: "This is a printable summary of repository ownership risks, priority files and any explanations already generated. I can explain the report’s sections. The assistant will not appear on the printout.",
    details: "The report summarises departed authors, orphaned lines, remaining bus factor and top-risk files. Existing generated briefs may be included. Without repository context Casper cannot verify the report’s actual numbers or access its private contents.",
    suggestions: ["What does this report show?", "What does bus factor mean?", "How should a manager use this report?"],
  },
  unknown: {
    title: "Ghost-Architect help",
    introduction: "Hi, I’m Casper. I can explain Ghost-Architect, help you find the right page, or guide you through analysing a repository and planning a handover.",
    details: "The current page is not recognised. Give general website guidance without pretending to see its contents.",
    suggestions: ["What does Ghost-Architect do?", "How do I analyse a repository?", "Where are my handovers?"],
  },
} satisfies Record<string, Guide>;

export type AssistantPage = keyof typeof ASSISTANT_PAGES;

/** Classify routes without sending account names, invitation tokens or query strings to the model. */
export function assistantPageForPath(pathname: string): AssistantPage {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const exact: Record<string, AssistantPage> = { "/": "home", "/dashboard": "dashboard", "/analyse": "analyse", "/org": "organisations", "/me": "inbox", "/settings": "settings", "/admin": "admin", "/setup": "setup", "/report": "report" };
  if (exact[path]) return exact[path];
  if (/^\/r\/[^/]+\/[^/]+$/.test(path)) return "repository";
  if (/^\/invite\/[^/]+$/.test(path)) return "invite";
  if (/^\/letter\/[^/]+$/.test(path)) return "letter";
  const org = path.match(/^\/org\/[^/]+(?:\/(activity|notices|handovers|settings))?$/);
  if (org) return org[1] ? `org-${org[1]}` as AssistantPage : "org-overview";
  return "unknown";
}
