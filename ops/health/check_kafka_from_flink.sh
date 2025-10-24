#!/usr/bin/env bash
set -euo pipefail
echo -n "TCP connect to kafka:9092 from flink-jobmanager ... "
docker exec flink-jobmanager bash -lc 'exec 3<>/dev/tcp/kafka/9092; echo -n | cat - >/dev/null 2>&1; exec 3>&- 2>/dev/null || true'
echo "OK"
