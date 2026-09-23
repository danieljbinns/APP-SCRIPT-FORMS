# Persistent "auth box": a real (headed) Google Chrome on a virtual display,
# reachable for one-time interactive login via noVNC and for automation via CDP.
# The profile lives on a mounted volume so the Google session survives restarts.
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation wget gnupg curl \
      xvfb x11vnc novnc websockify socat tini procps \
 && wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
 && apt-get install -y --no-install-recommends /tmp/chrome.deb \
 && rm -f /tmp/chrome.deb \
 && rm -rf /var/lib/apt/lists/*

ENV DISPLAY=:99
ENV PROFILE_DIR=/profile
# 6080 = noVNC (one-time login)   9222 = CDP (automation, via socat)
EXPOSE 6080 9222

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
