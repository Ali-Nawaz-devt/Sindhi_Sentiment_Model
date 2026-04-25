# سنڌي جذبات تجزيو — Deployment Guide

## Quick Start (Local)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the server
python app.py

# 3. Open browser
# http://localhost:5000
```

## File Structure
```
sindhi_sentiment_app/
├── app.py                       ← Flask backend
├── best_model.pkl               ← Trained model bundle
├── requirements.txt
├── templates/
│   └── index.html               ← Beautiful frontend UI
└── README.md
```

## API Usage

### POST /predict
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "هي ڏينهن تمام سٺو آهي"}'
```

**Response:**
```json
{
  "sentiment": "Positive",
  "confidence": {
    "Positive": 78.4,
    "Negative": 11.2,
    "Neutral": 10.4
  },
  "text_clean": "هي ڏينهن تمام سٺو آهي"
}
```

### GET /health
```bash
curl http://localhost:5000/health
# {"status":"ok","model":"Sindhi Sentiment (LR + TF-IDF)"}
```

---

## Cloud Deployment

### Option A — Render.com (Free)
1. Push this folder to a GitHub repo
2. Go to https://render.com → New Web Service
3. Connect your repo, set:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
4. Deploy — you'll get a public URL in ~2 minutes

Add `gunicorn` to requirements.txt for Render:
```
gunicorn>=21.0.0
```

### Option B — Railway.app (Free tier)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Option C — Local network (share on LAN)
```bash
python app.py --host 0.0.0.0 --port 5000
# Accessible at http://<your-ip>:5000 on same WiFi
```

---

## Model Details
- **Algorithm**: Logistic Regression
- **Features**: Word TF-IDF + Char TF-IDF (hstacked)
- **Classes**: Positive · Negative · Neutral
- **Training data**: 1,909 sentences (3 sources)
- **Peak CV Accuracy**: 94.8%
