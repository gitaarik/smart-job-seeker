<!--
  Public-profile root page is disabled — `+page.server.ts` throws 404 before
  this template ever renders. The original template referenced
  `data.profile.*` heavily; that is preserved in git history.

  The `./portfolio/` sibling is no longer disabled: it renders the public
  portfolio site through `$lib/components/PortfolioSite`. Its old
  `components/` subtree was deleted on 2026-09-11 — those 26 files were a copy
  of the standalone rikwanders.tech site and read a hardcoded `resume` object
  rather than any profile, so they could never have served anyone else. The
  renderer that replaced them reads profile data and is dressed by a
  `portfolio`-kind row in `presentation_templates`.

  This file stays minimal so it remains valid as the data contract evolves.
-->
