# Connecting your own AI

Smart Job Seeker has [its own assistant](/guide/assistant) built in. If you
already work with an AI assistant somewhere else — Claude, an AI-enabled editor,
something you wrote yourself — you can point that one at your profile instead,
over the **Model Context Protocol** (MCP).

It reads the same material the built-in assistant works from, and it lives under
the same rule: it can suggest, it cannot quietly rewrite what you wrote.

## Connecting an app

1. Go to **[Connected Apps](/data/connected-apps)**.
2. Give it a **name** — just so you can tell your keys apart later.
3. Pick the **profile**. A key reaches one profile and no other.
4. Choose **what it may do** and **what it may see** — both are explained below,
   and both are decided here, once.
5. Click **Create key** and copy the key straight into your app. Treat it like a
   password.

The page also shows the **server address**. Almost every client needs exactly
two things: that address, and the key as a bearer token.

For Claude Code that is one command:

```
claude mcp add --transport http smart-job-seeker \
  https://YOUR-ADDRESS/api/mcp \
  --header "Authorization: Bearer sjsmcp_your-key-here"
```

For Claude Desktop and most other clients, add a **custom connector** pointed at
the same address, and paste the key where it asks for a token.

If you lose the key, you don't have to mint a new one — Connected Apps still
shows it, so a client can be set up again.

## What may it do?

This is chosen once, when you create the key, rather than in a prompt that pops
up on every action. That is deliberate: a prompt you see fifty times is one you
stop reading.

- **Read only** — it can see your profile and nothing more. It is not even
  offered the tools to change something, and would be refused if it tried.
- **Ask before changing** _(recommended)_ — it can see your profile and ask for
  changes. Nothing is written until you say yes.
- **Add things directly** — it can add new entries and fill in blanks without
  asking.

**One rule holds whichever you pick:** rewriting something you wrote, and hiding
an entry, always need your approval here, in this app. No setting turns that
off, and the app on the other end cannot approve on your behalf — which is
the entire reason approval happens here and not there.

Even with "Add things directly", writes stop being direct in bulk: after **20 in
an hour** on one profile, the rest become requests waiting for you. An assistant
that gets carried away fills a review queue, not your profile. Changes you
approved yourself don't count towards that — reviewing things carefully should
not be what runs you out of room.

## What may it see?

- **Your own record** _(recommended)_ — your profile, your jobs, your
  applications and their history. That includes what each attachment is
  _called_, but not what it says.
- **Everything you have collected** — also the _text_ of what you attached and
  were sent: interview transcripts, recruiter emails, offers, uploaded
  documents.

The line sits there because that is where authorship changes. Everything in the
first was written by you or by this app. The text in the second was written by
someone else, and can say anything at all — including things aimed at the
assistant that ends up reading it. Give the second only to an app you would
happily forward that correspondence to.

An app tidying up your CV does not need your inbox.

## Approving and undoing

Anything waiting for you is at **[Recent Changes](/data/ai-changes)**, pending
items first, each showing what would change and what it would change _from_. The
same page lists everything already applied, and most of it can be undone —
newest first, so undoing one never leaves a later change sitting on a value
nobody chose.

## Revoking

Any key, any time, from [Connected Apps](/data/connected-apps) → **Revoke**. It
stops working immediately. What that app asked for stays on the record, which is
usually the thing you wanted to look at in the first place.

Every key also shows when it was **last used**, so a connection you have
forgotten about is visible rather than silent.

## What a connected app can't do

It gets your record and the profile edits — not the whole product. Running job
searches, writing tailored CVs and cover letters, interview and salary prep,
share links, import and export all stay yours to do in the app. Ask a connected
assistant for one of those and it should tell you so, and name the page.
