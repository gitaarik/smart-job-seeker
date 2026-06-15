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

## Can I run the whole thing myself?

Yes — the app is open source (GPLv3). Self-hosting the full platform (app,
worker, database) is a bigger undertaking and is documented in the
[repository](https://github.com/gitaarik/smart-job-seeker). Most people only
need to run a **device**, not the whole platform.
