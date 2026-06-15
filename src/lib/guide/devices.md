# Devices & sharing

Scraping runs in a **real browser on a real device** — that's what makes it
reliable. So scraping needs a device: either one you run, or one someone shared
with you.

## Using a device shared with you

If a more technical friend sent you an invite link, this is all you need to
know: **you don't set up anything.** When you accepted the invite, their device
was shared with you.

To use it:

1. Create an **Import Task** (a saved job search).
2. Choose **"My device"** as the browser and pick the **shared device** from the
   list.
3. Run it.

You can only scrape while their device is online — the **Devices** page shows
its live status. If it's offline, ask the person who invited you.

## Running your own device

Two ways, you only need one:

- **Desktop app** — quickest. Download it, paste a device key, done. Good for
  scraping while your computer is on.
- **Docker on a NAS / home server** — always-on, and the right choice if you
  want to **share with others** (they can only use it while it's running).

To connect one:

1. Go to **[Job Import → Devices](/jobs/import/devices)** and click **New Key**.
2. Follow the **connect wizard** — for Docker it gives you a ready-to-run
   command with your key already filled in, and a live indicator that turns
   green the moment your device connects.

> The full host setup — Docker Compose, auto-updates, the trust model — is in
> the
> [Power User Guide](https://github.com/gitaarik/smart-job-seeker/blob/main/docs/POWER_USER_GUIDE.md)
> on GitHub.

## Sharing your device with others

Once your device is connected, you can let people you trust use it — no setup on
their end:

1. On the **[Devices](/jobs/import/devices)** page, open the **⋮** menu on your
   device → **Share**.
2. Under **Invite by link**, click **Create invite link**.
3. Send the link. It's **single-use** and expires in **7 days**.

Whoever opens it signs in or creates an account right there and can immediately
scrape through your device. You can revoke their access any time from the same
dialog.

## Fair-use limits

A device is a single IP address. If too many searches run through it too fast,
job boards may flag it. To protect your device, scraping is rate-limited:

- a short wait between runs and a **daily ceiling** for the device overall, and
- a **smaller daily cap per person** you've invited, so no one person uses it
  all.

If you hit a limit you'll see a clear message to try again later. These limits
are deliberately conservative — hosting a handful of people works comfortably
within them.
