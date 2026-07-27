// Conventional Commits — https://www.conventionalcommits.org/
// Validates PR + push commit messages via .github/workflows/commitlint.yml.
//
// Local use (optional):
//   npx --package=@commitlint/cli --package=@commitlint/config-conventional \
//     -- commitlint --from origin/main
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Dependabot bodies open with "Bumps [pkg](url) from x to y." — 103 chars
    // for prettier-plugin-svelte, past the 100-char default. Current commitlint
    // exempts lines that are mostly an unbreakable URL, but the commitlint
    // pinned inside wagoid/commitlint-github-action@v6 does not, so the rule is
    // a CI-only false positive. It also skips dependabot[bot] on the PR, so it
    // fires solely on the main push — after the squash, where the message can
    // no longer be fixed without rewriting history. Off.
    "body-max-line-length": [0],
  },
};
