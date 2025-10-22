#!/usr/bin/env bash
set -euo pipefail
BOOT="${1:-localhost:9092}"

echo "Waiting for Kafka at $BOOT ..."
for i in {1..90}; do
  if docker exec kafka bash -lc "kafka-topics --bootstrap-server $BOOT --list >/dev/null 2>&1"; then
    echo "Kafka is ready."
    exit 0
  fi
  sleep 2
done
echo "Kafka NOT ready after timeout." >&2
exit 1
