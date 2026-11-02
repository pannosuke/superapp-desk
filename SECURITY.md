# Security

Desk is a personal dashboard for Eric Allerton. It is not a place to store or process CUI.

## No CUI on Vercel

Do not put Controlled Unclassified Information, export-controlled data, or client evidence in this app, its environment variables, its feed, its prompts, or its storage. Vercel is not authorized for CUI. If a draft, ticket, or feed item might contain CUI, do not open or summarize it here.

## What is stored

The server stores feed items (the payloads agents push), decision flags (handled, choice, note), idempotency keys, and optional meeting-id to prep-URL pointers.

The server does not store:

- email or draft bodies
- mailbox contents
- client tenant identifiers beyond the NinjaOne org numbers committed as directory pointers
- the clients directory (that list lives in the browser)

Microsoft Graph responses are passed through to the signed-in browser and are not written to KV, Neon, or the in-memory store.

## Authentication

When Auth.js is configured, every page and API except the Auth.js routes and the signed inbound feed webhook require a session. The session email must match `ALLOWED_EMAIL`. Sign-in uses a single commercial Entra tenant and delegated Graph scopes only: `Mail.ReadWrite`, `Mail.Send`, `Calendars.Read`, `User.Read`, and `offline_access`.

Until those auth variables are set, Desk renders in setup mode so missing integrations are visible. Do not deploy that mode.

## NinjaOne is read-only

Desk never writes NinjaOne comments, status changes, ticket fields, or client tenants. The only NinjaOne POST is the ticketing board query (`/v2/ticketing/trigger/board/{id}/run`), which does not mutate tickets. Any other method or path is rejected in code before a request is sent.

## Decisions do not call tenant systems

Approval, decline, and request-changes buttons do not call NinjaOne, Microsoft Graph, Todoist, or a client portal. They POST Eric's choice to the outbound Grok Bot webhook, and only from his authenticated session. Mark handled updates Desk's own feed record.

## Drafts

Save, send, and discard go to the signed-in mailbox through Graph. Send and discard each require an explicit confirmation in the UI. Bodies are sanitized in transit and are not persisted by Desk.

## GCC High

Marlin is GCC High. Its admin portals are ordinary links that open in a new tab. Desk never requests `*.microsoft.us`, `*.office365.us`, or other government-cloud hosts. Do not point `AZURE_AD_TENANT_ID` or `NINJAONE_BASE_URL` at a GCC High tenant.

## Feed webhook

`POST /api/feed` requires:

- `x-signature`: hex HMAC-SHA256 of `{unixSeconds}.{rawBody}` using `FEED_WEBHOOK_SECRET` (`sha256=` prefix allowed)
- `x-timestamp`: unix seconds, rejected when older than 5 minutes or more than 60 seconds ahead
- `x-idempotency-key`: 8–200 characters, duplicates return the original item

Outbound calls to Grok Bot use the same signature scheme with `GROKBOT_WEBHOOK_SECRET`.
