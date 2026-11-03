# Bilingual interface: verification in progress

PR #31 remains a draft until the user tests it. The selected language is stored in a cookie and controls document direction, product copy, Solar Hijri date presentation and report exports. Database values and user-authored text remain unchanged.

The branch includes locale-aware dashboard, task, analytics, shift and reporting screens, plus tests for dates, language changes, generated analytics, notifications, session expiry and preserving user-provided text. On the preceding PR commit, the full browser suite passed all 91 tests. Further changes since then require a fresh build, unit run and browser run on the latest commit.

Before handing off, review the latest CI result and check representative desktop and mobile layouts, especially live language switching, menus and shift workflows. Treat unknown historical messages or user-supplied checklist text as authored data; do not translate those by guessing.
