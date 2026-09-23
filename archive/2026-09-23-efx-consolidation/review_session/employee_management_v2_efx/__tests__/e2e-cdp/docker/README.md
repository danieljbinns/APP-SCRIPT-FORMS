# chrome-authbox — persistent, isolated Chrome for E2E automation

A Docker container running a **real headed Google Chrome** on a virtual display.
You log in to Google **once** through a browser-based VNC view; the session
persists in a Docker volume. Automation then drives it over CDP — without ever
touching your host mouse/keyboard/screen.

Why this exists: the GAS web app renders inside a cross-origin `googleusercontent`
iframe. The Chrome extension can't inject JS there; Playwright's `frame.evaluate()`
can. And cookie-injection into a headless browser gets rejected by Google — but an
interactive login into a *real* headed Chrome is trusted and sticks.

## 1. Build + start
```bash
cd employee_management_v2_dev/__tests__/e2e-cdp/docker
docker compose up -d --build
```

## 2. One-time login (do this once; it persists)
1. Open **http://localhost:6080/vnc.html** in your normal browser → Connect.
2. You'll see the container's Chrome. Go to `https://accounts.google.com` and sign
   in as your team-group / robinsonsolutions account (complete MFA normally).
3. Optionally open the app once to confirm:
   `…/exec?form=dashboard`. Then just leave it — the session is saved to the volume.

> CDP is unauthenticated. Ports are bound to `127.0.0.1` only. To also password-protect
> the VNC view, set `VNC_PASSWORD` in `docker-compose.yml` and `docker compose up -d`.

## 3. Run the methodology (from the parent e2e-cdp folder)
```bash
cd ..
npm i -D playwright-core            # tiny; no browser download
CDP_URL=http://localhost:9222 node run-form.js newhire
CDP_URL=http://localhost:9222 node run-form.js hrv  <workflowId>
CDP_URL=http://localhost:9222 node run-form.js it   <workflowId>
CDP_URL=http://localhost:9222 node run-form.js equipment
CDP_URL=http://localhost:9222 node run-form.js termination
```
Each run prints the captured `google.script.run` payload, any NOT-FOUND fields, and
console errors as JSON — for diffing against the sheet (Sheets MCP), emails (GAM), and
the dashboard.

## Lifecycle
- `docker compose stop` / `start` — session persists (volume).
- `docker compose down` — container removed, **volume kept** (session persists).
- `docker compose down -v` — also deletes the volume → you'd re-login.
- Re-login is only needed if Google expires the session (infrequent).

## Watching automation live
Keep `http://localhost:6080/vnc.html` open while `run-form.js` runs — you'll see the
form fill and submit in real time. Don't click inside the tab the script is driving.
