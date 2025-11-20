import argparse
import json
import os
import signal
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta
import random
from threading import Event
from typing import Tuple, Iterator, Any, Generator, Iterable, Optional

import numpy as np
import pandas as pd
import yaml
from pandas import DataFrame
from kafka import KafkaProducer, errors as kerrors

STOP = Event()
ACCOUNT_POOL  = 50_000
MERCHANT_POOL = 10_000

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

def mk_id(prefix: str, n: int = 6) -> str:
    return f"{prefix}-{random.randint(10**(n-1), 10**n-1)}"

def load_csv(path: str) -> tuple[DataFrame, list[str]]:
    df = pd.read_csv(path)

    needed = ["Amount", "Class"]
    if "Time" in df.columns:
        df["Time"] = df["Time"].astype(float)
    feature_cols = [c for c in df.columns if c.startswith("V")] + ["Amount"]
    for c in needed:
        if c not in df.columns:
            raise RuntimeError(f"CSV missing column: {c}")
    df[feature_cols] = df[feature_cols].astype(np.float64)
    df["Class"] = df["Class"].astype(int)
    return df, feature_cols


def jitter_features(row: pd.Series, feature_cols: list[str], scale: float = 0.02, exclude: Iterable[str] = ("Amount", )) -> dict[str, float]:
    feats = {c: float(row[c]) for c in feature_cols}
    noise = np.random.normal(0.0, scale, size=len(feature_cols))
    for i, c in enumerate(feature_cols):
        if c in exclude:
            continue
        feats[c] = float(feats[c] + noise[i])
    return feats

# Record object
Record = tuple[bytes, dict[str, Any], list[tuple[str, bytes]]]

def make_record(row: pd.Series, feature_cols: list[str], currency: str, fraud_pattern: Optional[str] = None, event_time: Optional[datetime] = None ) -> Record:
    event_id = str(uuid.uuid4())
    correlation_id = str(uuid.uuid4())
    account_id = row.get("_account_id") or mk_id("C")
    merchant_id = row.get("_merchant_id") or mk_id("M")
    amount = float(row["Amount"])
    amount_minor = int(round(amount * 100))

    if not np.isfinite(amount):
        raise ValueError(f"Non-finite amount: {amount}")

    feats:dict[str, float] = {}
    for c in feature_cols:
        v = float(row[c])
        if not np.isfinite(v):
            raise ValueError(f"Non-finite feature {c}={v!r}")
        feats[c] = v

    evt_iso = (event_time or datetime.now(timezone.utc)).isoformat(timespec="milliseconds").replace("+00:00","Z")
    payload: dict[str, Any] = {
        "schema": "transaction_v1",
        "event_id": event_id,
        "timestamp": now_iso(),
        "event_time": evt_iso,
        "account_id": account_id,
        "merchant_id": merchant_id,
        "amount": amount,
        "amount_minor": amount_minor,
        "currency": currency,
        "features": feats,
        "is_fraud_label": int(row["Class"]) if "Class" in row and not pd.isna(row["Class"]) else None,
        "fraud_pattern": fraud_pattern,
        "correlation_id": correlation_id
    }
    key: bytes = account_id.encode("utf-8")
    headers: list[tuple[str, bytes]] =[
        ("x-event-id", event_id.encode("utf-8")),
        ("x-schema", b"transaction_v1"),
        ("content-type", b"application/json"),
        ("x-correlation-id", correlation_id.encode("utf-8"))
    ]
    return key, payload, headers

def synth_amount_spike(base_row: pd.Series, feature_cols: list[str], amt_p99: float) -> tuple[pd.Series, str]:
    row = base_row.copy()
    spike = np.random.lognormal(mean=6.5, sigma=0.7)
    floor = amt_p99 * np.random.uniform(1.2, 3.0)
    row["Amount"] = float(max(spike, floor))
    feats = jitter_features(row, [c for c in feature_cols if c != "Amount"], scale=0.05)
    for k, v in feats.items():
        row[k] = v
    row["Class"] = 1
    return row, "amount_spike"

