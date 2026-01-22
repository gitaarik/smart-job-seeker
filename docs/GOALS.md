# Goals

## Better profile management

### Current situation

- Right now, we have configuration for a default profile, and that default
  profile is used for export scripts in @package.json
- These scripts export files to @src/lib/exports/ or @dist/
- The default profile is also used for making the portfolio website at the root
  of the Sveltekit app

### Desired situation

- Exports:
  - The export scripts should take a profile ID, and export for that profile,
    and the exports should end up in a new Directus collection `profile_exports`
    - The default profile should still be used when you don't specify a specific
      profile
  - This `profile_exports` collection should have a field for the type of file
    (pdf, html, json, txt, docx) and a field for whether it's a resume or a CV
    or a structured data export file
  - And of course the user's profile should be referenced in this collection
- Portfolio website:
  - Move the portfolio websites to a sub-route `portfolio/<user-id>/`
  - Leave the index route empty for now, we'll use it later for something else

## User profile access in Directus

### Current situation

- In Directus, users can see and view any instances in any directus collection
  that are, or are related to, other user's profiles
- For example, any Directus user can:
  - See profiles of other users in the `profiles` collection
  - See applications of other users in the `applications` collection (related
    through the `profile` field)
  - See application questions of other users in the `application_questions`
    collection (related through `application.profile`)

### Desired situation

- Users should only see and be able to access collections related to it's own
  profile

## Basic B2B site with user-signup

### Current situation

- No way for users to sign-up
- No B2B page with basic information about the platform, homepage, features etc.

## Desired situation

- A basic B2B homepage with:
  - An attractive homepage that very concisely gives the user an idea of the
    project and it's features
  - A sign-up page where the user can create an account with email & password
    and works with a regular email verification flow
  - A login page where the user can login and then gets redirected to Directus,
    which is basically the logged in area.
- Technical notes:
  - Make the homepage in the Sveltekit app
  - Use Tailwind for styling, keep the styling basic so I can later adjust it to
    desire
  - Keep JS and fancy stuff to a minimum for now, just keep it very basic, so I
    can expand on it later
  - Use mailchecker to validate the email addresses during sign-up:
    https://github.com/FGRibreau/mailchecker
  - When creating an account, an account for accessing Directus should probably
    (?) also be created, or we could just use Directus's user accounts directly
    and only, maybe by using Directus's API. I'm not completely sure what's the
    best idea here. Help me out.

## Account subscription types and payments

### Current situation

- All users can use all features, there's no difference in account privileges
- There's no way for users to pay to upgrade their account to get more features

### Desired situation

- There should be a few different subscription types:
  - Trial:
    - Gives access to Pro features for first 2 weeks after sign-up
  - Basic (occasional job hunting):
    - Profile import
    - Configure up to 3 job searches
    - Match jobs with your profile
    - Your job searches and job matching tasks run every 2 days
    - Configure notifications for matching jobs with a minimum score
    - Generate Resume / CV in various formats (pdf, html, txt)
  - Pro (active job hunting):
    - All of Basic
    - The job searches and job matching tasks run every day
    - Profile import & export
    - Configure up to 5 profiles
    - Configure up to 15 job searches
    - Personal portfolio website
    - AI assistance for:
      - Writing cover letters
      - Answering application questions
  - Max (recruiters):
    - All of Pro
    - Your job searches and job matching tasks run every 6 hours
    - Unlimited job searches
    - Unlimited profiles
