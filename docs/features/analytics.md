# Analytics

Open `/analytics` or the Teams, People, Compare, Trends, SOC, Alerts, and Report views under it. Personal statistics use `/analytics/people/[id]`.

| Change | Start here |
|---|---|
| Access and facts | `lib/server/analytics-access.js`, `app/api/analytics/route.js`, and `lib/server/analytics.js` (`scopeFor`, `resolveWindow`, `factsFor`). |
| URL filters, province, and periods | `components/analytics/{AnalyticsContext,FilterBar}.js`, `lib/analytics/{filters,periods,calendar}.js`. |
| Metrics, charts, alerts | `lib/analytics/metrics.js` (`aggregate`, `stats`), `alerts.js`, `insights.js`, and `components/analytics/screens/`. |
| Peer scoring | `components/analytics/PeerLeaderboard.js`, `lib/analytics/performance.js` (`taskPoints`, `cohortFor`, `scoreLeaderboard`), and `SCORE` in `lib/analytics/config.js`. |
| Excel exports | `app/api/analytics/export/route.js` and `lib/server/analytics-export.js` (`analyticsWorkbook`). |

Security Managers and observers receive department-scoped facts, SOC Managers receive SOC scope, and other viewers receive their own data, with anonymous medians when eligible. Province filters the data within the viewer's scope and is carried into exports. Observers can use demo data and the read-side Compare leaderboard through management analytics. Shift review writes still require an authorized manager. The same-level Compare leaderboard uses task complexity and quality, a late-submission factor, and eligible monthly shift reviews. The score is separate from ordinary aggregates and Excel. Workbooks follow the view filters. Chart actions provide CSV and PNG, and the executive report supports printing or saving to PDF.

Date conversion, like-for-like comparisons, filtering, and metrics are reused across browser views and workbook generation. Verify both when changing a definition. The [analytics design](../../design/ANALYTICS.md) records metric definitions, thresholds, and rationale.

**Verify** with `analytics.unit.test.mjs`, `weighted-score.unit.test.mjs`, `province-observer.unit.test.mjs`, `province-observer.spec.js`, and the analytics cases in `app.spec.js`. See [test commands](../development.md#testing).