def synth_rapid_fire(base_row: pd.Series, feature_cols: list[str]) -> tuple[pd.Series, str]:
    row = base_row.copy()
    row["Amount"] = float(np.random.uniform(1.0, 15.0))
    feats = jitter_features(row, [c for c in feature_cols if c!= "Amount"], scale=0.03)
    for k, v in feats.items():
        row[k] = v
    row["Class"] = 1
    row["_merchant_id"] = mk_id("M")
    return row, "rapid_fire_merchant"

def synth_feature_outlier(base_row: pd.Series, feature_cols: list[str]) -> tuple[pd.Series, str]:
    row = base_row.copy()
    vcols = [c for c in feature_cols if c != "Amount"]
    k = max(2, int(0.15 * len(vcols)))
    pick = random.sample(vcols, k)
    for c in pick:
        row[c] = float(np.random.laplace(loc=row[c], scale=3.0))
    row["Class"] = 1
    return row, "feature_outlier"

def fraud_synth_factory(base_row: pd.Series, feature_cols: list[str], amt_p99: float) -> tuple[pd.Series, str]:
    fn = random.choice(["amount", "rapid", "feat"])
    if fn == "amount":
        return synth_amount_spike(base_row, feature_cols, amt_p99)
    elif fn == "rapid":
        return synth_rapid_fire(base_row, feature_cols)
    else:
        return synth_feature_outlier(base_row, feature_cols)

def iter_sampled(df: pd.DataFrame, feature_cols: list[str], fraud_ratio: float, seed: int, anchor: Optional[datetime], amt_p99: float, currency: str) -> Generator[Record, None, None]:
    rng = np.random.default_rng(seed)
    normals = df[df["Class"] == 0].sample(frac=1.0, random_state=seed).reset_index(drop=True)
    frauds = df[df["Class"] == 1].sample(frac=1.0, random_state=seed + 1).reset_index(drop=True)
    ni, fi = 0, 0
    while True:
        is_fraud = rng.random() < fraud_ratio
        if is_fraud:
            if fi >= len(frauds):
                base = normals.iloc[ni % len(normals)]
                row, pattern = fraud_synth_factory(base, feature_cols, amt_p99)
            else:
                row = frauds.iloc[fi].copy(); fi += 1
                pattern = "replay_fraud"
        else:
            row = normals.iloc[ni % len(normals)].copy(); ni += 1
            pattern = None
        row["_account_id"] = f"C-{(ni+fi)% ACCOUNT_POOL:06d}"
        row["_merchant_id"] = f"M-{(ni*7+fi*3)% MERCHANT_POOL:05d}"
        et = None
        if anchor is not None:
            tsec = float(row["Time"]) if "Time" in row else 0.0
            et = anchor + timedelta(seconds=tsec)
        key, payload, headers = make_record(row, feature_cols, currency=currency, fraud_pattern=pattern, event_time=et)
        yield key, payload, headers

def iter_replay(df: pd.DataFrame, feature_cols: list[str], anchor: Optional[datetime], currency: str) -> Generator[Record, None, None]:
    for i, row in df.iterrows():
        row = row.copy()
        row["_account_id"] = f"C-{i% ACCOUNT_POOL:06d}"
        row["_merchant_id"] = f"M-{(i*11) % MERCHANT_POOL:05d}"
        et = None
        if anchor is not None:
            tsec = float(row["Time"]) if "Time" in row else 0.0
            et = anchor + timedelta(seconds=tsec)
        key, payload, headers = make_record(row, feature_cols, currency=currency, fraud_pattern=("replay_fraud" if row["Class"] == 1 else None), event_time=et)
        yield key, payload, headers

def rate_limiter(rate_per_sec: float):
    if rate_per_sec <= 0:
        while True:
            yield
    interval = 1.0 / rate_per_sec
    next_ts = time.perf_counter()
    while True:
        now = time.perf_counter()
        sleep = next_ts - now
        if sleep > 0:
            time.sleep(sleep)
        next_ts += interval
        yield

def on_sigint(sig, frame):
    STOP.set()

