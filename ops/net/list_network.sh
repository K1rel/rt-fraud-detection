#!/usr/bin/env bash
set -euo pipefail
NET="${1:-fraud-detection-net}"

if ! docker network inspect "$NET" >/dev/null 2>&1; then
  echo "Network not found: $NET" >&2
  exit 1
fi

echo "Containers on $NET:"
docker network inspect "$NET" \
  --format '{{range $id,$c := .Containers}}{{println $c.Name}}{{end}}' | sort
