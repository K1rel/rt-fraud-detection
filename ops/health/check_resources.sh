#!/usr/bin/env bash
set -euo pipefail

THRESHOLD_MB="${THRESHOLD_MB:-6000}"
targets='^(zookeeper|kafka|elasticsearch|kibana|flink-jobmanager|rt-fraud-detection-taskmanager-1)$'

# Collect stats once
mapfile -t lines < <(docker stats --no-stream --format '{{.Name}} {{.MemUsage}}')

total=0
printf "%-20s %10s\n" "CONTAINER" "MiB"
for line in "${lines[@]}"; do
  name="${line%% *}"
  memraw="${line#* }"            # e.g. "233.5MiB / 7.689GiB"
  [[ "$name" =~ $targets ]] || continue
  used="${memraw%% *}"           # "233.5MiB"
  num="${used%[KMG]iB}"          # "233.5"
  unit="${used#$num}"            # "MiB"

  # normalize decimal separator
  num="${num/,/.}"

  mb=0
  case "$unit" in
    GiB) mb=$(awk -v v="$num" 'BEGIN{printf "%.0f", v*1024}') ;;
    MiB) mb=$(awk -v v="$num" 'BEGIN{printf "%.0f", v}') ;;
    KiB) mb=$(awk -v v="$num" 'BEGIN{printf "%.0f", v/1024}') ;;
    *)   mb=0 ;;
  esac
  printf "%-20s %10s\n" "$name" "$mb"
  total=$(( total + mb ))
done

echo "----------------------------"
echo "TOTAL (MiB): $total"
if (( total > THRESHOLD_MB )); then
  echo "Resource check FAIL: $total MiB > ${THRESHOLD_MB} MiB" >&2
  exit 1
else
  echo "Resource check OK: $total MiB <= ${THRESHOLD_MB} MiB"
fi
