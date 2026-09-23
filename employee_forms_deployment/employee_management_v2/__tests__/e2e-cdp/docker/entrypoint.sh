#!/usr/bin/env bash
# Starts: virtual display -> real headed Chrome (CDP on loopback) -> socat (exposes CDP)
#         -> x11vnc + noVNC (one-time interactive login).
set -euo pipefail

mkdir -p "$PROFILE_DIR"
CHROME_INTERNAL_PORT=9333

echo "[authbox] starting virtual display :99"
Xvfb :99 -screen 0 1600x900x24 -ac +extension RANDR >/var/log/xvfb.log 2>&1 &
sleep 1

echo "[authbox] starting headed Chrome (profile=$PROFILE_DIR, devtools=127.0.0.1:$CHROME_INTERNAL_PORT)"
google-chrome \
  --user-data-dir="$PROFILE_DIR" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port="$CHROME_INTERNAL_PORT" \
  --no-first-run --no-default-browser-check \
  --no-sandbox --disable-setuid-sandbox \
  --disable-dev-shm-usage --disable-gpu \
  --window-size=1600,900 --start-maximized \
  --window-position=0,0 \
  "about:blank" >/var/log/chrome.log 2>&1 &

echo "[authbox] waiting for Chrome devtools..."
for i in $(seq 1 30); do
  if curl -s "http://127.0.0.1:${CHROME_INTERNAL_PORT}/json/version" >/dev/null 2>&1; then
    echo "[authbox] devtools up"; break
  fi
  sleep 1
done

# Expose CDP on all interfaces (so Docker port-mapping can reach it). The Host
# header arriving via socat stays "localhost:9222", which Chrome's anti-rebinding
# check accepts; run-form.js rewrites the reported ws host to match.
echo "[authbox] proxying CDP 0.0.0.0:9222 -> 127.0.0.1:${CHROME_INTERNAL_PORT}"
socat TCP-LISTEN:9222,fork,reuseaddr TCP:127.0.0.1:${CHROME_INTERNAL_PORT} &

echo "[authbox] starting VNC + noVNC (login at http://localhost:6080/vnc.html)"
x11vnc -display :99 -forever -shared -rfbport 5900 \
  ${VNC_PASSWORD:+-passwd "$VNC_PASSWORD"} ${VNC_PASSWORD:--nopw} \
  >/var/log/x11vnc.log 2>&1 &
websockify --web=/usr/share/novnc 6080 localhost:5900 >/var/log/novnc.log 2>&1 &

echo "[authbox] READY"
echo "  one-time login : http://localhost:6080/vnc.html"
echo "  automation CDP : http://localhost:9222/json/version"

# keep container alive; exit if any background job dies
wait -n
echo "[authbox] a service exited; shutting down"
