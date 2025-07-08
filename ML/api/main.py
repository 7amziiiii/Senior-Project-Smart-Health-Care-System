from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import sys
import os
import json
import logging
import joblib
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import training functions for retraining
from scripts.train_model import train_model, save_model, preprocess_data

app = FastAPI(title="Predictive Maintenance API", version="1.0.0")

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Load the model at startup
model = None
@app.on_event("startup")
def load_model():
    global model
    try:
        model_path = "D:\\Senior\\Final Senior\\models\\maintenance_predictor_current.joblib"
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
    
    # Extract request data and add missing features with default values
    data = request.model_dump()
    
    # Map frontend field names to the exact feature names used during model training
    # According to error: model was trained with days_since_maintenance, total_usage_hours, avg_daily_usage, procedure_count
    mapped_data = {
        # Use exactly the same feature names as used during training
        'days_since_maintenance': data.get('days_since_maintenance', 0),
        'total_usage_hours': data.get('total_usage_hours', 0),  # Keep the original name
        'avg_daily_usage': data.get('avg_daily_usage', 0),      # Required by model
        'procedure_count': data.get('procedure_count', 0)       # Required by model
    }
    
    print(f"Prediction data: {mapped_data}")
    
    # Convert to dataframe with all required features
    df = pd.DataFrame({k: [v] for k, v in mapped_data.items()})
    
    # Make prediction
    try:
        prediction = model.predict(df)[0]
        
        # Handle different predict_proba output formats safely
        probabilities = model.predict_proba(df)[0]
        print(f"Prediction: {prediction}, Probabilities: {probabilities}")
        
        # If binary classification (2 classes), get probability of positive class (index 1)
        # Otherwise, use the first probability or the probability corresponding to the prediction
        if len(probabilities) > 1:
            probability = float(probabilities[1])  # Probability of positive class (index 1)
        else:
            probability = float(probabilities[0])  # Use the only probability available
        
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
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
