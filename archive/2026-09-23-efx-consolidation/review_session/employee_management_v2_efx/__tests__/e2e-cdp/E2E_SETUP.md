# E2E Testing — Method Reference

## Why real browser

The GAS web app renders inside a cross-origin `googleusercontent` iframe.
- Extensions can't inject JS into it
- Headless Chrome gets Google session rejections
- The Execution API bypasses the UI (no DOM, no real validation)

**Method:** Playwright connects to a real authenticated Chrome over CDP and drives the app exactly as a human would.

---

## Browser setup (one-time)

A Docker container runs a headed Chrome on a virtual display. Log in once via VNC; the session persists in a volume.

```bash
# Start the container
cd __tests__/e2e-cdp/docker
docker compose up -d --build

# Open http://localhost:6080/vnc.html → sign in to Google once
# CDP is now available at http://localhost:9222
```

**Restart without losing session:**
```bash
docker compose stop   # pause
docker compose start  # resume — session intact
```

Watch automation live at `http://localhost:6080/vnc.html` while scripts run.

---

## Scripts

All scripts live in `__tests__/e2e-cdp/`. Run from that folder with `CDP_URL=http://localhost:9222`.

| Script | What it does |
|--------|-------------|
| `run-form.js <config>` | Fills and submits a form. Captures the `google.script.run` payload + server response as JSON. |
| `complete-action.js <taskId>` | Opens an action item by task ID, marks sub-tasks complete, clicks finalize. |
| `discover.js "?form=...&wf=..."` | Loads a form and lists every named field: type, required, options. Run this before filling a new form. |
| `debug-frames.js "?form=..."` | Lists all frames on a page with input counts and button text. Use when a form isn't loading. |

---

## How capture works

The harness installs a JS proxy inside the `userHtmlFrame` that wraps `google.script.run`. It captures:
- The RPC function name called on submit
- The full argument payload
- The server response (success/failure + message)

Output is printed as JSON to stdout. Pipe to a file if needed:
```bash
CDP_URL=http://localhost:9222 node run-form.js newhire > out.json
```

Fields the harness couldn't find in the DOM are listed under `notFoundFields` in the output.

---

## Verification checklist (per step)

After each form submit, check:
- **Payload** — `capturedCalls[0].args` matches what was filled
- **Results sheet** — new row in the correct sheet (use Sheets MCP: spreadsheet `1KeWBbh8755mRXFSK2dCeSW75djpaPgtprbmqd7BAsMA`)
- **Workflows tab** — status advanced to the expected next step
- **Dashboard_View tab** — consistent with workflow status
- **Email** — redirected to `dbinns@team-group.com`, subject `[TEST]`-prefixed (dev redirect is always active)

---

## Before running a new form

Always run `discover.js` first to confirm actual field names and select options:
```bash
CDP_URL=http://localhost:9222 node discover.js "?form=<form_name>&wf=<workflowId>"
```

Field names in the harness configs must match the DOM `name` attributes exactly.
