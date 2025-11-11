#!/usr/bin/env python3
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
csv_path = ROOT / "ml-model" / "data" / "creditcard.csv"

if not csv_path.exists():
    raise SystemExit(f"ERROR: Dataset not found at {csv_path}. Run scripts/download_kaggle.sh first.")

df = pd.read_csv(csv_path)
n_total = len(df)
n_fraud = int(df['Class'].sum())
n_normal = n_total - n_fraud
ratio = (n_fraud / n_total) * 100.0

print("=== Dataset Stats ===")
print(f"Path: {csv_path}")
print(f"Rows: {n_total:,}")
print(f"Fraud: {n_fraud:,}")
print(f"Normal: {n_normal:,}")
print(f"Fraud ratio: {ratio:.6f}%")
print(f"Columns: {list(df.columns)}")
