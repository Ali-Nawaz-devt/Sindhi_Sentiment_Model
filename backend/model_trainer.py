import numpy as np
import pandas as pd
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.naive_bayes import ComplementNB
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import (
    train_test_split, StratifiedKFold, cross_val_score, learning_curve
)
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, precision_score, recall_score
)
import re
import unicodedata
from typing import Dict, Any

LABEL_MAP = {"Positive": 2, "Negative": 0, "Neutral": 1}
LABEL_INV = {v: k for k, v in LABEL_MAP.items()}
CLASS_NAMES = ["Negative", "Neutral", "Positive"]

def _clean(text: str) -> str:
    if not isinstance(text, str):
        return ''
    text = unicodedata.normalize('NFC', text.strip())
    diacritics = re.compile(
        r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06ED]'
    )
    text = diacritics.sub('', text)
    text = ''.join(ch for ch in text if unicodedata.category(ch)[0] != 'C')
    return re.sub(r'\s+', ' ', text).strip()

class ModelTrainer:
    def __init__(self):
        self._results: Dict[str, dict] = {}
        self._trained_models: Dict[str, dict] = {}  # stores clf + vectorizers

    # ── Train ──────────────────────────────────────────────────────────────────

    def train(self, df: pd.DataFrame, model_name: str, params: Dict[str, Any],
              test_size: float, val_size: float, cv_folds: int) -> dict:

        # Prepare text
        df = df.copy()
        df['sindhi_clean'] = df['sindhi_text'].apply(_clean)
        df['english_clean'] = df['english_text'].fillna('').apply(_clean)
        df['combined'] = (df['sindhi_clean'] + ' ' + df['english_clean']).str.strip()

        X = df['combined'].values
        y = df['sentiment'].map(LABEL_MAP).values
        w = df['sample_weight'].values

        # Split
        X_tv, X_test, y_tv, y_test, w_tv, w_test = train_test_split(
            X, y, w, test_size=test_size, random_state=42, stratify=y
        )
        val_frac = val_size / (1.0 - test_size) if (1.0 - test_size) > 0 else 0.125
        X_train, X_val, y_train, y_val, w_train, w_val = train_test_split(
            X_tv, y_tv, w_tv, test_size=min(val_frac, 0.5), random_state=42, stratify=y_tv
        )

        # Vectorize
        char_vec = TfidfVectorizer(analyzer='char_wb', ngram_range=(2,6),
                                   max_features=20000, sublinear_tf=True, min_df=1)
        word_vec = TfidfVectorizer(analyzer='word', ngram_range=(1,2),
                                   max_features=10000, sublinear_tf=True, min_df=1)

        X_tr_c = char_vec.fit_transform(X_train)
        X_tr_w = word_vec.fit_transform(X_train)
        X_tr   = hstack([X_tr_c, X_tr_w])

        X_va = hstack([char_vec.transform(X_val), word_vec.transform(X_val)])
        X_te = hstack([char_vec.transform(X_test), word_vec.transform(X_test)])
        X_all = hstack([char_vec.transform(X), word_vec.transform(X)])

        # Build classifier
        clf = self._build_clf(model_name, params)

        # Support sample_weight only for models that accept it
        supports_sw = model_name in ("Logistic Regression", "SVM (LinearSVC)")
        if supports_sw:
            clf.fit(X_tr, y_train, sample_weight=w_train)
        else:
            clf.fit(X_tr, y_train)

        # Predictions
        y_train_pred = clf.predict(X_tr)
        y_val_pred   = clf.predict(X_va)
        y_test_pred  = clf.predict(X_te)

        train_acc = float(accuracy_score(y_train, y_train_pred))
        val_acc   = float(accuracy_score(y_val, y_val_pred))
        test_acc  = float(accuracy_score(y_test, y_test_pred))

        # Cross-validation
        cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
        cv_scores = cross_val_score(clf, X_all, y, cv=cv, scoring='accuracy', n_jobs=-1)

        # Metrics
        report = classification_report(y_test, y_test_pred,
                                        target_names=CLASS_NAMES, output_dict=True)
        cm = confusion_matrix(y_test, y_test_pred).tolist()

        # Overfitting detection
        gap = train_acc - val_acc
        if gap > 0.10:
            fit_status = "overfitting"
            fit_msg = (f"Training accuracy ({train_acc:.1%}) is significantly higher than "
                       f"validation accuracy ({val_acc:.1%}). The model is overfitting. "
                       f"Try reducing model complexity or increasing regularization.")
        elif val_acc < 0.55:
            fit_status = "underfitting"
            fit_msg = (f"Both training ({train_acc:.1%}) and validation ({val_acc:.1%}) "
                       f"accuracies are low. The model is underfitting. "
                       f"Try a more complex model or better features.")
        else:
            fit_status = "good"
            fit_msg = (f"Model is well-fitted. Training accuracy: {train_acc:.1%}, "
                       f"Validation accuracy: {val_acc:.1%}. Generalization gap is acceptable.")

        # Store model
        self._trained_models[model_name] = {
            'clf': clf,
            'char_vec': char_vec,
            'word_vec': word_vec,
        }

        result = {
            "model_name": model_name,
            "params": params,
            "metrics": {
                "train_accuracy": round(train_acc, 4),
                "val_accuracy":   round(val_acc, 4),
                "test_accuracy":  round(test_acc, 4),
                "precision": round(float(precision_score(y_test, y_test_pred, average='weighted')), 4),
                "recall":    round(float(recall_score(y_test, y_test_pred, average='weighted')), 4),
                "f1_score":  round(float(f1_score(y_test, y_test_pred, average='weighted')), 4),
            },
            "cv": {
                "mean":   round(float(cv_scores.mean()), 4),
                "std":    round(float(cv_scores.std()), 4),
                "scores": [round(float(s), 4) for s in cv_scores.tolist()],
            },
            "confusion_matrix": cm,
            "class_names": CLASS_NAMES,
            "classification_report": report,
            "fit_status": fit_status,
            "fit_message": fit_msg,
            "train_sizes": [len(X_train)],
        }
        self._results[model_name] = result
        return result

    # ── Compare ────────────────────────────────────────────────────────────────

    def compare(self, df: pd.DataFrame, models: list[str], test_size: float) -> dict:
        rows = []
        for name in models:
            params = self._default_params(name)
            r = self.train(df=df, model_name=name, params=params,
                           test_size=test_size, val_size=0.1, cv_folds=5)
            rows.append({
                "model": name,
                "train_acc": r['metrics']['train_accuracy'],
                "val_acc":   r['metrics']['val_accuracy'],
                "test_acc":  r['metrics']['test_accuracy'],
                "precision": r['metrics']['precision'],
                "recall":    r['metrics']['recall'],
                "f1":        r['metrics']['f1_score'],
                "cv_mean":   r['cv']['mean'],
                "cv_std":    r['cv']['std'],
                "fit_status": r['fit_status'],
            })
        best = max(rows, key=lambda x: x['f1'])
        return {
            "comparison": rows,
            "best_model": best['model'],
            "best_f1": best['f1'],
        }

    # ── Feature Importance ─────────────────────────────────────────────────────

    def get_feature_importance(self, model_name: str) -> dict:
        if model_name not in self._trained_models:
            return {"error": "Model not trained"}
        store = self._trained_models[model_name]
        clf = store['clf']
        char_vec = store['char_vec']
        word_vec = store['word_vec']

        feat_names = list(char_vec.get_feature_names_out()) + list(word_vec.get_feature_names_out())
        try:
            if hasattr(clf, 'coef_'):
                coef = clf.coef_
            elif hasattr(clf, 'estimator') and hasattr(clf.estimator, 'coef_'):
                coef = clf.estimator.coef_
            elif hasattr(clf, 'calibrated_classifiers_'):
                coef = clf.calibrated_classifiers_[0].estimator.coef_
            else:
                return {"error": "Model does not support feature importance"}

            result = {}
            for i, cls_name in enumerate(CLASS_NAMES):
                top_idx = np.argsort(coef[i])[-15:][::-1]
                result[cls_name] = [
                    {"feature": feat_names[j], "weight": round(float(coef[i][j]), 4)}
                    for j in top_idx if j < len(feat_names)
                ]
            return {"feature_importance": result}
        except Exception as e:
            return {"error": str(e)}

    # ── Save Models ────────────────────────────────────────────────────────────

    def save_models(self, model_name: str | None, save_mode: str, output_dir: str) -> dict:
        """
        Save trained model(s) to disk as .pkl files.

        Parameters
        ----------
        model_name : str | None
            Specific model to save, or None to save all trained models.
        save_mode  : 'separate' | 'bundle'
            'separate' → individual .pkl per model.
            'bundle'   → one combined dict with all models.
        output_dir : str
            Directory path for output files.

        Returns
        -------
        dict with saved file paths and metadata.
        """
        import os
        import joblib

        os.makedirs(output_dir, exist_ok=True)

        # Decide which models to save
        if model_name and model_name in self._trained_models:
            to_save = {model_name: self._trained_models[model_name]}
        elif model_name is None:
            to_save = dict(self._trained_models)
        else:
            return {"error": f"Model '{model_name}' has not been trained yet."}

        if not to_save:
            return {"error": "No trained models found. Train at least one model first."}

        SLUG = {
            "Logistic Regression": "logistic_regression",
            "SVM (LinearSVC)":     "svm",
            "Naive Bayes":         "naive_bayes",
        }

        saved_files = []

        if save_mode == "bundle":
            # --- Bundle mode: one file with all models ---
            bundle = {}
            for name, store in to_save.items():
                bundle[name] = {
                    "clf":           store["clf"],
                    "char_vec":      store["char_vec"],
                    "word_vec":      store["word_vec"],
                    "label_map_inv": LABEL_INV,
                    "class_names":   CLASS_NAMES,
                    "metrics":       self._results.get(name, {}).get("metrics", {}),
                }
            path = os.path.join(output_dir, "sindhi_sentiment_bundle.pkl")
            joblib.dump(bundle, path, compress=3)
            saved_files.append({
                "path":   path,
                "size_kb": round(os.path.getsize(path) / 1024, 1),
                "models": list(to_save.keys()),
                "mode":   "bundle",
            })
        else:
            # --- Separate mode: one file per model ---
            for name, store in to_save.items():
                slug = SLUG.get(name, name.lower().replace(" ", "_").replace("(", "").replace(")", ""))
                payload = {
                    "clf":           store["clf"],
                    "char_vec":      store["char_vec"],
                    "word_vec":      store["word_vec"],
                    "label_map_inv": LABEL_INV,
                    "class_names":   CLASS_NAMES,
                    "model_name":    name,
                    "metrics":       self._results.get(name, {}).get("metrics", {}),
                }
                path = os.path.join(output_dir, f"{slug}.pkl")
                joblib.dump(payload, path, compress=3)
                saved_files.append({
                    "path":    path,
                    "size_kb": round(os.path.getsize(path) / 1024, 1),
                    "model":   name,
                    "mode":    "separate",
                })

        return {
            "status":      "saved",
            "save_mode":   save_mode,
            "output_dir":  output_dir,
            "saved_files": saved_files,
            "total":       len(saved_files),
            "usage_hint": (
                "Load with: `import joblib; model = joblib.load('path.pkl')` — "
                "then call `model['clf'].predict(hstack([model['char_vec'].transform([text]), "
                "model['word_vec'].transform([text])]))`"
            ),
        }

    # ── Learning Curve ─────────────────────────────────────────────────────────

    def compute_learning_curve(self, model_name: str, df: pd.DataFrame) -> dict:
        if model_name not in self._trained_models:
            return {"error": "Model not trained"}
        store = self._trained_models[model_name]
        clf = store['clf']
        char_vec = store['char_vec']
        word_vec = store['word_vec']

        df = df.copy()
        df['sindhi_clean'] = df['sindhi_text'].apply(_clean)
        df['english_clean'] = df['english_text'].fillna('').apply(_clean)
        df['combined'] = (df['sindhi_clean'] + ' ' + df['english_clean']).str.strip()

        X = hstack([char_vec.transform(df['combined'].values),
                    word_vec.transform(df['combined'].values)])
        y = df['sentiment'].map(LABEL_MAP).values

        sizes = np.linspace(0.1, 1.0, 8)
        train_sizes, train_scores, test_scores = learning_curve(
            clf, X, y, train_sizes=sizes, cv=3, scoring='accuracy', n_jobs=-1
        )
        return {
            "train_sizes": [int(s) for s in train_sizes.tolist()],
            "train_scores_mean": [round(float(s), 4) for s in train_scores.mean(axis=1).tolist()],
            "test_scores_mean":  [round(float(s), 4) for s in test_scores.mean(axis=1).tolist()],
        }

    # ── Getters ────────────────────────────────────────────────────────────────

    def get_results(self, model_name: str) -> dict | None:
        return self._results.get(model_name)

    def get_available_models(self) -> dict:
        return {
            "models": [
                {
                    "name": "Logistic Regression",
                    "params": [
                        {"key": "C", "label": "Regularization (C)", "type": "slider",
                         "min": 0.01, "max": 10.0, "step": 0.01, "default": 1.0},
                        {"key": "max_iter", "label": "Max Iterations", "type": "slider",
                         "min": 100, "max": 5000, "step": 100, "default": 2000},
                    ]
                },
                {
                    "name": "SVM (LinearSVC)",
                    "params": [
                        {"key": "C", "label": "Regularization (C)", "type": "slider",
                         "min": 0.01, "max": 5.0, "step": 0.01, "default": 0.8},
                        {"key": "max_iter", "label": "Max Iterations", "type": "slider",
                         "min": 500, "max": 5000, "step": 500, "default": 3000},
                    ]
                },
                {
                    "name": "Naive Bayes",
                    "params": [
                        {"key": "alpha", "label": "Smoothing (alpha)", "type": "slider",
                         "min": 0.001, "max": 5.0, "step": 0.001, "default": 0.3},
                    ]
                },
            ],
            "trained": list(self._results.keys()),
        }

    def get_model_store(self, model_name: str) -> dict | None:
        return self._trained_models.get(model_name)

    # ── Private ────────────────────────────────────────────────────────────────

    def _build_clf(self, model_name: str, params: dict):
        if model_name == "Logistic Regression":
            return LogisticRegression(
                C=params.get('C', 1.0),
                max_iter=int(params.get('max_iter', 2000)),
                class_weight='balanced',
                random_state=42,
                solver='lbfgs',
            )
        elif model_name == "SVM (LinearSVC)":
            return CalibratedClassifierCV(
                LinearSVC(
                    C=params.get('C', 0.8),
                    max_iter=int(params.get('max_iter', 3000)),
                    class_weight='balanced',
                    random_state=42,
                )
            )
        elif model_name == "Naive Bayes":
            return ComplementNB(alpha=params.get('alpha', 0.3))
        else:
            raise ValueError(f"Unknown model: {model_name}")

    def _default_params(self, model_name: str) -> dict:
        defaults = {
            "Logistic Regression": {"C": 1.0, "max_iter": 2000},
            "SVM (LinearSVC)":     {"C": 0.8, "max_iter": 3000},
            "Naive Bayes":         {"alpha": 0.3},
        }
        return defaults.get(model_name, {})