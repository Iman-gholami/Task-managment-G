#!/usr/bin/env bash
# Run on an INTERNET-CONNECTED Linux Docker builder. Never needs the production DB.
set -Eeuo pipefail

usage() {
  echo "Usage: bash scripts/build-offline.sh VERSION (e.g. 1.3.0)" >&2
  exit 2
}
[[ $# -eq 1 ]] || usage
version="$1"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || usage

for cmd in git docker tar sha256sum mktemp; do
  command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 1; }
done
docker_cmd=(docker)
if ! docker info >/dev/null 2>&1; then
  command -v sudo >/dev/null || { echo "Docker requires root privileges and sudo is unavailable" >&2; exit 1; }
  echo "Docker daemon requires elevated access; using sudo for Docker commands only."
  docker_cmd=(sudo docker)
fi
root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
out_dir="${DIST_DIR:-$root/dist}"
platform="${BUILD_PLATFORM:-linux/amd64}"
ref="${SOURCE_REF:-origin/main}"
image="sentinel-ops:$version"
filename="sentinel-ops-$version.tar"

echo "Fetching latest main from GitHub..."
git -C "$root" fetch origin main
# SOURCE_REF is for explicit pre-merge testing. Normal releases always use origin/main.
revision="$(git -C "$root" rev-parse --verify "$ref^{commit}")"
if [[ "$ref" == "origin/main" ]]; then
  echo "Building main at $revision"
else
  echo "WARNING: building non-main ref $ref at $revision" >&2
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/source" "$out_dir"
git -C "$root" archive --format=tar "$revision" | tar -xf - -C "$tmp/source"
test -f "$tmp/source/Dockerfile" || { echo "No Dockerfile at $ref" >&2; exit 1; }

echo "Building $image ($platform)..."
"${docker_cmd[@]}" build --pull --platform "$platform" --build-arg "GIT_REV=$revision" \
  --tag "$image" "$tmp/source"

echo "Exporting image and checksum..."
"${docker_cmd[@]}" save "$image" > "$tmp/$filename"
mv "$tmp/$filename" "$out_dir/$filename"
(cd "$out_dir" && sha256sum "$filename" > "$filename.sha256")
# The installer only needs to be copied to the offline server once.
cp "$tmp/source/scripts/offline-update.py" "$out_dir/sentinel-offline-update.py"

echo
echo "READY: $out_dir/$filename"
echo "CHECKSUM: $out_dir/$filename.sha256"
echo "ONE-TIME INSTALLER: $out_dir/sentinel-offline-update.py"
echo "GIT REVISION: $revision"
