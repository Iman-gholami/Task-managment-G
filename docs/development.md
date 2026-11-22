# Development and operations

## Local startup

Use Node.js 22.13 or newer and run `npm ci`. Set `DATABASE_PATH` to an isolated SQLite file for development. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for first use of a database with no active Security Manager. Use a password of at least eight characters. `ADMIN_NAME` defaults to `Administrator`. Run `npm run dev`; the normal port is 3000.

| Setting | Purpose |
|---|---|
| `PORT` | HTTP port. Playwright defaults to 3100. |
| `DATABASE_PATH` | SQLite file. The application default is `data/sentinel.db` under the process working directory. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Administrator bootstrap when there is no active Security Manager. |
| `COOKIE_SECURE=true` | Marks the session cookie Secure for HTTPS deployments. |

## Testing

- `npm run test:unit` runs the explicit file list in [package.json](../package.json).
- Run a focused unit suite with the same Node options used by the script. The loader resolves the repository's `@/` aliases and the React server condition allows imports of server modules.

  ```sh
  node --disable-warning=ExperimentalWarning --conditions=react-server \
    --import ./tests/support/server-modules.mjs --test tests/shift-excel.unit.test.mjs
  ```

- For Playwright, install Chromium with `npx playwright install chromium` or set `CHROMIUM_PATH` to an existing browser executable. Run `npm run build`, then `npx playwright test tests/shift-roster.spec.js` for an example focused suite. Run all of `app.spec.js` or `shift-checklists.spec.js` when testing a flow that depends on fixture creation in an earlier case in that file.
- For the full check, run `npm run build` followed by `npm test`. [Playwright](../playwright.config.js) starts the production server with a new temporary database and test administrator. It uses one worker because tests share that database. [CI](../.github/workflows/shift-feature-ci.yml) installs dependencies, runs units, builds, and runs Playwright.
- `node scripts/palette.mjs` checks palette contrast. `npm run seed:shifts` is a data-writing utility for a fixed historical roster window (Mehr 1405) and requires existing SOC analysts. Use the test harness for repeatable fixtures.

## Database and upgrades

[db.js](../lib/server/db.js) opens the database on first access using Node's synchronous SQLite driver. It enables WAL, foreign keys, and a busy timeout. Opening creates missing tables and applies guarded upgrades, including legacy transition backfill, checklist seeding, cleanup of legacy sample accounts and their sample records, and administrator bootstrap when needed. Application startup or the first request can therefore write to the configured database. Existing historical records may include legacy formats, so inspect the migration and unit coverage when changing storage.

Attachment metadata lives in the database and file contents live in an `uploads/` directory beside it. Keep both on persistent writable storage. For backup or upgrade, capture a consistent SQLite backup and the matching attachments. A live WAL database can have committed data in its WAL file, so use a SQLite-aware backup or quiesce the application before taking a file snapshot.

## Offline deployment

The source-install workflow builds with `npm run build` and starts with `npm start`. Prepare dependencies in a connected environment or use an existing dependency cache. The [root layout](../app/layout.js) loads Geist, Geist Mono, and the bundled [Vazirmatn Arabic-script subset](../styles/fonts/Vazirmatn-Arabic-Variable.woff2) through `next/font/local`. The build packages these fonts as local assets, so font loading needs no external requests during build or at runtime. ECharts and ExcelJS ship with the application.

For an isolated target, prepare the runtime artifact in a connected environment for the target OS and architecture. With Next.js standalone output enabled, include the standalone output and its `.next/static` assets, then use the generated `server.js` entry point. Keep database and upload storage outside the replaceable artifact and supply the runtime environment on the target. This describes artifact requirements. Use the deployment process established for the target environment.
