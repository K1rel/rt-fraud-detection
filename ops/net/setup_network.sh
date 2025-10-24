#!/usr/bin/env bash
set -euo pipefail

NET="${1:-fraud-detection-net}"
containers=(zookeeper kafka elasticsearch kibana flink-jobmanager rt-fraud-pipeline-taskmanager-1)

if ! docker network inspect "$NET" >/dev/null 2>&1; then
  echo "Creating network: $NET"
  docker network create "$NET" >/dev/null
else
  echo "Network exists: $NET"
fi

connect() {
  local c="$1"
  # if container doesn't exist or isn't running, skip
  if ! docker inspect -f '{{.State.Running}}' "$c" >/dev/null 2>&1; then
    echo "Skip: $c (not running)"
    return 0
  fi
  # if already connected, this will error; ignore
  docker network connect "$NET" "$c" >/dev/null 2>&1 || true
  echo "Connected: $c -> $NET"
}

for c in "${containers[@]}"; do
  connect "$c"
done

echo "Done."
