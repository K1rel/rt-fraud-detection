#!/usr/bin/env bash
set -euo pipefail
BOOT="localhost:9092"
PARTITIONS="${PARTITIONS:-6}"   # 6 ∈ [4..8]
RF="${RF:-1}"

topics=( "transactions" "fraud_alerts" )

DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$DIR/wait_kafka.sh" "$BOOT"

for t in "${topics[@]}"; do
  if docker exec kafka bash -lc "kafka-topics --bootstrap-server $BOOT --describe --topic '$t' >/dev/null 2>&1"; then
    echo "Topic '$t' already exists. Skipping."
  else
    echo "Creating topic '$t' with partitions=$PARTITIONS RF=$RF"
    docker exec kafka bash -lc "kafka-topics --bootstrap-server $BOOT --create --topic '$t' --partitions $PARTITIONS --replication-factor $RF"
  fi
done

echo "Current topics:"
docker exec kafka bash -lc "kafka-topics --bootstrap-server $BOOT --list"
