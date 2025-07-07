from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import joblib
import pandas as pd
import os
import sys
import json
from datetime import datetime
import numpy as np

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import training functions for retraining
from scripts.train_model import train_model, save_model, preprocess_data

app = FastAPI(title="Predictive Maintenance API", version="1.0.0")

# Load the model at startup
model = None
@app.on_event("startup")
def load_model():
    global model
    try:
        model_path = "models/maintenance_predictor_current.joblib"
        if os.path.exists(model_path):
            model = joblib.load(model_path)
            print(f"Model loaded from {model_path}")
        else:
            print("No model found. Run training first.")
    except Exception as e:
        print(f"Error loading model: {e}")
        model = None

# Define request/response models
class PredictionRequest(BaseModel):
    equipment_id: str
    days_since_maintenance: int
    total_usage_hours: float
    avg_daily_usage: float
    procedure_count: int

class PredictionResponse(BaseModel):
    equipment_id: str
    maintenance_needed_soon: bool
    confidence: float

class MaintenanceLogRequest(BaseModel):
    equipment_id: str
    maintenance_date: str
    maintenance_type: str
    days_since_last: int

class UsageLogRequest(BaseModel):
    equipment_id: str
    check_out_time: str
    check_in_time: str
    duration_minutes: int
    procedure_id: str

# Endpoints
@app.get("/health")
def health_check():
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    global model
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    # Convert request to dataframe
    data = {k: [v] for k, v in request.dict().items() if k != 'equipment_id'}
    df = pd.DataFrame(data)
    
    # Make prediction
    try:
        prediction = model.predict(df)[0]
        probability = model.predict_proba(df)[0][1]  # Probability of positive class
        
        return {
            "equipment_id": request.equipment_id,
            "maintenance_needed_soon": bool(prediction),
            "confidence": float(probability)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/log/maintenance")
def log_maintenance(log: MaintenanceLogRequest):
    """Log a maintenance event"""
    try:
        os.makedirs("data/logs", exist_ok=True)
        log_file = "data/logs/maintenance_logs.jsonl"
        
        # Convert to dict and add timestamp
        log_data = log.dict()
        log_data["logged_at"] = datetime.now().isoformat()
        
        # Append to log file
        with open(log_file, 'a') as f:
            f.write(json.dumps(log_data) + '\n')
        
        return {"status": "success", "message": "Maintenance log recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error logging maintenance: {str(e)}")

@app.post("/log/usage")
def log_usage(log: UsageLogRequest):
    """Log equipment usage"""
    try:
        os.makedirs("data/logs", exist_ok=True)
        log_file = "data/logs/usage_logs.jsonl"
        
        # Convert to dict and add timestamp
        log_data = log.dict()
        log_data["logged_at"] = datetime.now().isoformat()
        
        # Append to log file
        with open(log_file, 'a') as f:
            f.write(json.dumps(log_data) + '\n')
        
        return {"status": "success", "message": "Usage log recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error logging usage: {str(e)}")

@app.post("/retrain")
def retrain_model(background_tasks: BackgroundTasks):
    """Trigger model retraining in the background"""
    background_tasks.add_task(_retrain_model)
    return {"status": "retraining_started", "message": "Model retraining started in background"}

async def _retrain_model():
    """Background task to retrain the model with new data"""
    try:
        # For now, we'll just retrain with synthetic data
        # In a real implementation, we'd combine synthetic data with real logs
        df = pd.read_csv("data/synthetic/ml_features.csv")
        X, y = preprocess_data(df)
        
        # Train new model
        new_model, metrics = train_model(X, y)
        
        # Save new model with timestamp version
        version = datetime.now().strftime("%Y%m%d_%H%M%S")
        save_model(new_model, metrics, version=version)
        
        # Update global model
        global model
        model = new_model
        
        print(f"Model retrained successfully: {metrics}")
        return True
    except Exception as e:
        print(f"Error retraining model: {e}")
        return False

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
