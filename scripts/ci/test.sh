#!/usr/bin/env bash
set -euo pipefail

# Flags mirror Dockerfile.production:
# --legacy-peer-deps: @langchain/community → stagehand@1.x wants zod@^3, project on zod@^4.
# --ignore-scripts: skip third-party lifecycle scripts (security + tests don't need them).
# --include=dev: ensure devDeps install (vitest, plugins).
npm ci --ignore-scripts --include=dev --legacy-peer-deps
npm test

# Guard the production build. The unit suite never exercises it, and the only
# other place `vite build` runs is the release image (Dockerfile.app-production),
# so without this a build-breaking change — a removed Vite plugin, a dependency
# bump that shifts a module graph — passes every PR check and first surfaces
# when a tag is cut.
#
# `--ignore-scripts` above skips the `prepare` hook, so svelte-kit sync has to
# be explicit; it generates .svelte-kit/tsconfig.json and the route types the
# build reads.
#
# SJS_BUILDING makes getEnv() hand back placeholders instead of throwing, which
# is exactly how the Dockerfile builds it — so this needs no secrets, no
# dotenvx key, and no decrypted .env in CI.
npx svelte-kit sync
SJS_BUILDING=true npx vite build
