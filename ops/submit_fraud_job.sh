#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

FLINK_DIST="${REPO_ROOT}/flink-2.0.0"
FLINK_BIN="${FLINK_DIST}/bin/flink"
ENV_FILE="$REPO_ROOT/config/flink-job.env"
POM_PATH="${REPO_ROOT}/flink-fraud-detector/pom.xml"
TARGET_DIR="${REPO_ROOT}/flink-fraud-detector/target"

echo "[submit] Repo root: ${REPO_ROOT}"
echo "[submit] Using Flink at: ${FLINK_BIN}"

if [ -f "$ENV_FILE" ]; then
  echo "[submit] Loading env from $ENV_FILE"
  set -a
  . "$ENV_FILE"
  set +a
else
  echo "[submit] No $ENV_FILE found (using whatever is in the shell)."
fi

if [[ ! -f "${POM_PATH}" ]]; then
  echo "[submit] ERROR: pom.xml not found at ${POM_PATH}" >&2
  exit 1
fi

echo "[submit] Building Flink JAR..."
mvn -q -f "${POM_PATH}" -DskipTests=false clean package

if [[ ! -x "${FLINK_BIN}" ]]; then
  echo "[submit] ERROR: Flink binary not found at ${FLINK_BIN}" >&2
  echo "         Make sure flink-2.0.0 is unpacked at repo root or adjust this script."
  exit 1
fi

echo "[submit] Resolving job JAR..."
JOB_JAR_CANDIDATE="${TARGET_DIR}/flink-fraud-detector-jar-with-dependencies.jar"
if [[ -f "${JOB_JAR_CANDIDATE}" ]]; then
  JOB_JAR="${JOB_JAR_CANDIDATE}"
else
  # first jar in target
  JOB_JAR="$(ls -1 "${TARGET_DIR}"/*.jar | head -n 1)"
fi

if [[ -z "${JOB_JAR:-}" || ! -f "${JOB_JAR}" ]]; then
  echo "[submit] ERROR: No JAR found in ${TARGET_DIR}" >&2
  exit 1
fi

echo "[submit] Using job JAR: ${JOB_JAR}"
echo "[submit] Submitting FraudDetectionJob ..."

"${FLINK_BIN}" run \
  -c com.frauddetection.FraudDetectionJob \
  "${JOB_JAR}"