def build_producer(bootstrap: str):
    return KafkaProducer(
        bootstrap_servers=bootstrap,
        acks="all",
        linger_ms=5,
        retries=10,
        value_serializer=lambda v: json.dumps(v, separators=(",", ":")).encode("utf-8"),
        key_serializer=lambda k: k
    )


def run():
    df, feature_cols = load_csv(ARGS.dataset_csv)
    print(f"[info] loaded {len(df)} rows; frauds={int((df['Class']==1).sum())}")
    anchor = None
    if "Time" in df.columns and len(df) > 0:
        try:
            anchor = datetime.now(timezone.utc) - timedelta(seconds=float(df["Time"].max()))
        except Exception:
            anchor = None

    amt_p99 = float(df.loc[df["Class"] == 0, "Amount"].quantile(0.99))

    gen = iter_replay(df, feature_cols, anchor, ARGS.currency) if ARGS.mode == "replay" else iter_sampled(df, feature_cols, ARGS.fraud_ratio, ARGS.seed, anchor, amt_p99, ARGS.currency)
    rate = rate_limiter(ARGS.rate_per_sec)
    prod = build_producer(ARGS.bootstrap_servers)
    start = time.time()
    sent = 0

    try:
        signal.signal(signal.SIGINT, on_sigint)
        signal.signal(signal.SIGTERM, on_sigint)
    except:
        pass


    while not STOP.is_set():
        if ARGS.duration_sec > 0 and (time.time() - start) >= ARGS.duration_sec:
            break
        next(rate)
        key, payload, headers = next(gen)
        try:
            prod.send(ARGS.topic, key=key, value=payload, headers=headers)
            sent += 1
            if ARGS.log_every and (sent % ARGS.log_every == 0):
                print(f"[info] sent={sent}")
        except kerrors.KafkaTimeoutError as e:
            print(f"[error] send timeout: {e}", file=sys.stderr)
        except Exception as e:
            print(f"[error] send failed: {e}", file=sys.stderr)

    prod.flush(timeout=10)
    prod.close()
    dur = time.time() - start
    print(f"[done] sent={sent} in {dur:.2f}s (~{sent/max(dur,1e-6):.1f}/s)")

def parse_args():
    p = argparse.ArgumentParser(description="Transaction Data Generator -> Kafka")
    p.add_argument("--config", default="data-generator/config.yaml")
    p.add_argument("--bootstrap-servers", dest="bootstrap_servers")
    p.add_argument("--topic")
    p.add_argument("--dataset", dest="dataset_csv")
    p.add_argument("--rate", dest="rate_per_sec", type=float)
    p.add_argument("--duration", dest="duration_sec", type=int)
    p.add_argument("--fraud-ratio", dest="fraud_ratio", type=float)
    p.add_argument("--mode", choices=["replay", "sample"])
    p.add_argument("--log-every", dest="log_every", type=int)
    p.add_argument("--seed", type=int)
    p.add_argument("--currency")
    args = p.parse_args()

    cfg = {}
    if args.config and os.path.exists(args.config):
        with open(args.config, "r") as fh:
            cfg = yaml.safe_load(fh) or {}

    def pick(k, default=None):
        v = getattr(args, k, None)
        return cfg.get(k, default) if v is None else v

    return argparse.Namespace(
        bootstrap_servers=pick("bootstrap_servers", "localhost:9092"),
        topic=pick("topic", "transactions"),
        dataset_csv=pick("dataset_csv", "ml-model/data/creditcard.csv"),
        rate_per_sec=float(pick("rate_per_sec", 20)),
        duration_sec=int(pick("duration_sec", 60)),
        fraud_ratio=float(pick("fraud_ratio", 0.02)),
        mode=pick("mode", "sample"),
        log_every=int(pick("log_every", 100)),
        seed=int(pick("seed", 42)),
        currency=pick("currency", "EUR")
    )

if __name__ == "__main__":
    ARGS = parse_args()
    random.seed(ARGS.seed)
    np.random.seed(ARGS.seed)
    run()





