#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/../net/setup_network.sh" >/dev/null

echo "== DNS from flink-jobmanager =="
"$DIR/check_dns_from_flink.sh"
echo

echo "== Kafka from flink-jobmanager =="
"$DIR/check_kafka_from_flink.sh"
echo

echo "== Elasticsearch from flink-jobmanager =="
"$DIR/check_es_from_flink.sh"
echo

echo "== Flink REST =="
"$DIR/check_flink_rest.sh"
echo

echo "== Submit example job (optional) =="
set +e
"$DIR/submit_example_job.sh"
code=$?
set -e
if [ $code -eq 2 ]; then
  echo "Note: example JAR not found; submission skipped."
elif [ $code -ne 0 ]; then
  echo "Example submission failed (non-blocking for network test)."
fi
echo

echo "== Resource usage =="
"$DIR/check_resources.sh"
