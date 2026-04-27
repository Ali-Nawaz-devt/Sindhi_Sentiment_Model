import re
import unicodedata
import numpy as np
from scipy.sparse import hstack

LABEL_INV = {2: "Positive", 0: "Negative", 1: "Neutral"}
LABEL_COLOR = {"Positive": "#39D353", "Negative": "#F87171", "Neutral": "#FBBF24"}
LABEL_EMOJI = {"Positive": "😊", "Negative": "😔", "Neutral": "😐"}

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


class Predictor:
    def predict(self, text: str, model_name: str, trainer) -> dict:
        store = trainer.get_model_store(model_name)
        if store is None:
            raise ValueError(f"Model '{model_name}' is not trained yet. Train it first.")

        clf       = store['clf']
        char_vec  = store['char_vec']
        word_vec  = store['word_vec']

        cleaned = _clean(text)
        X = hstack([char_vec.transform([cleaned]), word_vec.transform([cleaned])])

        pred_label = int(clf.predict(X)[0])
        pred_class = LABEL_INV[pred_label]

        # Confidence
        if hasattr(clf, 'predict_proba'):
            proba = clf.predict_proba(X)[0]
            confidence = float(proba[pred_label])
            class_probs = {LABEL_INV[i]: round(float(p), 4) for i, p in enumerate(proba)}
        else:
            confidence = 1.0
            class_probs = {pred_class: 1.0}

        return {
            "text": text,
            "cleaned_text": cleaned,
            "prediction": pred_class,
            "confidence": round(confidence, 4),
            "class_probabilities": class_probs,
            "color": LABEL_COLOR[pred_class],
            "emoji": LABEL_EMOJI[pred_class],
        }
