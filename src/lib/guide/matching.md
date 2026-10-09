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

## Pay

Matching never looks at pay. A score says how well the role fits you, and
about half of all postings don't say what they pay, so pay in the score would
mostly measure which job boards publish it. That means a job can score 95 and
pay a third of what you ask.

**Hide jobs that pay below my ask** deals with that without touching the score.
It compares the most a job says it pays with your ask on
[Salary Prep](/applications/salary): a salary with your salary, a contract or
freelance rate with your rate, whatever currency and period the posting uses.
With it on, jobs paying below your ask are left out of Job Matches, the top
matches on your overview and the email digest. You choose how far below your
ask still counts, because an ask is not a walk-away number and posted budgets
stretch.

- **Jobs that don't state their pay are always shown.** So are jobs whose pay
  can't be read with confidence: no period, a fixed price, a currency without
  an exchange rate.
- **Nothing is hidden without saying so.** The job list says how many jobs it
  left out and lets you show them, and its **Pay** filter switches between all
  jobs, hiding them, and only them. The digest says how many it left out too.
- **Jobs you saved stay in your saved list**, whatever they pay.
- With no ask on Salary Prep there is nothing to compare with, so nothing is
  hidden.

## Email digest

[Email Digest](/jobs/import/notifications) sends your top matches to you instead
of waiting for you to come and look.

- **How often**, in days — the default is every 7.
- **A minimum score**, so it only writes when there's something worth reading —
  the default is 70.
- **A timezone**, so it arrives at a sensible hour.
- **Which address** — your profile's email or your account's.

If Match Config hides jobs that pay below your ask, the digest leaves them out
as well, and each email says how many.

A digest with the threshold set too low turns into noise you learn to ignore,
which is worse than no digest. If yours is arriving full of jobs you don't open,
raise the score before you turn it off.
