# Automated air-gapped Docker releases

The **offline production** host is a Docker Compose deployment with a persistent
SQLite database and uploads on the **host**, not in the image:

- Compose: `/opt/sentinel-ops/compose.yaml`
- Data: `/srv/sentinel-ops/data` mounted as `/app/data`
- Browser port: `3000`
- Docker image name: `sentinel-ops:VERSION`

The automation never copies test databases or credentials to production. A new
release runs additive database migrations on first start; unlike the image,
migrated database contents are **not** rolled back automatically.

## One-time setup

On the **internet-connected Linux Docker builder**, after this PR is merged:

```bash
cd ~/Task-managment-G    # use your actual Git checkout
git pull --ff-only origin main
bash scripts/build-offline.sh 1.3.0
```

The build script fetches **fresh origin/main**, exports that commit into an
isolated temporary directory (so local `.env`, test DBs and uncommitted edits
cannot be included), builds for `linux/amd64` and produces:

```text
dist/sentinel-ops-1.3.0.tar
dist/sentinel-ops-1.3.0.tar.sha256
dist/sentinel-offline-update.py
```

It does **not** contact the offline server. If Docker requires elevated
permissions on the build machine, arrange Docker access for the builder or use
`sudo` for the Docker daemon only; do not build inside your production data
directory. The generated files must be readable by the Windows transfer user.

Transfer all three files to your **offline Windows desktop**, then use **Tabby
SFTP** to upload them to the **home directory of your offline Ubuntu user**,
e.g. `/home/socadmin/`, **not** `/srv/sentinel-ops/data`.

On the **offline Ubuntu VM**, install the updater once:

```bash
sudo install -o root -g root -m 0755 ~/sentinel-offline-update.py /usr/local/sbin/sentinel-offline-update
```

If the server's architecture is not `linux/amd64`, set `BUILD_PLATFORM`
on the builder to match `docker info --format '{{.Architecture}}'` on the
offline VM. The script assumes Docker Compose v2, Python 3, and a working local
loopback connection to port 3000.

## Every subsequent release

**Online Linux builder** — one command:

```bash
bash scripts/build-offline.sh 1.4.0
```

Transfer **only** the new `.tar` and `.tar.sha256` through Windows/Tabby to
the offline Linux user's home directory.

**Offline Linux** — optional preflight (no downtime), then one command:

```bash
sudo sentinel-offline-update ~/sentinel-ops-1.4.0.tar --check-only
sudo sentinel-offline-update ~/sentinel-ops-1.4.0.tar
```

The installer, in order:

1. Checks the complete TAR against its sibling SHA256 manifest and confirms
   the existing Compose service is **running** and using exactly the expected
   `/srv/sentinel-ops/data:/app/data` bind mount.
2. Checks the existing SQLite filename (including the Compose
   `DATABASE_PATH`, if set) to avoid creating a new empty DB.
3. Loads the new Docker image while the old service remains running.
4. Checks free space for a complete host-data backup, saves the original
   `compose.yaml`, stops **only the app service** and backs up the **entire
   data directory** consistently (SQLite database, WAL, SHM, uploads) to
   `/opt/sentinel-backups/`. The backup is verified with `tar -tzf`.
5. Changes **only** that Compose service's `image:` value, starts it with
   `--pull never --no-build` and polls `/api/health`. This endpoint exercises
   SQLite access, not merely the login page.
6. If startup fails, restores the prior Compose and attempts to restart the
   **previous image**. It **never automatically overwrites/restores the DB**.
   Both previous images and timestamped backups remain available for recovery.

The first deployment of a new version may sign out existing users because the
app's security policy migrated the `sessions` table; users/passwords/tasks
and old logs are not deleted by this installer.

## Important operational constraints

- **Do not** run `docker compose down -v`, remove `/srv/sentinel-ops/data`,
  or copy the online test `sentinel.db` into production.
- The installer intentionally refuses unknown Compose layouts, a missing
  database, a disconnected running container, a different data mount, and
  an extra `compose.override.yaml` rather than guessing.
- The updater uses an unprotected `/api/health` status endpoint on port 3000;
  it returns only `{"status":"ok"}` or an HTTP 503, never DB details.
- `--health-url` can be changed if the host publishes a different loopback port:
  `sudo sentinel-offline-update IMAGE.tar --health-url http://127.0.0.1:PORT/api/health`.
- The build script permits `SOURCE_REF=HEAD` for isolated **test** releases
  before merge. Production releases should use its default `origin/main`.
- Never auto-restore a pre-migration SQLite backup while users can be writing;
  coordinate an actual rollback if schema changes make the old image
  incompatible. Recovery uses the retained backup **under operator control**.
