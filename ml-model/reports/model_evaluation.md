# Model Evaluation

```json
{
  "timestamp_utc": "2025-11-11T18:35:26Z",
  "chosen_model": "rf",
  "threshold": 0.03221476510067114,
  "test_metrics": {
    "precision": 0.5169491525423728,
    "recall": 0.8133333333333334,
    "f1": 0.6321243523316062,
    "roc_auc": 0.9540391770820515,
    "tp": 61,
    "fp": 57,
    "tn": 56830,
    "fn": 14,
    "alerts": 118,
    "alert_rate": 0.002071556476247323,
    "threshold": 0.03221476510067114
  },
  "baselines": {
    "lr": {
      "precision": 0.0387858347386172,
      "recall": 0.92,
      "f1": 0.0744336569579288,
      "roc_auc": 0.9860065275604853,
      "tp": 69,
      "fp": 1710,
      "tn": 55177,
      "fn": 6,
      "alerts": 1779,
      "alert_rate": 0.031231347213932094,
      "threshold": 0.609746835443038
    },
    "rf": {
      "precision": 0.5169491525423728,
      "recall": 0.8133333333333334,
      "f1": 0.6321243523316062,
      "roc_auc": 0.9540391770820515,
      "tp": 61,
      "fp": 57,
      "tn": 56830,
      "fn": 14,
      "alerts": 118,
      "alert_rate": 0.002071556476247323,
      "threshold": 0.03221476510067114
    },
    "xgb": {
      "precision": 0.5,
      "recall": 0.8,
      "f1": 0.6153846153846154,
      "roc_auc": 0.986530724652967,
      "tp": 60,
      "fp": 60,
      "tn": 56827,
      "fn": 15,
      "alerts": 120,
      "alert_rate": 0.002106667602963379,
      "threshold": 0.015838926174496646
    }
  },
  "cv_results": {
    "lr": {
      "recall": 0.8761937601898712,
      "f1": 0.12807214041303389,
      "roc_auc": 0.9597639842630755,
      "folds_used": 5
    },
    "rf": {
      "recall": 0.643426510271133,
      "f1": 0.7575686810471371,
      "roc_auc": 0.9536663240101635,
      "folds_used": 5
    },
    "xgb": {
      "recall": 0.7906153034463668,
      "f1": 0.8145975240100854,
      "roc_auc": 0.9702198655298941,
      "folds_used": 5
    }
  },
  "timing_ms_per_row": {
    "sklearn": 0.01148847129998103,
    "onnx": 0.0030845356000099855
  },
  "thresholds": {
    "lr": 0.609746835443038,
    "rf": 0.03221476510067114,
    "xgb": 0.015838926174496646
  },
  "feature_importance_top15": {
    "gini": [
      {
        "feature": "V14",
        "importance": 0.17726853459748598
      },
      {
        "feature": "V10",
        "importance": 0.12536484970292291
      },
      {
        "feature": "V12",
        "importance": 0.10591588178799394
      },
      {
        "feature": "V17",
        "importance": 0.09847160743382767
      },
      {
        "feature": "V4",
        "importance": 0.09429429965756099
      },
      {
        "feature": "V11",
        "importance": 0.07532776719700632
      },
      {
        "feature": "V16",
        "importance": 0.04384074747433529
      },
      {
        "feature": "V7",
        "importance": 0.035197457266418555
      },
      {
        "feature": "V3",
        "importance": 0.030966626460021376
      },
      {
        "feature": "V2",
        "importance": 0.0244631462516603
      },
      {
        "feature": "V21",
        "importance": 0.016953830745629412
      },
      {
        "feature": "V18",
        "importance": 0.01553854797398154
      },
      {
        "feature": "V19",
        "importance": 0.012377653977048252
      },
      {
        "feature": "V9",
        "importance": 0.012370803249994077
      },
      {
        "feature": "Amount_z",
        "importance": 0.011414255534963232
      }
    ],
    "perm_f1": [
      {
        "feature": "V12",
        "importance": 0.787360132615002
      },
      {
        "feature": "V14",
        "importance": 0.7518590580732879
      },
      {
        "feature": "V11",
        "importance": 0.45631539665238974
      },
      {
        "feature": "V4",
        "importance": 0.31736945181317583
      },
      {
        "feature": "V10",
        "importance": 0.24064308458070421
      },
      {
        "feature": "V3",
        "importance": 0.12669862433098927
      },
      {
        "feature": "V17",
        "importance": 0.0677921190420147
      },
      {
        "feature": "V16",
        "importance": 0.050043133228616796
      },
      {
        "feature": "V1",
        "importance": 0.044703487887073345
      },
      {
        "feature": "V2",
        "importance": 0.01721944756905387
      },
      {
        "feature": "V9",
        "importance": 0.01402477270986291
      },
      {
        "feature": "V22",
        "importance": 0.011459367579052637
      },
      {
        "feature": "Amount_z",
        "importance": 0.011428971378577724
      },
      {
        "feature": "V7",
        "importance": 0.009559605049368836
      },
      {
        "feature": "V19",
        "importance": 0.009529208848893921
      }
    ]
  }
}
```
