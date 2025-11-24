#!/usr/bin/env bash
set -euo pipefail
BOOT="localhost:9092"
TOPIC="${1:-transactions}"
MSG="hello-$(date -u +%s)"

DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$DIR/../wait_kafka.sh" "$BOOT"

echo "Producing one message to '$TOPIC': $MSG"
docker exec -i kafka bash -lc "kafka-console-producer --bootstrap-server $BOOT --topic '$TOPIC'" <<< "$MSG"

echo "Consuming (timeout 5s)..."
docker exec kafka bash -lc "timeout 5 kafka-console-consumer --bootstrap-server $BOOT --topic '$TOPIC' --from-beginning --max-messages 1 --property print.timestamp=true"
