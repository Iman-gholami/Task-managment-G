#!/usr/bin/env python3
"""Safe, repeatable air-gapped Sentinel Ops image installer (Python 3 stdlib)."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from urllib.request import urlopen

IMAGE_PREFIX = "sentinel-ops"
IMAGE_FILENAME = re.compile(r"^sentinel-ops-([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)\.tar$")
DATA_TARGET = "/app/data"


def fail(message):
    raise RuntimeError(message)


def command(args, *, cwd=None, capture=False, quiet=False):
    if not quiet:
        print("+", " ".join(map(str, args)), flush=True)
    output = subprocess.run(
        list(map(str, args)), cwd=cwd, text=True, check=True,
        stdout=subprocess.PIPE if capture else None,
    )
    return output.stdout if capture else None


def compose_call(compose, *args, capture=False):
    return command(["docker", "compose", "-f", compose, *args], cwd=compose.parent, capture=capture)


def resolved_host(value):
    return Path(value).expanduser().resolve()


def service_from_config(compose, data_dir):
    config = json.loads(compose_call(compose, "config", "--format", "json", capture=True))
    services = config.get("services", {})
    choices = []
    for name, service in services.items():
        for volume in service.get("volumes", []):
            if (volume.get("type") == "bind"
                    and volume.get("target") == DATA_TARGET
                    and resolved_host(volume["source"]) == data_dir):
                choices.append((name, service))
                break
    if len(choices) != 1:
        fail("Expected exactly one Compose service binding %s to %s; found %d."
             % (data_dir, DATA_TARGET, len(choices)))
    name, cfg = choices[0]
    image = str(cfg.get("image", ""))
    if not image.startswith(IMAGE_PREFIX + ":"):
        fail("Selected service %s has unexpected image %r." % (name, image))
    return name, image, cfg


def effective_database_file(service, data_dir):
    environment = service.get("environment") or {}
    if isinstance(environment, list):
        environment = dict(entry.split("=", 1) for entry in environment if "=" in entry)
    database = environment.get("DATABASE_PATH") or "/app/data/sentinel.db"
    # The working directory in the image is /app.
    if not database.startswith("/"):
        database = os.path.normpath("/app/" + database)
    database = os.path.normpath(database)
    if not database.startswith(DATA_TARGET + "/"):
        fail("DATABASE_PATH is not inside /app/data: %r" % database)
    dbfile = data_dir / database[len(DATA_TARGET) + 1:]
    if not dbfile.is_file():
        fail("Refusing to create a new empty production database: missing %s" % dbfile)
    return dbfile


def verified_image_file(image_file):
    found = IMAGE_FILENAME.fullmatch(image_file.name)
    if not found:
        fail("Image filename must be sentinel-ops-VERSION.tar (e.g. sentinel-ops-1.3.0.tar).")
    sha_path = Path(str(image_file) + ".sha256")
    if not image_file.is_file() or not sha_path.is_file():
        fail("Both the TAR and its .tar.sha256 must be in the same directory.")
    line = sha_path.read_text(encoding="utf-8").strip()
    match = re.fullmatch(r"([a-fA-F0-9]{64})\s+\*?" + re.escape(image_file.name), line)
    if not match:
        fail("Invalid checksum file or incorrect image filename: %s" % sha_path)
    print("Checking SHA256 of %s..." % image_file, flush=True)
    digest = hashlib.sha256()
    with image_file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest().lower() != match.group(1).lower():
        fail("Image TAR checksum mismatch. No changes were made.")
    print("SHA256 OK", flush=True)
    return IMAGE_PREFIX + ":" + found.group(1)


def replace_service_image(source, service_name, new_image):
    """Edit only the target service's top-level image key; no PyYAML dependency."""
    lines = source.splitlines(keepends=True)
    services = next((i for i, line in enumerate(lines)
                     if re.fullmatch(r"services:\s*(?:#.*)?", line.strip())), None)
    if services is None or lines[services][:1].isspace():
        fail("Compose file has no top-level services: block.")
    start = None
    service_indent = None
    for i in range(services + 1, len(lines)):
        line = lines[i]
        if line.strip() and not line[0].isspace() and not line.lstrip().startswith("#"):
            break
        match = re.match(r"^( +)([a-zA-Z0-9_-]+):\s*(?:#.*)?$", line)
        if match and match.group(2) == service_name:
            start, service_indent = i, len(match.group(1))
            break
    if start is None:
        fail("Cannot locate service %s in compose.yaml to edit safely." % service_name)
    end = len(lines)
    for i in range(start + 1, len(lines)):
        line = lines[i]
        if line.strip() and not line.lstrip().startswith("#"):
            indent = len(line) - len(line.lstrip(" "))
            if indent <= service_indent:
                end = i
                break
    image_lines = []
    for i in range(start + 1, end):
        match = re.match(r"^( +)image:\s*(.*)$", lines[i])
        if match and len(match.group(1)) == service_indent + 2:
            image_lines.append((i, match.group(1)))
    if len(image_lines) != 1:
        fail("Expected one top-level image entry for service %s, found %d."
             % (service_name, len(image_lines)))
    pos, indent = image_lines[0]
    if "${" in lines[pos]:
        fail("Compose image uses environment substitution; refusing to replace it.")
    newline = "\r\n" if lines[pos].endswith("\r\n") else "\n"
    lines[pos] = "%simage: %s%s" % (indent, new_image, newline)
    return "".join(lines)


