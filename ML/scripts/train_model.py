import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import joblib
import os
from datetime import datetime
import sys
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def load_data(data_path="data/synthetic/ml_features.csv"):
    """Load the ML features dataset"""
    return pd.read_csv(data_path)

def preprocess_data(df):
    """Preprocess the data for training"""
    # Drop equipment_id as it's not a feature for training
    X = df.drop(['equipment_id', 'needs_maintenance_soon'], axis=1)
    y = df['needs_maintenance_soon']
    
    return X, y

def train_model(X, y):
    """Train a Random Forest classifier"""
    # Split data into training and test sets
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Create and train the model
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42
    )
    model.fit(X_train, y_train)
    
    # Evaluate the model
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    
    print(f"Model Metrics:")
    print(f"Accuracy: {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall: {recall:.4f}")
    print(f"F1 Score: {f1:.4f}")
    
    # Feature importance
    feature_importance = dict(zip(X.columns, model.feature_importances_))
    print("\nFeature Importance:")
    for feature, importance in sorted(feature_importance.items(), key=lambda x: x[1], reverse=True):
        print(f"{feature}: {importance:.4f}")
    
    # Generate confusion matrix plot
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=['No Maintenance', 'Needs Maintenance'],
                yticklabels=['No Maintenance', 'Needs Maintenance'])
    plt.ylabel('Actual')
    plt.xlabel('Predicted')
    plt.title('Confusion Matrix')
    
    # Ensure directory exists
    os.makedirs("models", exist_ok=True)
    plt.savefig("models/confusion_matrix.png")
    plt.close()
    
    return model, {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'feature_importance': feature_importance,
        'confusion_matrix': cm.tolist()
    }

def save_model(model, metrics, version=None):
    """Save the trained model and metrics"""
    os.makedirs("models", exist_ok=True)
    os.makedirs("models/history", exist_ok=True)
    
    if version is None:
        # Use timestamp as version
        version = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save model
    model_path = f"models/maintenance_predictor_{version}.joblib"
    joblib.dump(model, model_path)
    
    # Save metrics as CSV
    metrics_df = pd.DataFrame({
        'metric': ['accuracy', 'precision', 'recall', 'f1'],
        'value': [metrics['accuracy'], metrics['precision'], metrics['recall'], metrics['f1']]
    })
    metrics_df.to_csv(f"models/metrics_{version}.csv", index=False)
    
    # Save as current model
    joblib.dump(model, "models/maintenance_predictor_current.joblib")
    
    # Save feature importance
    feature_importance_df = pd.DataFrame({
        'feature': list(metrics['feature_importance'].keys()),
        'importance': list(metrics['feature_importance'].values())
    }).sort_values('importance', ascending=False)
    feature_importance_df.to_csv(f"models/feature_importance_{version}.csv", index=False)
    
    print(f"Model saved: {model_path}")
    return model_path

if __name__ == "__main__":
    # Load data
    print("Loading data...")
    df = load_data()
    
    # Preprocess data
    print("Preprocessing data...")
    X, y = preprocess_data(df)
    
    # Train model
    print("Training model...")
    model, metrics = train_model(X, y)
    
    # Save model
    model_path = save_model(model, metrics)
    print(f"Model and metrics saved to {os.path.dirname(model_path)}")
