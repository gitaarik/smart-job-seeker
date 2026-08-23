# Matching & alerts

Scraping brings jobs in. **Matching** decides which of them are worth your
attention, by scoring each one against your profile.

Two things shape what you end up looking at: the **filters** in
[Match Config](/jobs/import/config), which decide what gets scored at all, and
your profile, which decides how well each one scores. This page is about the
first. The second is [Getting the best results](/guide/getting-the-best-results).

## Match Config

These are your standing preferences, separate from the filters on any individual
Import Task. A task's filters decide what a search _fetches_; these decide what
counts once it's here.

- **Job types** — Full-time, Part-time, Contract, Freelance, Internship.
- **Work location** — Remote, Hybrid, On-site. Required.
- **Preferred locations** — only appears once you've picked Hybrid or On-site,
  because it's meaningless for remote work. Worth knowing: **location is
  compared as text, not geography.** "Amsterdam" does not match "Noord-Holland"
  and neither matches a coordinate. Write the words you'd expect to see in a
  posting.
- **Experience levels** — Entry-level through Executive. Optional, and leaving
  it empty includes everything, which is usually the right start.

Everything saves as you change it.

A job has to clear these before it's scored at all: **at least one skill in
common with your profile**, plus your job type and work location. Anything that
doesn't is filtered out rather than scored badly — which is why a job you can
see in the list may have no score against it.

## Jobs other people imported

**Also score jobs imported by other users** is the setting most worth
understanding, because it's the one that gets you jobs you didn't pay to scrape.

Other people run their own searches on their own devices. With this on, the jobs
they brought in are filtered and scored against your profile too. It costs less
per job than importing one yourself, and your own jobs are always scored first.

You can limit it to jobs collected within a recent window, which is usually
what you want — a posting somebody imported four months ago is generally closed.

## Email digest

[Email Digest](/jobs/import/notifications) sends your top matches to you instead
of waiting for you to come and look.

- **How often**, in days — the default is every 7.
- **A minimum score**, so it only writes when there's something worth reading —
  the default is 70.
- **A timezone**, so it arrives at a sensible hour.
- **Which address** — your profile's email or your account's.

A digest with the threshold set too low turns into noise you learn to ignore,
which is worse than no digest. If yours is arriving full of jobs you don't open,
raise the score before you turn it off.
