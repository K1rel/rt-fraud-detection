# Credit Card Fraud Dataset – Statistics & Characteristics

**Source:** Kaggle (mlg-ulb/creditcardfraud)  
**File:** `ml-model/data/creditcard.csv`  
**Rows:** 284,807  
**Fraudulent transactions (Class=1):** 492  
**Normal transactions (Class=0):** 284,315  
**Fraud ratio:** ~0.172% (492 / 284,807)

## Columns

- `Time`: Seconds elapsed between each transaction and the first transaction in the dataset (monotonic-ish; temporal order).
- `V1` … `V28`: Result of PCA transformation on original features; values are anonymized.
- `Amount`: Transaction amount.
- `Class`: Target label (1 = fraud, 0 = normal).

## Key Notes

- **Severe class imbalance** (~0.17% fraud). Use stratified sampling, class weights, or anomaly-detection approaches.
- **Leakage caution:** If you shuffle, you may mix future into train; prefer **time-based holdout** (e.g., first 80% time for train, last 20% time for test).
- **Feature scaling:** `Amount` is not PCA-transformed; consider log-transform or standardization.
- **Streaming reality:** Train on earlier time, evaluate on later time to mimic production drift.

## Suggested Splits

- **Primary:** Time-based 80/20 (train: earliest 80% by `Time`; test: latest 20%).
- **Secondary:** Stratified 80/20 (quick local iteration; ensures fraud presence in both sets).

## Quick Distributions (see notebook)

- Class distribution bar plot.
- `Amount` histogram (log1p) – long-tailed.
- `Time` -> hour-of-day histogram (fraud vs. normal patterns can differ).
