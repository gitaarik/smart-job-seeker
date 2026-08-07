# Migrations

Two files build the whole database. That is deliberate, and recent.

## Why there are only two

Until 2026-08-04 this folder held 77 migrations, and `0000` was a 130-byte
comment: _"Initial introspection migration (no-op) — the database schema already
exists."_ The set had been baselined against the pre-Drizzle (Prisma) database,
so it carried every change since April 2026 and **nothing that created what came
before** — 72 of the 100 tables were created by no migration at all.

That was invisible because every environment descended from that original
database. It would have surfaced the first time anyone built a new one: a second
preview, a real production, a restore from anything other than a dump.
`scripts/check-migrations.ts` found it by trying.

So the history was squashed:

| file                        | what it is                                                        |
| --------------------------- | ----------------------------------------------------------------- |
| `0000_sturdy_nighthawk.sql` | the whole schema as of the old `0075`, generated from `schema.ts` |
| `0001_white_king_cobra.sql` | `applications.context_details` — the old `0076`                   |

**Older migration numbers referenced elsewhere no longer exist as files.**
Planning docs and commit messages mention things like "migration 0043" or
"migration 0075"; those are historical references to a history that now lives
only in git.

## How the baseline is skipped on existing databases

drizzle-orm's migrator reads only the **most recently applied** row and applies
anything stamped later:

```js
if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis)
```

So the timestamps in `meta/_journal.json` are load-bearing, not decorative:

- `0000` carries **1776541521904** (2026-04-18), the original baseline's stamp.
  Every existing environment has applied something newer, so every existing
  environment skips it. A fresh database has no rows at all, so it runs.
- `0001` carries **1785867483361**, the old `0076`'s stamp — newer than
  preview's high-water mark, so preview still applies it exactly as it would
  have before.

Verified by simulation before landing: a database at the old `0075` with
preview's real high-water mark skips the baseline, applies `0001`, and ends up
with 100 tables and the new column.

Note what this implies. **A migration stamped earlier than one already applied
is silently skipped forever.** Hand-editing `when` is how the squash works and
is also how you would quietly lose a migration; leave it to `generate` unless
you are doing this again.

The `hash` column is never compared — only `created_at` is. Editing an old
migration's SQL therefore changes nothing anywhere, which is not a licence to
edit them.

## Checking

```bash
docker compose exec -T app npx tsx scripts/check-migrations.ts
```

Builds one database by running these files from empty and another by pushing
`schema.ts`, then compares catalogs. It also catches the everyday mistake:
editing `schema.ts`, pushing to dev, and forgetting to `generate`.
