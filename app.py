import gradio as gr
import joblib
from scipy.sparse import hstack
import re, unicodedata

# Load model
bundle     = joblib.load("best_model.pkl")
clf        = bundle["clf"]
char_vec   = bundle["char_vec"]
word_vec   = bundle["word_vec"]
label_map  = bundle["label_map_inv"]   # {0:'Negative', 1:'Neutral', 2:'Positive'}

# Preprocessing
DIACRITICS = re.compile(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]')
PUNC       = re.compile(r'[^\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\s]')

def preprocess(text):
    text = unicodedata.normalize("NFC", str(text))
    text = DIACRITICS.sub("", text)
    text = PUNC.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()

# Prediction function
def predict(text):
    if not text.strip():
        return "Please enter some Sindhi text.", {}

    clean  = preprocess(text)
    X      = hstack([word_vec.transform([clean]), char_vec.transform([clean])])
    pred   = int(clf.predict(X)[0])
    proba  = clf.predict_proba(X)[0]

    label  = label_map[pred]
    conf   = {label_map[i]: float(round(proba[i], 4)) for i in range(3)}

    emoji  = {"Positive": "Positive 😊", "Negative": "Negative 😔", "Neutral": "Neutral 😐"}
    return emoji[label], conf

# Sample sentences
examples = [
    ["هي ڏينهن تمام سٺو آهي"],
    ["هي خبر ٻڌي دل ڏکيو"],
    ["اڄ موسم نه گرم نه ٿڌو آهي"],
    ["محنت جو ميوو مٺو هوندو آهي"],
    ["هي ڪم بلڪل غلط آهي"],
]

# Build the Gradio interface
with gr.Blocks(title="سنڌي جذبات تجزيو", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # سنڌي جذبات تجزيو — Sindhi Sentiment Analysis
    **Model:** Logistic Regression + Dual TF-IDF &nbsp;|&nbsp;
    **Accuracy:** 94.8% CV &nbsp;|&nbsp;
    **Classes:** Positive · Negative · Neutral  
    *Trained on 1,909 sentences from 3 Sindhi newspaper corpora*
    """)

    with gr.Row():
        with gr.Column():
            text_input = gr.Textbox(
                label="Enter Sindhi text / سنڌي متن",
                placeholder="هتي سنڌي لکو…",
                lines=3,
                rtl=True
            )
            submit_btn = gr.Button("Analyse / تجزيو ڪريو", variant="primary")

        with gr.Column():
            label_out = gr.Label(label="Sentiment / جذبو")
            conf_out  = gr.Label(label="Confidence Scores")

    gr.Examples(examples=examples, inputs=text_input)

    submit_btn.click(fn=predict, inputs=text_input, outputs=[label_out, conf_out])
    text_input.submit(fn=predict, inputs=text_input, outputs=[label_out, conf_out])

demo.launch()