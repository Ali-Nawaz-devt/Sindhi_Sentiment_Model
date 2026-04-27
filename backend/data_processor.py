import pandas as pd
import numpy as np
import re
import unicodedata
from pathlib import Path
from collections import Counter

DATASET_PATH = Path(__file__).parent / "sindhi_sentiment_cleaned.xlsx"

SINDHI_STOPS = {
    'آهي','آهيان','آهيو','آهن','ٿو','ٿي','ٿا','هو','هئو','هئي','هئا',
    'جو','جي','جا','۽','ته','به','پر','مان','توهان','اسان','هن',
    'جيڪو','اهو','ان','کي','۾','تي','سان','وارو','وارا','ڪري','ڪيو',
    'ويو','ويا','ڪن','ڪا','ڪو','هڪ','جڏهن','ان','انهن','ڏنو'
}

class DataProcessor:
    def __init__(self):
        self._df_raw: pd.DataFrame | None = None
        self._df_clean: pd.DataFrame | None = None

    # ── Public API ─────────────────────────────────────────────────────────────

    def load_dataset(self) -> dict:
        df = pd.read_excel(DATASET_PATH)
        df.columns = ['sindhi_text', 'english_text', 'sentiment', 'source', 'verified']
        df = df.dropna(subset=['sindhi_text', 'sentiment'])
        df = df[df['sindhi_text'].astype(str).str.strip() != '']
        df = df[df['sentiment'].isin(['Positive', 'Negative', 'Neutral'])]
        df['english_text'] = df['english_text'].fillna('')
        df['sample_weight'] = df['verified'].apply(self._conf_weight)
        df = df.reset_index(drop=True)
        self._df_raw = df.copy()
        self._df_clean = df.copy()
        return {
            "rows": len(df),
            "columns": list(df.columns),
            "sentiment_dist": df['sentiment'].value_counts().to_dict(),
            "source_dist": df['source'].value_counts().to_dict(),
            "missing_values": df.isnull().sum().to_dict(),
            "dtypes": {c: str(t) for c, t in df.dtypes.items()},
            "preview": df.head(10).to_dict(orient='records'),
            "text_length_stats": self._text_length_stats(df),
            "word_freq": self._word_freq(df),
        }

    def clean_dataset(self, drop_missing=True, normalize=False,
                      remove_outliers=False, outlier_threshold=3.0) -> dict:
        if self._df_raw is None:
            self.load_dataset()
        df = self._df_raw.copy()

        before_rows = len(df)

        if drop_missing:
            df = df.dropna(subset=['sindhi_text', 'sentiment'])

        # Clean text
        df['sindhi_clean'] = df['sindhi_text'].apply(self._clean_text)
        df['english_clean'] = df['english_text'].fillna('').apply(self._clean_text)
        df['combined_text'] = (df['sindhi_clean'] + ' ' + df['english_clean']).str.strip()

        # Remove outliers by text length
        if remove_outliers:
            df['_len'] = df['sindhi_clean'].apply(lambda x: len(str(x).split()))
            mean_l = df['_len'].mean()
            std_l  = df['_len'].std()
            df = df[abs(df['_len'] - mean_l) <= outlier_threshold * std_l]
            df = df.drop(columns=['_len'])

        # Normalize text length (not applicable to text, but we can scale weight)
        if normalize:
            w_min = df['sample_weight'].min()
            w_max = df['sample_weight'].max()
            if w_max > w_min:
                df['sample_weight'] = (df['sample_weight'] - w_min) / (w_max - w_min)

        df = df.reset_index(drop=True)
        self._df_clean = df.copy()

        after_rows = len(df)
        return {
            "rows_before": before_rows,
            "rows_after": after_rows,
            "rows_removed": before_rows - after_rows,
            "sentiment_dist": df['sentiment'].value_counts().to_dict(),
            "missing_values": df.isnull().sum().to_dict(),
            "preview": df[['sindhi_text','sindhi_clean','sentiment','source']].head(10).to_dict(orient='records'),
            "text_length_stats": self._text_length_stats(df),
            "word_freq": self._word_freq(df),
        }

    def get_stats(self) -> dict:
        df = self.get_dataframe()
        df['_len'] = df['sindhi_text'].apply(lambda x: len(str(x).split()))
        by_sent = {}
        for s in ['Positive', 'Negative', 'Neutral']:
            sub = df[df['sentiment'] == s]
            by_sent[s] = {
                'count': int(len(sub)),
                'mean_len': float(sub['_len'].mean()) if len(sub) else 0,
                'max_len': int(sub['_len'].max()) if len(sub) else 0,
                'min_len': int(sub['_len'].min()) if len(sub) else 0,
            }
        return {
            "total": len(df),
            "by_sentiment": by_sent,
            "source_dist": df['source'].value_counts().to_dict(),
            "verified_dist": df['verified'].value_counts().to_dict(),
            "weight_stats": {
                "mean": float(df['sample_weight'].mean()),
                "min": float(df['sample_weight'].min()),
                "max": float(df['sample_weight'].max()),
            }
        }

    def get_dataframe(self) -> pd.DataFrame:
        if self._df_clean is None:
            self.load_dataset()
        return self._df_clean

    # ── Private Helpers ────────────────────────────────────────────────────────

    def _conf_weight(self, v) -> float:
        if v == 'Yes':       return 1.00
        if v == 'Corrected': return 0.95
        if v == 'No':        return 0.85
        try:
            return float(str(v).replace('Auto(', '').replace(')', ''))
        except Exception:
            return 0.75

    def _clean_text(self, text: str) -> str:
        if not isinstance(text, str):
            return ''
        text = unicodedata.normalize('NFC', text.strip())
        diacritics = re.compile(
            r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06ED]'
        )
        text = diacritics.sub('', text)
        text = ''.join(ch for ch in text if unicodedata.category(ch)[0] != 'C')
        return re.sub(r'\s+', ' ', text).strip()

    def _text_length_stats(self, df: pd.DataFrame) -> dict:
        result = {}
        for sent in ['Positive', 'Negative', 'Neutral']:
            sub = df[df['sentiment'] == sent]
            lengths = sub['sindhi_text'].apply(lambda x: len(str(x).split())).tolist()
            result[sent] = lengths[:300]  # cap for JSON
        return result

    def _word_freq(self, df: pd.DataFrame) -> dict:
        result = {}
        for sent in ['Positive', 'Negative', 'Neutral']:
            words = ' '.join(df[df['sentiment'] == sent]['sindhi_text'].fillna('')).split()
            freq = Counter([w for w in words if w not in SINDHI_STOPS and len(w) > 2])
            top = freq.most_common(15)
            result[sent] = [{"word": w, "count": c} for w, c in top]
        return result