def check_running_mount(compose, service, data_dir):
    cid = compose_call(compose, "ps", "-q", service, capture=True).strip()
    if not cid:
        fail("Service is not running. First investigate the existing container.")
    mounts = json.loads(command(["docker", "inspect", "--format", "{{json .Mounts}}", cid], capture=True))
    if not any(m.get("Destination") == DATA_TARGET
               and m.get("Type") == "bind"
               and resolved_host(m.get("Source", "/nonexistent")) == data_dir
               for m in mounts):
        fail("Running container does not bind the original production data volume. STOP.")
    return cid


def directory_size(root):
    size = 0
    for base, _, files in os.walk(root):
        for name in files:
            path = os.path.join(base, name)
            try:
                size += os.lstat(path).st_size
            except FileNotFoundError:
                pass
    return size


def health_ok(url):
    try:
        with urlopen(url, timeout=4) as response:
            return response.status == 200 and json.load(response).get("status") == "ok"
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(description="Safely install an offline Sentinel Ops Docker image.")
    parser.add_argument("image_tar", type=Path, help="Path to sentinel-ops-VERSION.tar")
    parser.add_argument("--compose", type=Path, default=Path("/opt/sentinel-ops/compose.yaml"))
    parser.add_argument("--data-dir", type=Path, default=Path("/srv/sentinel-ops/data"))
    parser.add_argument("--backup-dir", type=Path, default=Path("/opt/sentinel-backups"))
    parser.add_argument("--health-url", default="http://127.0.0.1:3000/api/health")
    parser.add_argument("--check-only", action="store_true", help="Verify package and configuration; do not deploy")
    args = parser.parse_args()

    if os.geteuid() != 0:
        fail("Run with sudo; backup, Docker and Compose require root access.")
    image_file = args.image_tar.resolve()
    compose = args.compose.resolve()
    data_dir = args.data_dir.resolve()
    if not compose.is_file() or not data_dir.is_dir():
        fail("Original Compose file or data directory is missing.")
    if (compose.parent / "compose.override.yaml").exists():
        fail("An additional Compose override exists; manual review required.")
    if not shutil.which("docker"):
        fail("Docker CLI is not installed.")
    new_image = verified_image_file(image_file)
    service, old_image, cfg = service_from_config(compose, data_dir)
    database = effective_database_file(cfg, data_dir)
    cid = check_running_mount(compose, service, data_dir)
    original_compose = compose.read_text(encoding="utf-8")
    new_compose = replace_service_image(original_compose, service, new_image)
    if new_image == old_image:
        print("Already running %s; nothing to update." % new_image)
        return
    print("Service: %s | current: %s | new: %s" % (service, old_image, new_image))
    print("Existing database: %s | container: %s" % (database, cid[:12]))
    if args.check_only:
        print("CHECK OK: no files, containers or database changed.")
        return

    backup_dir = args.backup_dir.resolve()
    if backup_dir == data_dir or data_dir in backup_dir.parents:
        fail("Backup directory must be outside the database directory.")
    backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    data_bytes = directory_size(data_dir)
    available = shutil.disk_usage(backup_dir).free
    if available < data_bytes + 50 * 1024 * 1024:
        fail("Insufficient free space for automatic complete data backup.")
    # Load while the currently running application is untouched.
    command(["docker", "load", "-i", image_file])
    command(["docker", "image", "inspect", new_image], capture=True, quiet=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    compose_backup = backup_dir / ("compose-" + timestamp + ".yaml")
    data_backup = backup_dir / ("data-" + timestamp + ".tar.gz")
    shutil.copy2(compose, compose_backup)
    os.chmod(compose_backup, 0o600)

    stopped = False
    compose_changed = False
    try:
        print("Stopping only %s for a consistent SQLite/WAL backup..." % service)
        compose_call(compose, "stop", service)
        stopped = True
        command(["tar", "-czpf", data_backup, "-C", data_dir.parent, data_dir.name])
        # An archive must be fully readable before the live database is migrated.
        subprocess.run(["tar", "-tzf", str(data_backup)], check=True, stdout=subprocess.DEVNULL)
        print("Backup OK: %s" % data_backup, flush=True)
        compose.write_text(new_compose, encoding="utf-8")
        compose_changed = True
        compose_call(compose, "config", "--quiet")
        new_service, configured_image, new_cfg = service_from_config(compose, data_dir)
        if new_service != service or configured_image != new_image:
            fail("Revised Compose config does not match the requested image/service.")
        effective_database_file(new_cfg, data_dir)
        compose_call(compose, "up", "-d", "--pull", "never", "--no-build", "--no-deps", service)
        # A successful process start is not enough: exercise DB initialization/migration.
        print("Waiting up to 120s for SQLite-backed HTTP health check...", flush=True)
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            if health_ok(args.health_url):
                print("UPDATE OK: %s is healthy; original data mount preserved." % new_image)
                print("BACKUP: %s" % data_backup)
                return
            time.sleep(3)
        fail("Health check timed out: " + args.health_url)
    except Exception as error:
        print("UPDATE FAILED: %s" % error, file=sys.stderr)
        print("Restoring previous Compose/image; never replacing the live database...", file=sys.stderr)
        if compose_changed:
            shutil.copy2(compose_backup, compose)
        if stopped:
            try:
                compose_call(compose, "up", "-d", "--pull", "never", "--no-build", "--no-deps", service)
            except Exception as rollback_error:
                print("WARNING: could not restart previous image: %s" % rollback_error, file=sys.stderr)
        print("DB schema changes, if any, are not automatically reversed. Backup remains at %s" % data_backup, file=sys.stderr)
        raise


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print("ERROR:", error, file=sys.stderr)
        sys.exit(1)
