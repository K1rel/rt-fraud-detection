#!/usr/bin/env bash
set -euo pipefail
echo -n "HTTP GET elasticsearch:9200 from flink-jobmanager ... "
docker exec flink-jobmanager curl -fsS http://elasticsearch:9200 >/dev/null
echo "OK"
