from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import traceback

from data_processor import DataProcessor
from model_trainer import ModelTrainer
from predictor import Predictor

app = FastAPI(title="ML Interactive Studio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
processor = DataProcessor()
trainer = ModelTrainer()
predictor = Predictor()

# ── Request Models ────────────────────────────────────────────────────────────

class CleanRequest(BaseModel):
    drop_missing: bool = True
    normalize: bool = False
    remove_outliers: bool = False
    outlier_threshold: float = 3.0

class TrainRequest(BaseModel):
    model_name: str
    params: Dict[str, Any] = {}
    test_size: float = 0.2
    val_size: float = 0.1
    cv_folds: int = 5

class PredictRequest(BaseModel):
    text: str
    model_name: str

class CompareRequest(BaseModel):
    models: list[str]
    test_size: float = 0.2

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "message": "ML Studio API is running"}

@app.get("/load-data")
def load_data():
    try:
        result = processor.load_dataset()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clean-data")
def clean_data(req: CleanRequest):
    try:
        result = processor.clean_dataset(
            drop_missing=req.drop_missing,
            normalize=req.normalize,
            remove_outliers=req.remove_outliers,
            outlier_threshold=req.outlier_threshold,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dataset-stats")
def dataset_stats():
    try:
        return processor.get_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train-model")
def train_model(req: TrainRequest):
    try:
        df = processor.get_dataframe()
        result = trainer.train(
            df=df,
            model_name=req.model_name,
            params=req.params,
            test_size=req.test_size,
            val_size=req.val_size,
            cv_folds=req.cv_folds,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model-results/{model_name}")
def get_model_results(model_name: str):
    result = trainer.get_results(model_name)
    if result is None:
        raise HTTPException(status_code=404, detail="Model not trained yet")
    return result

@app.post("/compare-models")
def compare_models(req: CompareRequest):
    try:
        df = processor.get_dataframe()
        result = trainer.compare(df=df, models=req.models, test_size=req.test_size)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/available-models")
def available_models():
    return trainer.get_available_models()

@app.post("/predict")
def predict(req: PredictRequest):
    try:
        result = predictor.predict(
            text=req.text,
            model_name=req.model_name,
            trainer=trainer,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/feature-importance/{model_name}")
def feature_importance(model_name: str):
    try:
        result = trainer.get_feature_importance(model_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/learning-curve/{model_name}")
def learning_curve(model_name: str):
    try:
        df = processor.get_dataframe()
        result = trainer.compute_learning_curve(model_name, df)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SaveModelRequest(BaseModel):
    model_name: Optional[str] = None   # None = save best / all trained
    save_mode: str = "separate"         # "separate" | "bundle"
    output_dir: str = "models/sentiment"


@app.post("/save-model")
def save_model(req: SaveModelRequest):
    """
    Save trained model(s) as .pkl files.

    save_mode='separate' → one file per model: logistic_regression.pkl, svm.pkl, naive_bayes.pkl
    save_mode='bundle'   → single file:        sindhi_sentiment_bundle.pkl

    Each .pkl contains: clf + char_vec + word_vec + label_map_inv
    """
    try:
        result = trainer.save_models(
            model_name=req.model_name,
            save_mode=req.save_mode,
            output_dir=req.output_dir,
        )
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))