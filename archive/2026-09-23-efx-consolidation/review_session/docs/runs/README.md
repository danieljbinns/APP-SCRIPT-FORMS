# docs/runs — what actually happened, per deployment day

One file per deployment or cutover day. The blow-by-blow: every id, every decision and why,
every failure and what was done about it. The plans say what we intend; these say what occurred.

Written as the day goes, not reconstructed afterwards. That matters, because most of the value
is in the things that went wrong and would otherwise be forgotten by the next tier.

## What goes in

- Ids produced that day (sheet, script, GCP project, service account, n8n workflows).
- Decisions, with the reasoning and who made the call.
- Every failure, its root cause, and whether it was fixed or logged.
- Verification evidence, quoted literally rather than summarised.
- Deviations from the written plan, and why.

## What must NOT go in

**No credential values.** Not private keys, API keys, passwords, tokens or webhook secrets.
Reference them by name and location instead:

> secret written to `D:/Credentials/n8n/efx-test-webhook-secret.txt` (48 chars, not shown)

Ids and file paths are fine. They identify things; they do not grant access to them. A reader
with an id and no credential can do nothing with it.

Before committing a run log, grep it:

```bash
grep -niE "BEGIN PRIVATE KEY|private_key|X-N8N-API-KEY|password *[:=]" docs/runs/*.md
```

## Files

| File | Day |
|---|---|
| `2026-09-17-efx-test-deploy-runlog.md` | EFX TEST tier stood up and tested end to end |
| `2026-09-17-SUMMARY.md` | The same day in one page, for people who were not there |
| `2026-09-18-KICKOFF.md` | Paste-in prompt to start the next session cold |
