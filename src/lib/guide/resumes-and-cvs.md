# Resumes & CVs

You don't keep several resumes here. You keep **one profile**, and a set of
**versions** that each decide which parts of it to print.

That is the whole idea, and it's worth getting straight before anything else: a
version is a _filter over your profile_, not a copy of it. Fix a typo in a role
once and every version showing that role is fixed. Nothing goes stale in a
document you forgot you had.

Your versions live at **[Resumes & CVs](/profile/resume)**.

## Resume or CV

Every version renders as both. They come from the same profile — the **CV** is
simply the longer form, printing more than the resume does (on the standard
template: references, and fuller dates on your education).

You never choose one globally. You pick which of the two you're sending on the
application itself, and each version can be told to appear on one and not the
other.

## Making a version

On [Resumes & CVs](/profile/resume), click **Add New Version** and give it a
name — "Backend Engineer", "Data", "Short one-pager". That's the only required
field; the URL slug is generated from the name.

Under **advanced options** there is **Extends**. A version that extends another
inherits its choices and then adjusts them, which saves rebuilding a near-copy
by hand. Handy when your "Data" version is your "Backend" version plus two
projects and minus a role.

## Deciding what goes on it

Nothing is dragged into a version. Instead, each item on your profile carries
its own rule, set from the **tags** button on that item:

- **All versions** — the default. It prints everywhere.
- **Show only on** — pick versions, and it appears on those and nowhere else.
- **Hide from** — pick versions, and it appears everywhere except those.

You can set this at real granularity: whole roles, **individual achievements**
within a role, side projects, education, skill categories, skills and
technologies. That granularity is the point — trimming a resume is usually about
dropping three bullets, not a whole job.

`resume` and `cv` are available as targets alongside your own versions, so
"never print this on a resume, only on the longer CV" is a rule you can state
directly.

### Profile-only items

Hide something from **both** `resume` and `cv` and it becomes **profile-only**:
it still counts toward job matching, but no document prints it and the AI won't
write about it. That's the right home for a skill you'd happily discuss but
wouldn't headline. There is more on this under
[Getting the best results](/guide/getting-the-best-results).

A version can override it. Tag the item onto one version by name and it comes
back on that document alone — off by default, on where you meant it.

## Per-version settings

Open a version to find:

- **Contact details** — uncheck a field to keep it off this version's documents.
  Fields you left empty on your profile never appear anyway.
- **Use as public resume / Use as public CV** — which version answers your
  public profile link. Set neither and that link stops working entirely, leaving
  your documents reachable only through a private share link. See
  [Sharing your CV](/guide/sharing-your-cv).

## Templates, languages, PDFs

**Template** and **Language** at the top of the page are lenses over the whole
list — switch either and every preview and download below re-renders through it.
You get the built-in **Standard** template plus any custom templates on your
profile. The language selector only appears once your profile has translations.

Each version offers **Resume** and **CV**, each viewable in the browser or
downloadable as **PDF**.

## Tailoring one to a specific job

From an application's **Document for this job** tab, you can build a version
aimed at that one posting.

It picks what to **show** from everything on your profile — which achievements,
which side projects, and any skill the job asks for that your document would
otherwise hide. **It never rewrites your words.** Nothing on your profile is
edited; the tailored version is a set of exceptions layered over a version you
already have.

A few things worth knowing:

- **It starts from the version you'd otherwise send**, stated under the button.
  You can pick a different base.
- **Each version in the picker is annotated** with how much of what the job asks
  for it would actually print — _"names 3 of 7"_. That's information about the
  choice, not a recommendation.
- **Roles and skills it held back are listed**, each with a one-click way to put
  it on this job's version after all. Overriding here stays local to this job.
- **Tailored versions don't clutter your library.** They belong to their
  application. If one turns out to be generally good, **Keep in my versions**
  promotes it into the library under its own name.

## Recording what you sent

On the same tab, record which document actually went out. It's a small habit
that pays off twice: months later you can see exactly what an interviewer read,
and the pending answer is what lets the page warn you when the document you're
about to send leaves out something the job explicitly asks for.
