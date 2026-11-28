# Access and members

Open `/login`, `/team`, `/admin`, or `/account` in the [local app](../development.md). Team is the member management entry point. Administration shows users and the role matrix.

| Change | Start here |
|---|---|
| Sign-in and throttling | `components/screens/Misc.js` (`Login`), `app/api/auth/login/route.js`, `lib/server/login-rate-limit.js`, `auth.js` (`login`), and `password.js` under `lib/server/`. |
| Expiry and logout | `components/SessionMonitor.js`, `app/api/auth/{activity,logout}/route.js`, `lib/session-policy.js` (`isSessionExpired`), and `lib/server/auth.js` (`getCurrentUser`, `requireUser`, `logout`). |
| Directory, roles, province | `components/screens/Team.js`, `components/ui/ProvincePicker.js`, `app/api/members/`, `lib/roles.js` (`canManageMember`, `isIranProvince`), and `lib/server/repo.js` (`createMember`, `updateMember`, `deactivateMember`). |
| Password and device appearance | `components/screens/Account.js`, `app/api/account/password/route.js`, and `components/ThemePicker.js`. |

The `so_session` cookie identifies a SQLite session. The server expires a session 12 hours after sign-in or 8 hours after the last recorded activity, whichever comes first. The dedicated activity endpoint updates the idle deadline. Ordinary requests leave both limits unchanged. Legacy sessions from before the idle policy were invalidated by a one-time migration.

Security Managers manage member roles other than Security Manager. SOC Managers manage analysts in SOC L1–L3. Deactivation revokes sessions and retains work records. The observer role has access to management analytics, performance, and reports. Task and operational permissions are enforced separately. Province is a filter attribute in analytics. See [analytics](analytics.md) for scope details.

**Verify** with `session-policy.unit.test.mjs`, `session-migration.unit.test.mjs`, `province-observer.unit.test.mjs`, `province-observer.spec.js`, and the login/member/account cases in `app.spec.js`. See [test commands](../development.md#testing).
