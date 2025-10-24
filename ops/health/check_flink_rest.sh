#!/usr/bin/env bash
set -euo pipefail
echo -n "Flink REST (host) http://localhost:8081/overview ... "
curl -fsS http://localhost:8081/overview >/dev/null
echo "OK"
echo -n "Flink REST (in-cluster) http://flink-jobmanager:8081/overview ... "
docker exec flink-jobmanager curl -fsS http://flink-jobmanager:8081/overview >/dev/null
echo "OK"
