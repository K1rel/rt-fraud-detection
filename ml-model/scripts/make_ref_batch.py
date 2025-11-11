import argparse
import json
import pathlib

import numpy as np
import onnxruntime as ort


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--onnx", default="ml-model/models/best_model.onnx")
    ap.add_argument("--sidecar", default="ml-model/models/class_labels.json")
    ap.add_argument("--n", type=int, default=2048)
    ap.add_argument("--out", default="flink-fraud-detector/src/test/resources/ref/ref_batch.json")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    onnx_path = pathlib.Path(args.onnx).resolve()
    if not onnx_path.exists():
        raise SystemExit(f"Missing ONNX model at {onnx_path}")

    sidecar_path = pathlib.Path(args.sidecar).resolve()
    if not sidecar_path.exists():
        raise SystemExit(f"Missing sidecar at {sidecar_path}")

    side = json.loads(sidecar_path.read_text())
    labels = [str(x) for x in side["class_labels"]]
    pos_label = str(side.get("positive_label", "1"))

    try:
        pos_idx = labels.index(pos_label)
    except ValueError:
        raise SystemExit(f"Positive label {pos_label!r} not in {labels}")

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    in_name = sess.get_inputs()[0].name
    f = sess.get_inputs()[0].shape[-1]
    if isinstance(f, str) or f is None:
        f = side.get("n_features", 31)

    rng = np.random.default_rng(args.seed)
    X = rng.normal(0.0, 1.0, size=(args.n, f)).astype(np.float32)

    outs = sess.run(None, {in_name: X})
    proba = outs[0] if len(outs) == 1 else next(o for o in outs if getattr(o, "ndim", 0) == 2)

    if proba.ndim == 2 and proba.shape[1] == 2:
        ppos = proba[:, pos_idx]
    elif proba.ndim == 2 and proba.shape[1] == 1:
        ppos = proba[:, 0]
    else:
        ppos = proba.reshape((-1,))

    outp = {
        "n_features": int(f),
        "X": X.tolist(),
        "proba_py_onnx": ppos.astype(np.float32).tolist()
    }
    pathlib.Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w") as f_out:
        json.dump(outp, f_out)
    print(f"Wrote {args.out} (n={args.n}, F={f})")

if __name__ == "__main__":
    main()