#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
export E2E_RUN_ID="$RUN_ID"

COMPOSE_BASE="docker-compose.yml"
COMPOSE_E2E="ops/e2e/docker-compose.e2e.yml"

# Use unique consumer groups per run to avoid old offsets
export FLINK_CONSUMER_GROUP="fraud-detector-e2e-${RUN_ID}"
export API_CONSUMER_GROUP="api-alert-streamer-e2e-${RUN_ID}"

# --- helpers ---
wait_http() {
  local url="$1" name="$2" tries="${3:-60}"
  echo "[wait] $name $url"
  for i in $(seq 1 "$tries"); do
    if curl -sf "$url" >/dev/null; then echo "[ok] $name"; return 0; fi
    sleep 1
  done
  echo "[fail] $name not ready: $url" >&2
  return 1
}

wait_container_healthy() {
  local cname="$1" tries="${2:-60}"
  echo "[wait] container healthy: $cname"
  for i in $(seq 1 "$tries"); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$cname" 2>/dev/null || true)"
    if [[ "$status" == "healthy" ]]; then echo "[ok] $cname healthy"; return 0; fi
    sleep 1
  done
  echo "[fail] $cname not healthy" >&2
  docker ps --format 'table {{.Names}}\t{{.Status}}'
  return 1
}

kafka_peek() {
  local topic="$1" max="${2:-1}" timeout="${3:-8000}"
  docker exec -i kafka bash -lc \
    "kafka-console-consumer --bootstrap-server kafka:9092 --topic '${topic}' --max-messages ${max} --timeout-ms ${timeout} >/dev/null"
}

es_count() {
  curl -s "http://localhost:9200/fraud-alerts*/_count" | python -c 'import sys, json; print(json.load(sys.stdin).get("count", -1))'
}

# --- build jar ---
echo "[step] build flink job jar"
mvn -q -f flink-fraud-detector/pom.xml -DskipTests package

JAR="$(ls -1 flink-fraud-detector/target/*SNAPSHOT.jar | head -n 1)"
cp -f "$JAR" flink/remote/fraud-detector.jar
echo "[ok] jar -> flink/remote/fraud-detector.jar"

# --- start services ---
echo "[step] docker compose up (core services)"
docker compose -f "$COMPOSE_BASE" -f "$COMPOSE_E2E" up -d zookeeper kafka elasticsearch kibana jobmanager taskmanager api

wait_container_healthy zookeeper 60
wait_container_healthy kafka 90
wait_container_healthy elasticsearch 90
wait_container_healthy kibana 120
wait_container_healthy flink-jobmanager 90

wait_http "http://localhost:3001/health" "api/health" 60
wait_http "http://localhost:8081/overview" "flink/overview" 60

# --- submit flink job ---
echo "[step] submit flink job"
SUBMIT_OUT="$(docker exec -i flink-jobmanager bash -lc "flink run -d /remote/fraud-detector.jar" || true)"
echo "$SUBMIT_OUT"

# Try to extract JobID (best effort)
JOB_ID="$(echo "$SUBMIT_OUT" | grep -Eo 'JobID [0-9a-f]+' | awk '{print $2}' | tail -n 1 || true)"
echo "[info] flink job id=${JOB_ID:-unknown}"

# --- verify kafka topic traffic path (transactions) ---
echo "[step] run generator scenario: RULES (high amount + some hot accounts)"
python data-generator/data_generator.py \
  --bootstrap-servers localhost:29092 --topic transactions \
  --mode sample --rate 80 --duration 20 \
  --mix rules \
  --account-pool 200 --merchant-pool 200 \
  --hot-accounts 1 --hot-ratio 1.0 \
  --event-time-days 0 \
  --log-every 2000

echo "[check] kafka: transactions has messages"
kafka_peek transactions 1 8000
echo "[ok] kafka transactions present"

echo "[check] kafka: fraud_alerts has messages"
kafka_peek fraud_alerts 1 15000
echo "[ok] kafka fraud_alerts present"

# --- verify ES sink ---
echo "[check] elasticsearch has alerts"
for i in $(seq 1 30); do
  c="$(es_count)"
  if [[ "$c" -ge 1 ]]; then echo "[ok] es alerts count=$c"; break; fi
  sleep 1
done
c="$(es_count)"
if [[ "$c" -lt 1 ]]; then
  echo "[fail] no alerts in ES" >&2
  exit 1
fi

# --- verify API endpoints ---
echo "[check] api /api/alerts returns items"
curl -sf "http://localhost:3001/api/alerts?limit=1" | python - <<'PY'
import sys, json
d=json.load(sys.stdin)
items=d.get("items",[])
assert isinstance(items, list)
assert len(items)>=1, "no items from api"
print("[ok] api alerts items=", len(items))
PY

# --- latency probe via ws (proxy for UI) ---
echo "[step] ws latency probe (20s) — requires txTimestamp patch to be meaningful"
node ops/e2e/ws_probe.mjs --url http://localhost:3001 --seconds 20 || true

echo "[done] e2e run id=$RUN_ID"
