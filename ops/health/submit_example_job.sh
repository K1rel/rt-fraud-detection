#!/usr/bin/env bash
set -euo pipefail
# Try to submit a built-in example if present; otherwise exit 2 (skip).
JAR_CANDIDATES=(
  "/opt/flink/examples/streaming/TopSpeedWindowing.jar"
  "/opt/flink/examples/streaming/WindowJoin.jar"
  "/opt/flink/examples/streaming/SocketWindowWordCount.jar"
)

echo "Attempting to submit a built-in Flink example (detached) ..."
found=""
for F in "${JAR_CANDIDATES[@]}"; do
  if docker exec flink-jobmanager bash -lc "[ -f '$F' ]"; then
    found="$F"; break
  fi
done

if [ -z "$found" ]; then
  echo "No example JAR found in container. Skipping (code 2)."
  exit 2
fi

docker exec flink-jobmanager bash -lc "/opt/flink/bin/flink run -d -m http://flink-jobmanager:8081 '$found' > /tmp/flink_submit.out 2>&1 || true"
if docker exec flink-jobmanager bash -lc "grep -q 'Job has been submitted with JobID' /tmp/flink_submit.out"; then
  echo "Submission OK ($(basename "$found"))."
  exit 0
else
  echo "Submission attempt failed:"
  docker exec flink-jobmanager bash -lc "cat /tmp/flink_submit.out || true"
  exit 1
fi
