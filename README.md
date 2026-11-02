# Desk

Personal desk for Eric Allerton at PCG. It is a dark, single-user dashboard over live APIs: Outlook drafts, today's calendar, Todoist, NinjaOne tickets, a clients directory of pointers, and a signed feed from his Grok Bot agents. It is not a clone of those products.

Mail bodies and the clients directory are not stored on the server. See [SECURITY.md](SECURITY.md). Do not put CUI on Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

With no environment variables, sign-in is in setup mode and every panel says **Not connected, set …**. That is intentional. Set the variables below before deploying.

```bash
npm run lint
npm test
npm run build
```

## Pages

| Page | What it reads |
| --- | --- |
| Today | Decisions waiting, drafts, agenda, tasks, tickets, then the daily brief |
| Drafts | Outlook Drafts folder. Open a draft to edit, save, send, or discard it |
| Tasks | Todoist tasks due today or overdue. Complete and add |
| Tickets | Open NinjaOne tickets assigned to Eric. Read only |
| Clients | Tenant pointers in this browser. Links open in a new tab |
| Feed | Items pushed by agents, plus a form that sends a command back to Grok Bot |

`Ctrl+K` or `Cmd+K` jumps between pages, summarizes the day, or runs a read. The command bar cannot send mail, discard a draft, or change a ticket.

## Entra app registration

1. Open the Microsoft Entra admin center for Eric's **commercial** tenant. Do not register this against a GCC High directory.
2. Go to **Identity → Applications → App registrations → New registration**.
3. Name it `Desk`. Supported account types: **Accounts in this organizational directory only**.
4. Redirect URI platform: **Web** (not SPA).
   - Local: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - Production: `https://<your-domain>/api/auth/callback/microsoft-entra-id`
5. Copy the **Application (client) ID** to `AZURE_AD_CLIENT_ID` and the **Directory (tenant) ID** to `AZURE_AD_TENANT_ID`.
6. **Certificates & secrets → New client secret.** Copy the secret **Value** to `AZURE_AD_CLIENT_SECRET`.
7. **API permissions → Microsoft Graph → Delegated** and add:
   - `Mail.ReadWrite`
   - `Mail.Send`
   - `Calendars.Read`
   - `User.Read`
   - `offline_access` is requested at sign-in; add `openid`, `profile`, and `email` if they are not already listed
8. Grant admin consent for the tenant.
9. Set `ALLOWED_EMAIL` to Eric's mailbox. Any other account is rejected.
10. Set `AUTH_SECRET` (`openssl rand -base64 32`) and, in production, `AUTH_URL` to the site origin.

Sign-in is Auth.js (`next-auth` 5) with the Microsoft Entra ID provider. The issuer is `https://login.microsoftonline.com/<AZURE_AD_TENANT_ID>/v2.0`. Tokens stay in the session cookie and are refreshed with the refresh token. Desk calls only `https://graph.microsoft.com`.

## Environment variables

