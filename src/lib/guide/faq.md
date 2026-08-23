# FAQ & troubleshooting

## Do I need to install anything?

Only if you want to run your own scraping device. If someone **shared a device
with you**, you don't install anything — just pick their device when you run a
search. See [Devices & sharing](/guide/devices).

## Do I have to set up job searches from scratch?

No. When you first import your profile, SJS **suggests Import Tasks** for you.
You mostly just finish configuring each one — pick a device and, for boards that
need signing in, log in once (Manual login) — then activate it. See
[Getting the best results](/guide/getting-the-best-results).

## Why isn't my device connecting?

- Check the container or desktop app is actually **running**.
- Make sure the **server URL** matches the one shown on the Devices page, and
  the **device key** is correct.
- The Devices page shows **live status** — it turns green within a few seconds
  of the device coming online.

## A search I shared with someone got rate-limited. Why?

Scraping is rate-limited per device and per person to keep the device's IP from
being flagged by job boards. Wait a few minutes and try again, spread heavy
searches out, or — if you host many people — run a second device. See
[fair-use limits](/guide/devices#fair-use-limits).

## My matches aren't great.

Almost always one of two things:

- Your **profile is thin** — add real detail to experience and skills. Matching
  scores against what it knows.
- Your **search is too broad** — tighten the Import Task's filters (location,
  seniority, keywords) at the source. See
  [Getting the best results](/guide/getting-the-best-results).

## Is my data private?

The scraping runs on **your** device (or the device shared with you), using that
device's own IP — not a shared cloud pool. The device client is open source and
its releases are signed; you can read exactly what runs on your hardware.

## What costs credits?

Running a job search and asking the AI to write something. Both are metered by
what they actually did rather than charged as a flat fee, and everything else —
browsing, matching, editing your profile, tracking applications, exporting your
data — is free. The breakdown is in **[Credits](/guide/credits)**.

## Can I delete my account?

Yes, from [Delete Account](/data/delete). It's a real deletion, not an
anonymisation: access stops immediately and the data is removed after 30 days,
the same window as the backups. There's no self-service undo, so see
**[Your data](/guide/your-data)** before you start.

## Can I use my own AI assistant instead of the built-in one?

Yes — anything that speaks MCP (Claude, an AI-enabled editor, your own script)
can be pointed at one profile from
**[Connected Apps](/data/connected-apps)**. You choose what each key may do and
what it may see, and you can revoke it at any moment. Rewriting what you wrote
and hiding entries always come back to you for approval, whatever the key is
allowed to do.

Full walkthrough: [Connecting your own AI](/guide/connected-apps).

## Can I run the whole thing myself?

Yes — the app is open source (GPLv3). Self-hosting the full platform (app,
worker, database) is a bigger undertaking and is documented in the
[repository](https://github.com/gitaarik/smart-job-seeker). Most people only
need to run a **device**, not the whole platform.
