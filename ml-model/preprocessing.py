import argparse
import json
import math
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
import joblib

FEATURE_VERSION="v1"
PERIOD_SEC=86400
V_COLS=[f"V{i}" for i in range(1, 29)]
TARGET_COL="Class"
AMOUNT_COL="Amount"
TIME_COL="Time"

def _resolve_csv(p: Path) -> Path:

    if p.is_file():
        return p
    here = Path(__file__).resolve().parent
    candidates = [
        here / "data" / "creditcard.csv",
        here.parent / "ml-model" / "data" / "creditcard.csv",
        Path.cwd() / "ml-model" / "data" / "creditcard.csv",
    ]
    for c in candidates:
        if c.is_file():
            return c
    raise FileNotFoundError(f"Missing dataset. Tried: {p} and {candidates}")

def _mkdirs(*paths: Path) -> None:
    for d in paths:
        d.mkdir(parents=True, exist_ok=True)

def _time_split(df: pd.DataFrame, frac: float = 0.8) -> tuple[pd.DataFrame, pd.DataFrame]:
    df_sorted = df.sort_values(TIME_COL, kind="mergesort").reset_index(drop = True)
    cut = int(frac * len(df_sorted))

    return df_sorted.iloc[:cut].copy(), df_sorted.iloc[cut:].copy()

def _tod_features(t: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    tod = np.mod(t, PERIOD_SEC).astype(np.float64)
    ang = 2.0 * math.pi * (tod / PERIOD_SEC)
    return np.sin(ang), np.cos(ang)

def main():
    ap = argparse.ArgumentParser(description="Preprocess creditcard.csv")
    ap.add_argument("--input", type=Path, default=Path("ml-model/data/creditcard.csv"))
    ap.add_argument("--out_processed", type=Path, default=Path("ml-model/processed"))
    ap.add_argument("--artifacts", type=Path, default=Path("ml-model/artifacts"))
    ap.add_argument("--docs", type=Path, default=Path("ml-model/docs"))
    args = ap.parse_args()

    csv_path = _resolve_csv(args.input)
    _mkdirs(args.out_processed, args.artifacts, args.docs)

    df = pd.read_csv(csv_path)

    required = set([TIME_COL, AMOUNT_COL, TARGET_COL] + V_COLS)
    missing_cols = required.difference(df.columns)

    if missing_cols:
        raise ValueError(f"Dataset has missing columns: {missing_cols}")
    
    train_df, test_df = _time_split(df, 0.8)

    median_series = train_df[[TIME_COL, AMOUNT_COL] + V_COLS].median(numeric_only=True)
    medians = {k: float(median_series[k]) for k in median_series.index}

    imputer = SimpleImputer(strategy="median")
    imputer.fit(train_df[[TIME_COL, AMOUNT_COL] + V_COLS])

    def apply_impute(frame: pd.DataFrame) -> pd.DataFrame:
        arr = imputer.transform(frame[[TIME_COL, AMOUNT_COL] + V_COLS])
        cols = [TIME_COL, AMOUNT_COL] + V_COLS
        out = frame.copy()
        out[cols] = pd.DataFrame(arr, columns =cols, index=frame.index)
        return out

    train_df = apply_impute(train_df)
    test_df = apply_impute(test_df)

    amount_scaler = StandardScaler(with_mean=True, with_std=True)
    amount_scaler.fit(train_df[[AMOUNT_COL]].values.astype(np.float64))
    train_amt_z = amount_scaler.transform(train_df[[AMOUNT_COL]].values.astype(np.float64)).ravel()
    test_amt_z = amount_scaler.transform(test_df[[AMOUNT_COL]].values.astype(np.float64)).ravel()

    train_sin, train_cos = _tod_features(train_df[TIME_COL].to_numpy(dtype=np.float64))
    test_sin, test_cos = _tod_features(test_df[TIME_COL].to_numpy(dtype=np.float64))

    feature_names = V_COLS + ["Amount_z", "tod_sin", "tod_cos"]

    def build_X(frame: pd.DataFrame, amt_z: np.ndarray, s: np.ndarray, c: np.ndarray) -> np.ndarray:
        mats = [frame[v].to_numpy(dtype = np.float32) for v in V_COLS]
        mats += [amt_z.astype(np.float32), s.astype(np.float32), c.astype(np.float32)]

        X = np.vstack(mats).T

        return X
    
    X_train = build_X(train_df, train_amt_z, train_sin, train_cos)
    X_test = build_X(test_df, test_amt_z, test_sin, test_cos)
    y_train = train_df[TARGET_COL].to_numpy(dtype=np.int64)
    y_test = test_df[TARGET_COL].to_numpy(dtype=np.int64)

    np.save(args.out_processed / "X_train_time80.npy", X_train)
    np.save(args.out_processed / "y_train_time80.npy", y_train)
    np.save(args.out_processed / "X_test_time20.npy",  X_test)
    np.save(args.out_processed / "y_test_time20.npy",  y_test)

    joblib.dump(amount_scaler, args.artifacts / "amount_scaler.pkl")
    params = {
        "feature_version": FEATURE_VERSION,
        "dtype":"float32",
        "order": feature_names,
        "period_sec": PERIOD_SEC,
        "amount_scaler": {
            "mean": float(amount_scaler.mean_[0]),
            "scale": float(amount_scaler.scale_[0]),
            "with_mean": True,
            "with_std": True
        },
        "medians": medians
    }
    with (args.artifacts / "feature_params.json").open("w") as f:
        json.dump(params, f, indent=2)



    schema = {
        "version": FEATURE_VERSION,
        "features": [{"name": n, "dtype": "float32"} for n in feature_names],
        "target": {"name": TARGET_COL, "dtype": "int64"},
        "notes": [
            "Amount_z = (Amount - mean) / std (see artifacts/feature_params.json)",
            "tod_* from Time % 86400"
        ]
    }
    with (args.docs / "feature_schema.json").open("w") as f:
        json.dump(schema, f, indent=2)

    md = f"""# Feature Schema (v{FEATURE_VERSION})

**Dimensionality:** {len(feature_names)}  
**Order:** {', '.join(feature_names)}

- **Amount_z** = (Amount - mean) / std. Mean/std from `ml-model/artifacts/feature_params.json`.
- **tod_sin/tod_cos** from `angle = 2π * ((Time % 86400) / 86400)`.
- **V1..V28** passed through after median imputation (train-fitted).

## Serialization for Java/Flink
- Load `ml-model/artifacts/feature_params.json`:
  - `amount_scaler.mean`, `amount_scaler.scale`
  - `medians` for optional null handling
- Compute features in Java in this exact order: `{', '.join(feature_names)}`
- Use `float32` for ONNX input.

"""
    (args.docs / "feature_schema.md").write_text(md, encoding="utf-8")

    # Console summary
    print({
        "rows_train": int(X_train.shape[0]),
        "rows_test": int(X_test.shape[0]),
        "fraud_train": int(y_train.sum()),
        "fraud_test": int(y_test.sum()),
        "X_dim": X_train.shape[1],
        "artifacts": {
            "amount_scaler.pkl": str((args.artifacts / "amount_scaler.pkl").resolve()),
            "feature_params.json": str((args.artifacts / "feature_params.json").resolve()),
            "feature_schema.json": str((args.docs / "feature_schema.json").resolve()),
        }
    })

if __name__ == "__main__":
    main()