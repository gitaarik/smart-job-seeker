# Your data

Everything you put into Smart Job Seeker can be taken back out, and the account
can be deleted outright. This page is how.

## Exporting

[Export](/data/profile-export) writes your data to a file you keep. Two scopes:

- **Profile only** — resume, skills, experience.
- **Full account** — that, plus stories, notes and salary settings.

Attached documents are the one category big enough to be worth declining, so
they're a separate toggle rather than always included.

Your **settings** export separately, as a `settings.json`: your match config and
your email digest preferences. Useful when you run more than one profile and
want the second to behave like the first.

## Importing

[Import](/data/profile-import) reads an archive back in, and shows you a
**diff first** — what would change, before anything changes. There are two ways
to land it:

- **Create a new profile** — leaves your existing profiles untouched. This is
  the safe one, and the default.
- **Replace the selected profile** — deletes the content the archive carries and
  puts the archive's version in its place.

> **Replace cannot be undone.** The experience, projects, skills, CV versions
> and uploaded documents of the profile you're replacing are deleted first. A
> full-account archive replaces applications, stories and cheat sheets too; a
> profile-only archive leaves those alone. Salary expectations and job search
> settings are never touched by an import.
>
> If you're restoring a backup because something went wrong, import it as a
> **new profile** and compare the two before you delete anything.

## Deleting your account

[Delete Account](/data/delete) is a real deletion, not a hidden one. Your data is
removed rather than anonymised — "we kept it with your name filed off" is not
what most people mean when they ask to be deleted.

How it works:

- **Access is revoked immediately.** From the moment you confirm, you can't sign
  in.
- **The data is removed after 30 days.** That window is deliberately the same
  length as the backups, so the day it's gone from the database is the day it's
  gone from the backups too — no asterisk.
- **There is no self-service undo**, which follows from access being revoked
  straight away: someone who cannot sign in cannot click cancel. If you change
  your mind inside the window, contact support — restoring is something we do,
  not something a link does. That is also the protection against someone else
  using your open session to destroy your account.
- **Payment history is kept**, detached from you, because invoices have a
  statutory retention period of their own.

If you only want to get rid of _one_ profile rather than the account, that's on
[Profile Settings](/data/settings) instead.
