#!/usr/bin/env bash
set -euo pipefail
hosts=(kafka elasticsearch zookeeper rt-fraud-pipeline-taskmanager-1)

for h in "${hosts[@]}"; do
  echo -n "Resolving $h from flink-jobmanager ... "
  docker exec flink-jobmanager getent hosts "$h" >/dev/null
  echo "OK"
done
