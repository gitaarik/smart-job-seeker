#!/usr/bin/env bash
set -euo pipefail

# Flags mirror Dockerfile.production:
# --legacy-peer-deps: @langchain/community → stagehand@1.x wants zod@^3, project on zod@^4.
# --ignore-scripts: skip third-party lifecycle scripts (security + tests don't need them).
# --include=dev: ensure devDeps install (vitest, plugins).
npm ci --ignore-scripts --include=dev --legacy-peer-deps
npm test
