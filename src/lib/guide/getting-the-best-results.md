# Getting the best results

Smart Job Seeker is only as good as what you put in. A few minutes of setup pays
off in much better matches and far less manual work.

## 1. Make your profile complete

Matching scores each job against [your profile](/profile/edit), so the more it
knows, the sharper the results:

- Fill in **work experience, skills, and education** in real detail — not just
  titles. The specifics are what matching keys on.
- Keep skills **current and honest**; padding them pulls in jobs you don't
  actually want.
- You can keep **multiple profiles** for genuinely different directions (e.g.
  "backend" vs "engineering management") rather than one blurred one.

### Profile-only skills

Every skill in your profile counts toward matching. Whether it appears on your
resume/CV is a **separate** switch — **Show on CV**, on each skill.

Turn it off and the skill becomes **profile-only**: matching still uses it, but
no document prints it, and the AI won't write about it. That's the right home
for something you'd happily discuss in an interview but wouldn't headline —
picked up on the side, used once at a previous job, still rusty.

The quickest way in: on a job page, click a skill you have that isn't matching
and add it straight to your profile. It starts profile-only.

If one turns out to be worth showing after all, you can put it on **all**
documents, or on a single resume/CV version — useful when a skill belongs on
your backend CV but not your frontend one. Versions, and the rest of what that
switch is part of, are covered in
**[Resumes & CVs](/guide/resumes-and-cvs)**.

> Adding a skill doesn't re-score jobs you've already matched; it counts from
> the next match onward. And if you add a skill and immediately run an AI
> feature, give it a moment — the profile snapshot used by AI refreshes shortly
> after you edit.

### Files and source code

A project — one inside a role, or a side project — can carry the material that
describes it: source code, documentation, a ZIP, or a note you type yourself.
Find it on the project's **Files & source code** tab.

What happens to it matters more than that it's stored, because it mostly isn't:
the text is extracted and summarised into reference notes, and **the original
files are not kept**. Secrets are redacted on the way in. What survives is a
summary the app can cite when a job turns out to be relevant to that project —
so a cover letter can point at the thing you actually built rather than at your
job title.

The project's Details tab can then propose a description, an outcome and a list
of technologies from what the scan found, for you to accept or ignore.

If a project has a repository linked, you can **scan it** rather than uploading
anything. Public repositories work as they are. Private ones need a GitHub
connection — and when GitHub asks which repositories to grant, choose
**"Only select repositories"**: it defaults to all of them, and one is all that's
needed.

## 2. Set up your Import Tasks

An Import Task is a saved job-board search that SJS runs for you. You don't
have to invent them: on the [Job Import](/jobs/import) page, **Suggest searches
for me** reads your experience and match preferences and proposes a set of
searches, each on a board that has actually produced jobs before. Accept the
ones you want and each becomes a task — nothing is created until you do. The
suggestion itself is a model call, so it costs a credit like any other AI
feature (see [Credits](/guide/credits)); the tasks it proposes are free until
you run them.

Two things decide whether a task runs well:

- **Where it runs.** With a device connected — your own, or one shared with
  you — new tasks run there. Without one they use the cloud browser, which is
  metered at double rate. (See [Devices & sharing](/guide/devices).)
- **Signing in.** Many boards only show good results when you're signed in. A
  task on such a board starts as **I sign in myself**: its first run stops at
  the sign-in page and you log in through Browser View. With a device connected
  you can also do it ahead of time with **Sign in now** on the task page. The
  browser keeps the session, so **you only log in once.** Prefer hands-off,
  scheduled runs? Save a login and switch the task to **Sign in
  automatically**. Public boards use **Don't sign in**.

You're not limited to the suggestions — **refine** them (tighten filters,
rename) or **add your own**: pick the site, or paste a search URL from a board
we don't have yet, and a tight search beats a broad one every time. Put the
tasks you rely on **on a schedule** so fresh jobs arrive without you lifting a
finger. Only runs spend credits.

## 3. Let matching do the triage

After a scrape, jobs are scored against your profile. Work from your
[top matches](/jobs?minScore=50) down instead of reading everything. Low scores
are usually a sign the search is too broad — tighten the Import Task's filters.

Which jobs get scored at all is a separate set of preferences, in
[Match Config](/jobs/import/config) — including whether jobs other people
imported are scored for you too. See **[Matching & alerts](/guide/matching)**.

## 4. Use AI for the writing, not the thinking

For jobs you like, generate a **cover letter**, **application answers**, or a
**follow-up** — then edit. (Choosing which resume to send, and tailoring one to
a posting, is a separate thing and does not rewrite a word: see
**[Resumes & CVs](/guide/resumes-and-cvs)**.) The output is a strong first draft tuned to your
profile and that specific job; it's there to save you the blank page, not to
send unread.

## 5. Keep the tracker honest

Log applications, interviews, and follow-ups as you go. The
[tracker](/applications) is what turns a pile of tabs into a pipeline you can
actually manage.

Once something reaches an interview, the answers you'll be asked for are worth
writing down once rather than improvising each time —
**[Interview prep](/guide/interview-prep)** — and the number you want is worth
settling before anyone asks you for it: **[Salary prep](/guide/salary-prep)**.