| Variable | Required for | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | Sign-in | Auth.js session encryption |
| `AUTH_URL` | Production sign-in | Site origin, no trailing path |
| `AZURE_AD_CLIENT_ID` | Graph drafts and calendar | Entra application id |
| `AZURE_AD_CLIENT_SECRET` | Graph drafts and calendar | Secret value |
| `AZURE_AD_TENANT_ID` | Graph drafts and calendar | Commercial directory GUID |
| `ALLOWED_EMAIL` | The whole app, once auth is on | Single allowlisted mailbox |
| `TODOIST_API_TOKEN` | Tasks | [Todoist REST v2](https://developer.todoist.com/rest/v2/) token |
| `NINJAONE_BASE_URL` | Tickets | Commercial host, e.g. `https://app.ninjarmm.com` |
| `NINJAONE_CLIENT_ID` | Tickets | OAuth client id |
| `NINJAONE_CLIENT_SECRET` | Tickets | OAuth client secret |
| `NINJAONE_SCOPE` | Tickets | Optional. Default `monitoring management` |
| `NINJAONE_BOARD_ID` | Tickets | Optional board to query |
| `NINJAONE_ASSIGNEE_ID` | Tickets | Optional technician id |
| `NINJAONE_ASSIGNEE_EMAIL` | Tickets | Optional. Falls back to `ALLOWED_EMAIL` |
| `NOTION_TOKEN` | Agenda prep search | Optional. Manual prep links work without it |
| `FEED_WEBHOOK_SECRET` | Inbound feed | HMAC secret |
| `GROKBOT_WEBHOOK_URL` | Sending choices and commands | HTTPS, or localhost HTTP in dev |
| `GROKBOT_WEBHOOK_SECRET` | Signing the outbound webhook | |
| `AI_PROVIDER` | Daily brief and Ctrl+K summarize | `google` (default), `openai`, or `anthropic` |
| `AI_MODEL` | Model override | Optional |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Brief when provider is google | Default provider |
| `OPENAI_API_KEY` | Brief when provider is openai | |
| `ANTHROPIC_API_KEY` | Brief when provider is anthropic | |
| `UPSTASH_REDIS_REST_URL` | Durable feed storage | Preferred store |
| `UPSTASH_REDIS_REST_TOKEN` | Durable feed storage | |
| `KV_REST_API_URL` | Durable feed storage | Alias for the Upstash URL |
| `KV_REST_API_TOKEN` | Durable feed storage | Alias for the Upstash token |
| `NEON_DATABASE_URL` | Durable feed storage | Used when Upstash is unset |
| `DATABASE_URL` | Durable feed storage | Alias for the Neon URL |

If Upstash and Neon are both unset, feed items and meeting links live in process memory and disappear when the process restarts. Vercel KV is no longer offered; use Upstash.

Default models, from the installed AI SDK provider docs: `gemini-4-argon`, `gpt-6-astra`, `claude-sonnet-5-5`. Override with `AI_MODEL`.

## Feed webhook

`POST /api/feed` with `Content-Type: application/json`.

Headers:

- `x-timestamp`: unix seconds
- `x-signature`: hex HMAC-SHA256 of `{timestamp}.{rawBody}` using `FEED_WEBHOOK_SECRET`. A `sha256=` prefix is accepted.
- `x-idempotency-key`: 8–200 characters (`A-Z a-z 0-9 . _ : -`). A repeat returns the original item.

```json
{
  "type": "decision",
  "title": "Approve the Burch change window",
  "body": "Saturday 22:00–23:00.",
  "source": "grok-bot",
  "link": "https://example.com/change/18",
  "priority": "high",
  "needsDecision": true
}
```

`type` is one of `decision`, `guild_output`, `change_request`, `eod_prep`, `status`. `priority` is `low`, `normal`, `high`, or `urgent`. Timestamps older than 5 minutes are rejected.

Decision buttons on Today only POST Eric's choice to `GROKBOT_WEBHOOK_URL`, signed the same way, and only when he is signed in. They do not call NinjaOne or a client tenant.

## Clients directory

Seeded in the browser with Burch Construction (NinjaOne org 3), R.A. Burch (org 4), and Marlin. Marlin is GCC High: the portals are links only. Edits stay in `localStorage`. Reset to seed from the Clients page.

## Deploy to Vercel

1. Push this repo and import it as a Next.js project.
2. Add every variable you use under **Project → Settings → Environment Variables**. At minimum set the five auth variables and `AUTH_URL`.
3. For the feed, create an Upstash Redis database (Vercel Marketplace or Upstash) and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
4. Deploy. The Entra redirect URI must match `https://<domain>/api/auth/callback/microsoft-entra-id`.
5. Sign in as `ALLOWED_EMAIL` and confirm each panel either loads or still names the variable it needs.

Do not enable this on a public URL before auth is configured. Setup mode exists so a local checkout with an empty env file still renders.

## Decisions worth knowing

- Auth.js v5 is installed as `next-auth@5.0.0-beta.32`, which is the current Auth.js release. There is no stable `next-auth@5` tag yet.
- Missing auth variables leave the shell unlocked so the not-connected cards can render. A complete auth config locks every route except Auth.js and the signed feed webhook.
- NinjaOne ticket writes need a user-delegated token. This phase is read-only on purpose, including a code guard that rejects every NinjaOne call except GET and the board-query POST.
- The daily brief is built from subjects, titles, and statuses. Draft HTML is not sent to the model.
- Todoist titles that start with `NNNN · ` show the code separately. Tasks sort p1 first and show duration when Todoist has one.
- Client meetings are flagged when the subject matches a directory name or an attendee is outside Eric's domain. Notion search is optional; a manual https prep link is stored as an event id and a URL.
