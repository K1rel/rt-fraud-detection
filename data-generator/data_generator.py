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
from typing import Any, Generator, Iterable, Optional, Dict

from pathlib import Path

import numpy as np
import pandas as pd
import yaml
from pandas import DataFrame
from kafka import KafkaProducer, errors as kerrors

STOP = Event()
ACCOUNT_POOL = 50_000
MERCHANT_POOL = 10_000
FEATURE_PARAMS: Optional[Dict[str, Any]] = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def mk_id(prefix: str, n: int = 6) -> str:
    return f"{prefix}-{random.randint(10 ** (n - 1), 10 ** n - 1)}"


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


def jitter_features(
        row: pd.Series,
        feature_cols: list[str],
        scale: float = 0.02,
        exclude: Iterable[str] = ("Amount",),
) -> dict[str, float]:
    feats = {c: float(row[c]) for c in feature_cols}
    noise = np.random.normal(0.0, scale, size=len(feature_cols))
    for i, c in enumerate(feature_cols):
        if c in exclude:
            continue
        feats[c] = float(feats[c] + noise[i])
    return feats


# Record object
Record = tuple[bytes, dict[str, Any], list[tuple[str, bytes]]]


def make_record(
        row: pd.Series,
        model_feature_names: list[str],
        currency: str,
        fraud_pattern: Optional[str] = None,
        event_time: Optional[datetime] = None,
) -> Record:
    event_id = str(uuid.uuid4())
    correlation_id = str(uuid.uuid4())
    account_id = row.get("_account_id") or mk_id("C")
    merchant_id = row.get("_merchant_id") or mk_id("M")
    amount = float(row["Amount"])
    amount_minor = int(round(amount * 100))

    if not np.isfinite(amount):
        raise ValueError(f"Non-finite amount: {amount}")

    feats = build_model_features(row, model_feature_names)

    evt_iso = (event_time or datetime.now(timezone.utc)).isoformat(timespec="milliseconds").replace("+00:00", "Z")

    payload: dict[str, Any] = {
        "schema": "transaction_v1",
        "event_id": event_id,
        "timestamp": now_iso(),       # producer timestamp (now)
        "event_time": evt_iso,        # event-time used by pipeline (can be backfilled)
        "account_id": account_id,
        "merchant_id": merchant_id,
        "amount": amount,
        "amount_minor": amount_minor,
        "currency": currency,
        "features": feats,
        "is_fraud_label": int(row["Class"]) if "Class" in row and not pd.isna(row["Class"]) else None,
        "fraud_pattern": fraud_pattern,
        "correlation_id": correlation_id,
    }

    key: bytes = account_id.encode("utf-8")
    headers: list[tuple[str, bytes]] = [
        ("x-event-id", event_id.encode("utf-8")),
        ("x-schema", b"transaction_v1"),
        ("content-type", b"application/json"),
        ("x-correlation-id", correlation_id.encode("utf-8")),
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
    feats = jitter_features(row, [c for c in feature_cols if c != "Amount"], scale=0.03)
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


def pick_event_time(
        *,
        row_time_sec: float,
        max_time_sec: float,
        end: datetime,
        mode: str,
        days: float,
        rng: np.random.Generator,
) -> Optional[datetime]:
    """
    Backfill strategies for event_time.

    - random: uniform random timestamp within last N days
    - stretch: map dataset Time (0..max) onto last N days (preserve ordering)
    - dataset: handled outside (keeps anchor logic)
    """
    if days <= 0:
        return None

    span_sec = days * 86400.0

    if mode == "random":
        back = float(rng.random() * span_sec)
        return end - timedelta(seconds=back)

    if mode == "stretch":
        if max_time_sec <= 0:
            back = float(rng.random() * span_sec)
            return end - timedelta(seconds=back)

        t = max(0.0, min(float(row_time_sec), float(max_time_sec)))
        frac = t / float(max_time_sec)
        return (end - timedelta(seconds=span_sec)) + timedelta(seconds=frac * span_sec)

    return None


def _row_time_sec(row: pd.Series) -> float:
    if "Time" in row and not pd.isna(row["Time"]):
        try:
            return float(row["Time"])
        except Exception:
            return 0.0
    return 0.0


def iter_sampled(
        df: pd.DataFrame,
        feature_cols: list[str],
        model_feature_names: list[str],
        fraud_ratio: float,
        seed: int,
        anchor: Optional[datetime],
        amt_p99: float,
        currency: str,
        max_time_sec: float,
        event_time_mode: str,
        event_time_days: float,
        fixed_event_time: Optional[datetime],
) -> Generator[Record, None, None]:
    rng = np.random.default_rng(seed)
    end = datetime.now(timezone.utc)

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
                row = frauds.iloc[fi].copy()
                fi += 1
                pattern = "replay_fraud"
        else:
            row = normals.iloc[ni % len(normals)].copy()
            ni += 1
            pattern = None

        row["_account_id"] = f"C-{(ni + fi) % ACCOUNT_POOL:06d}"
        row["_merchant_id"] = f"M-{(ni * 7 + fi * 3) % MERCHANT_POOL:05d}"

        et: Optional[datetime] = fixed_event_time

        # Backfill modes (only if fixed_event_time not set)
        if et is None and event_time_days > 0:
            mode = (event_time_mode or "dataset").strip().lower()
            if mode in ("random", "stretch"):
                tsec = _row_time_sec(row)
                et = pick_event_time(
                    row_time_sec=tsec,
                    max_time_sec=max_time_sec,
                    end=end,
                    mode=mode,
                    days=event_time_days,
                    rng=rng,
                )
            else:
                # dataset mode: keep anchor behavior
                if anchor is not None:
                    tsec = _row_time_sec(row)
                    et = anchor + timedelta(seconds=tsec)
        elif et is None:
            # Old behavior
            if anchor is not None:
                tsec = _row_time_sec(row)
                et = anchor + timedelta(seconds=tsec)

        key, payload, headers = make_record(
            row,
            model_feature_names,
            currency=currency,
            fraud_pattern=pattern,
            event_time=et,
        )
        yield key, payload, headers


def iter_replay(
        df: pd.DataFrame,
        feature_cols: list[str],
        model_feature_names: list[str],
        anchor: Optional[datetime],
        currency: str,
        max_time_sec: float,
        event_time_mode: str,
        event_time_days: float,
        fixed_event_time: Optional[datetime],
        seed: int,
) -> Generator[Record, None, None]:
    rng = np.random.default_rng(seed)
    end = datetime.now(timezone.utc)

    for i, row in df.iterrows():
        row = row.copy()
        row["_account_id"] = f"C-{i % ACCOUNT_POOL:06d}"
        row["_merchant_id"] = f"M-{(i * 11) % MERCHANT_POOL:05d}"

        et: Optional[datetime] = fixed_event_time

        if et is None and event_time_days > 0:
            mode = (event_time_mode or "dataset").strip().lower()
            if mode in ("random", "stretch"):
                tsec = _row_time_sec(row)
                et = pick_event_time(
                    row_time_sec=tsec,
                    max_time_sec=max_time_sec,
                    end=end,
                    mode=mode,
                    days=event_time_days,
                    rng=rng,
                )
            else:
                if anchor is not None:
                    tsec = _row_time_sec(row)
                    et = anchor + timedelta(seconds=tsec)
        elif et is None:
            if anchor is not None:
                tsec = _row_time_sec(row)
                et = anchor + timedelta(seconds=tsec)

        key, payload, headers = make_record(
            row,
            model_feature_names,
            currency=currency,
            fraud_pattern=("replay_fraud" if row["Class"] == 1 else None),
            event_time=et,
        )
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


def build_model_features(row: pd.Series, model_feature_names: list[str]) -> dict[str, float]:
    if FEATURE_PARAMS is None:
        raise RuntimeError("FEATURE_PARAMS not loaded")

    params = FEATURE_PARAMS
    amount_cfg = params["amount_scaler"]
    mean = float(amount_cfg["mean"])
    scale = float(amount_cfg["scale"])
    period = float(params.get("period_sec", 86400.0))

    amount = float(row["Amount"])
    time_val = float(row["Time"]) if "Time" in row and not pd.isna(row["Time"]) else 0.0

    amount_z = (amount - mean) / scale
    tday = time_val % period
    angle = 2.0 * np.pi * (tday / period)
    tod_sin = float(np.sin(angle))
    tod_cos = float(np.cos(angle))

    feats: dict[str, float] = {}

    for name in model_feature_names:
        if name == "Amount_z":
            feats[name] = float(amount_z)
        elif name == "tod_sin":
            feats[name] = tod_sin
        elif name == "tod_cos":
            feats[name] = tod_cos
        else:
            v = float(row[name])
            if not np.isfinite(v):
                raise ValueError(f"Non-finite feature {name}={v!r}")
            feats[name] = v

    return feats


def build_producer(bootstrap: str):
    return KafkaProducer(
        bootstrap_servers=bootstrap,
        acks="all",
        linger_ms=5,
        retries=10,
        value_serializer=lambda v: json.dumps(v, separators=(",", ":")).encode("utf-8"),
        key_serializer=lambda k: k,
    )


def run():
    df, feature_cols = load_csv(ARGS.dataset_csv)
    global FEATURE_PARAMS

    FEATURE_PARAMS = json.loads(Path(ARGS.feature_params).read_text())
    model_feature_names: list[str] = FEATURE_PARAMS["order"]

    print(f"[info] loaded {len(df)} rows; frauds={int((df['Class']==1).sum())}")

    max_time_sec = float(df["Time"].max()) if "Time" in df.columns and len(df) else 0.0

    anchor = None
    if "Time" in df.columns and len(df) > 0:
        try:
            anchor = datetime.now(timezone.utc) - timedelta(seconds=max_time_sec)
        except Exception:
            anchor = None

    amt_p99 = float(df.loc[df["Class"] == 0, "Amount"].quantile(0.99))

    fixed_event_time: Optional[datetime] = None
    if ARGS.event_time_ago_days is not None:
        fixed_event_time = datetime.now(timezone.utc) - timedelta(days=float(ARGS.event_time_ago_days))
    elif ARGS.event_time_iso:
        try:
            fixed_event_time = datetime.fromisoformat(ARGS.event_time_iso.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception as e:
            raise RuntimeError(f"Bad --event-time-iso value: {ARGS.event_time_iso!r} ({e})") from e

    if ARGS.mode == "replay":
        gen = iter_replay(
            df,
            feature_cols,
            model_feature_names,
            anchor,
            ARGS.currency,
            max_time_sec,
            ARGS.event_time_mode,
            ARGS.event_time_days,
            fixed_event_time,
            ARGS.seed,
        )
    else:
        gen = iter_sampled(
            df,
            feature_cols,
            model_feature_names,
            ARGS.fraud_ratio,
            ARGS.seed,
            anchor,
            amt_p99,
            ARGS.currency,
            max_time_sec,
            ARGS.event_time_mode,
            ARGS.event_time_days,
            fixed_event_time,
        )

    rate = rate_limiter(ARGS.rate_per_sec)
    prod = build_producer(ARGS.bootstrap_servers)
    start = time.time()
    sent = 0

    try:
        signal.signal(signal.SIGINT, on_sigint)
        signal.signal(signal.SIGTERM, on_sigint)
    except Exception:
        pass

    while not STOP.is_set():
        if ARGS.duration_sec > 0 and (time.time() - start) >= ARGS.duration_sec:
            break

        next(rate)

        try:
            key, payload, headers = next(gen)
        except StopIteration:
            break

        try:
            if sent < 5:
                print(f"[sample] event_id={payload['event_id']} event_time={payload['event_time']} timestamp={payload['timestamp']}")

            prod.send(ARGS.topic, key=key, value=payload, headers=headers)
            sent += 1
            if ARGS.log_every and (sent % ARGS.log_every == 0):
                print(f"[info] sent={sent}")
        except kerrors.KafkaTimeoutError as e:
            print(f"[error] send timeout: {e}", file=sys.stderr)
        except Exception as e:
            print(f"[error] send failed: {e}", file=sys.stderr)

    try:
        prod.flush(timeout=30)
    except kerrors.KafkaTimeoutError as e:
        print(f"[warn] flush timeout after sending {sent} records: {e}", file=sys.stderr)
    finally:
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
    p.add_argument("--feature-params", dest="feature_params")

    # Backfill controls
    p.add_argument("--event-time-days", dest="event_time_days", type=float, default=0.0)
    p.add_argument(
        "--event-time-mode",
        dest="event_time_mode",
        choices=["dataset", "stretch", "random"],
        default="dataset",
    )

    # NEW: fixed event_time override
    p.add_argument("--event-time-ago-days", dest="event_time_ago_days", type=float, default=None)
    p.add_argument("--event-time-iso", dest="event_time_iso", type=str, default=None)

    args = p.parse_args()

    cfg = {}
    if args.config and os.path.exists(args.config):
        with open(args.config, "r") as fh:
            cfg = yaml.safe_load(fh) or {}

    def pick(k, default=None):
        v = getattr(args, k, None)
        return cfg.get(k, default) if v is None else v

    return argparse.Namespace(
        bootstrap_servers=pick("bootstrap_servers", "localhost:29092"),
        topic=pick("topic", "transactions"),
        dataset_csv=pick("dataset_csv", "ml-model/data/creditcard.csv"),
        rate_per_sec=float(pick("rate_per_sec", 20)),
        duration_sec=int(pick("duration_sec", 60)),
        fraud_ratio=float(pick("fraud_ratio", 0.02)),
        mode=pick("mode", "sample"),
        log_every=int(pick("log_every", 100)),
        seed=int(pick("seed", 42)),
        currency=pick("currency", "EUR"),
        feature_params=pick("feature_params", "ml-model/artifacts/feature_params.json"),
        event_time_days=float(pick("event_time_days", 0.0)),
        event_time_mode=pick("event_time_mode", "dataset"),
        event_time_ago_days=args.event_time_ago_days,
        event_time_iso=args.event_time_iso,
    )


if __name__ == "__main__":
    ARGS = parse_args()
    random.seed(ARGS.seed)
    np.random.seed(ARGS.seed)
    run()
