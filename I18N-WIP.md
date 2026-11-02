# Bilingual interface: work in progress

This branch is a checkpoint based on PR #31, not a release candidate. Do not merge it until the remaining work and full browser verification below are complete.

Implemented so far: a persisted Persian/English language selector, document direction, manually reviewed dictionaries for much of the product-owned interface, localized task date controls, and tests for the locale and task date primitives. User-authored task titles, comments, names, reports and file names must remain unchanged.

Known incomplete work:

- Localize dynamic labels, template strings, validation and API errors, notification messages, permissions, theme and shortcut menus, user/team/province presentation, task and shift status summaries, chart data, tooltips, periods, numbers, weekdays and dates. Server-generated Excel reports and export labels need a locale-aware policy as well.
- Complete both languages across shift calendars, checklists, dashboards, analytics, performance, reports, account and administrative views. Do not run user content through the product-copy dictionary; system-owned checklist defaults require a reliable identity before translating.
- Finish RTL/LTR layout and responsive accessibility, including popovers, calendars, charts and mixed-direction user data. Review language switching while editing for state preservation.
- Adapt existing tests to the actual language under test, run the complete browser suite in CI, exercise both languages, desktop notification delivery, persistence after reload, and check translated strings in every role. Run visual review on desktop and mobile.
- The new browser test has not yet been executed. A production build and the 62 unit tests passed locally; HTTP server-render checks covered both language cookies but do not validate interactions or hydrated chart content.

PR #31 remains the integration target and must stay draft until the user tests the completed feature.
