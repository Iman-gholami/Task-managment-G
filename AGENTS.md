<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Sentinel Ops: low-token agent routing

Before investigating or changing this repository:

1. Read **`docs/AGENT_CODEBASE_GUIDE.md` §0 and §2** for the feature-to-file/test routing map. Read only the relevant section afterward; do not load the entire codebase by default.
   The [feature index](docs/README.md) provides links by route and terminology. See the [architecture guide](docs/architecture.md) for dependencies and [development guide](docs/development.md) for setup and tests.
2. For shift swaps/exchanges (including adjacent days, `off`, `leave`, until-20:00, morning overlaps and approvals), read **`docs/SHIFT_EXCHANGE_RUNBOOK.md`** before coding.
3. Inspect the **current version** of the selected files and their tests: documentation is an index, not authority over newer code. Follow server validation and transaction boundaries, not just client UI behavior.
4. Preserve existing production SQLite data, Shift Log history, role authorization and bilingual/Jalali behavior. Use isolated SQLite data for verification because opening a database can migrate it or bootstrap an administrator. Never run tests or demo scripts against production data.
5. For Next.js API changes, also obey the Next.js 16 rule block above and consult installed framework documentation.
6. On every behavior/endpoint/schema change, update the relevant guide/runbook and add focused regression coverage in the **same change**. Keep this root file concise.

**Project:** `Iman-gholami/Task-managment-G` · **Stack:** Next.js 16 / React 19 / JavaScript / `node:sqlite`. Run commands and source-of-truth paths are in the guide; do not duplicate them here.
