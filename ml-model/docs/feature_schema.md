# Feature Schema (vv1)

**Dimensionality:** 31  
**Order:** V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V12, V13, V14, V15, V16, V17, V18, V19, V20, V21, V22, V23, V24, V25, V26, V27, V28, Amount_z, tod_sin, tod_cos

- **Amount_z** = (Amount - mean) / std. Mean/std from `ml-model/artifacts/feature_params.json`.
- **tod_sin/tod_cos** from `angle = 2π * ((Time % 86400) / 86400)`.
- **V1..V28** passed through after median imputation (train-fitted).

## Serialization for Java/Flink
- Load `ml-model/artifacts/feature_params.json`:
  - `amount_scaler.mean`, `amount_scaler.scale`
  - `medians` for optional null handling
- Compute features in Java in this exact order: `V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V12, V13, V14, V15, V16, V17, V18, V19, V20, V21, V22, V23, V24, V25, V26, V27, V28, Amount_z, tod_sin, tod_cos`
- Use `float32` for ONNX input.

