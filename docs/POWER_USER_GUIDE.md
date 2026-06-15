# Power User Guide — Host a Device & Invite Others

Smart Job Seeker scrapes job boards through a **real browser running on a real
device with a real residential IP** — yours. That's what makes it reliable
against anti-bot systems, and it's why there's no "just sign up and go" cloud
pool to fall back on: someone has to run a device.

If you're comfortable running a Docker container or installing a desktop app,
**you can be that someone** — for yourself, and for less-technical friends who'd
never get past the setup. You host one device; they use it through a single
link, with nothing to install on their end.

This guide walks through hosting a device and inviting others. For the device
client's internals and trust model, see
[gitaarik/sjs-browser](https://github.com/gitaarik/sjs-browser). For running the
whole platform yourself, see
[Self-hosting](#advanced-self-host-the-whole-platform).

---

## Why host your own device

- **It actually works.** Scraping from a residential IP in a real Chrome beats
  shared cloud browsers that job boards fingerprint and block.
- **Privacy.** Your searches run on your hardware; the browsing happens on your
  device, not a shared server.
- **You can help others.** A device you host can be shared with people you trust
  — they get the benefit without the setup.
- **It's auditable.** The client that runs on your machine is open source and
  its releases are signed. You can read exactly what it does.

---

## Two ways to run a device

You only need **one**. Both connect the same way and show up identically in the
app.

### A. Desktop app — easiest, good for "while my laptop is on"

Download the installer for your OS from
[sjs-desktop releases](https://github.com/gitaarik/sjs-desktop/releases/latest)
(`.dmg` / `.exe` / `.deb` / `.AppImage`). A compatible browser is downloaded
automatically on first launch. You'll paste a device key (next section) and pick
your server.

Best when: you just want to scrape for yourself and don't need 24/7 uptime.

### B. Docker on a NAS / home server — always-on, good for hosting others

Run the `sjs-browser` container on a NAS (TrueNAS, Synology, Unraid) or any box
with Docker. It stays connected around the clock and auto-updates itself.

Best when: you want to scrape on a schedule, or **share the device with other
people** (they can only use it while it's online).

> The **Devices** page in the app generates a ready-to-run command with your
> server URL and key already filled in — copy it from there rather than hand-
> editing. A representative `docker-compose.yml`:

```yaml
services:
  sjs-browser:
    image: gitaarik036/sjs-browser:latest
    restart: unless-stopped
    shm_size: "512m"
    volumes:
      - chrome_data:/data
    environment:
      SJS_SERVER_URL: "wss://<your-sjs-host>/tunnel"
      SJS_API_TOKEN: "sjs_..." # your device key
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2"

volumes:
  chrome_data:
```

Then `docker compose up -d`. The container fetches the latest **signed** release
on startup and every few hours; pull a fresh image (`docker compose pull`) every
couple of months for Chrome and base-OS updates.

---

## Step 1 — Create a device key

1. In the app, go to **Job Import → Devices**.
2. Click **New Key**, give it a name (e.g. _"NAS"_ or _"My Laptop"_).
3. The **connect wizard** shows a pre-filled `docker run` command (key already
   injected) and a **live status** that flips to ✅ **Connected** the moment
   your device comes online.

Each physical device needs its own key. Keys can be revoked or renamed any time
from the same page.

---

## Step 2 — Connect your device

- **Desktop app:** select your server, paste the device key.
- **Docker:** drop the key into `SJS_API_TOKEN` (or use the wizard's pre-filled
  command) and start the container.

Watch the wizard — when it goes green, you're connected. If it stays on
"Waiting…", check that the container is running and the server URL matches the
one shown on the Devices page.

---

## Step 3 — Scrape jobs for yourself

1. Create an **Import Task** (a saved job-board search).
2. Choose **"My device"** as the browser and pick which device to use.
3. Run it. The browser drives your search on your device; results flow back into
   the app for matching and tracking.

---

## Step 4 — Invite others to use your device

This is the part that lets you bring in people who'd never self-host. They need
**no install, no Docker, no device of their own** — just the link.

1. On the **Devices** page, open the **⋮** menu on your device → **Share**.
2. Under **Invite by link**, click **Create invite link**.
3. Send the link to your friend. It's **single-use** and expires in **7 days**.

What they experience:

- They open the link and see _"\<you\> invited you to use \<device\>."_
- They **sign in** (one tap) or **create an account** right there (email +
  password).
- They land in the app already able to scrape — your device shows up for them
  under **"Shared with You"**, selectable in their own Import Tasks.

Behind the scenes, accepting the link makes them a contact, grants them access
to that one device, and approves their account — all in one step. You can revoke
their access any time from the Share dialog.

> **One device, several people.** You can invite multiple people to the same
> device. They share its capacity, subject to the fair-use limits below.

---

## Fair-use limits (so your device doesn't get blocked)

A single device is a single IP. If many people hammer the same device, job
boards notice and may flag it — exactly when sharing is working best. To protect
your device, scraping is rate-limited:

- **Per device:** at least a few minutes between runs, and a daily ceiling
  across everyone using it.
- **Per person you've invited:** a smaller daily cap each, so one person can't
  use up the whole device.

These are deliberately conservative defaults. If someone hits a limit they'll
see a clear message to try again later. The owner (you) running your own device
is only subject to the device-level limit, not the per-person cap.

---

## Supporting the people you invite

The model works best when a technical host looks after a small circle:

- **Keep the device online.** People can only scrape while your device is
  connected — the Devices page shows live status for both you and them.
- **Help with the first search.** Setting up a good Import Task (the right
  board, search URL, filters) is the main learning curve; everything after is
  point-and-click for them.
- **Mind the limits.** If you're hosting several people, the daily ceiling is
  shared — stagger heavy searches or host a second device.

---

## Keeping your device updated

The Docker client auto-updates its SJS code from **signed** releases on startup
and every few hours — no Watchtower needed. To pin or opt out:

- Pin a version: `SJS_BROWSER_CHANNEL=v0.5.27`
- Opt out of auto-update: `SJS_BROWSER_CHANNEL=disabled`

Pull a new **image** occasionally (`docker compose pull`) for Chrome/base-OS
bumps. See [sjs-browser](https://github.com/gitaarik/sjs-browser) for the
release-signing and verification details.

---

## Privacy & trust

- The **client that runs on your device is open source** — Chrome flags, the
  tunnel connection, the CDP bridge, the VNC relay all live in
  [sjs-browser/src](https://github.com/gitaarik/sjs-browser). You can read and
  diff it.
- **Releases are signed**; the in-container bootstrap verifies the signature
  before running any update.
- The browsing happens on **your** device with **your** IP. People you invite
  scrape through your device — only invite people you're comfortable vouching
  for, and revoke access when they no longer need it.

---

## Advanced: self-host the whole platform

Everything above assumes you connect a device to a Smart Job Seeker instance
(e.g. the hosted one). If you'd rather run the **entire platform** yourself —
app, worker, database — the app is open source (GPLv3). That's a bigger
undertaking (Postgres, Redis, a worker process, a browser provider) and is
documented separately:

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit together
- [DEVELOPMENT.md](DEVELOPMENT.md) — running it locally

Self-hosting the platform and hosting a device are independent: most power users
only need the device side described in this guide.
