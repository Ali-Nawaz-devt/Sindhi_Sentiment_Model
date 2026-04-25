from flask import Flask, request, jsonify, render_template
import joblib
from scipy.sparse import hstack
import re
import unicodedata

app = Flask(__name__)

# ── Load model ─────────────────────────────────────────────────────────────────
bundle = joblib.load('best_model.pkl')
clf        = bundle['clf']
char_vec   = bundle['char_vec']
word_vec   = bundle['word_vec']
label_map  = bundle['label_map_inv']   # {0:'Negative', 1:'Neutral', 2:'Positive'}

# ── Preprocessing (mirrors your notebook) ─────────────────────────────────────
DIACRITICS = re.compile(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]')
PUNC       = re.compile(r'[^\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\s]')

def preprocess(text: str) -> str:
    text = unicodedata.normalize('NFC', str(text))
    text = DIACRITICS.sub('', text)
    text = PUNC.sub(' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json(force=True)
    raw_text = data.get('text', '').strip()
    if not raw_text:
        return jsonify({'error': 'No text provided'}), 400

    clean = preprocess(raw_text)

    X_word = word_vec.transform([clean])
    X_char = char_vec.transform([clean])
    X      = hstack([X_word, X_char])

    pred   = int(clf.predict(X)[0])
    proba  = clf.predict_proba(X)[0].tolist()

    label  = label_map[pred]

    # Build confidence dict with proper labels
    confidence = {}
    for idx, prob in enumerate(proba):
        confidence[label_map[idx]] = round(prob * 100, 2)

    return jsonify({
        'sentiment': label,
        'confidence': confidence,
        'text_clean': clean
    })

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'model': 'Sindhi Sentiment (LR + TF-IDF)'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
