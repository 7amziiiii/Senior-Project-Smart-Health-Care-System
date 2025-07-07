import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import sys

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def generate_equipment(count=50):
    """Generate synthetic equipment data"""
    equipment_ids = [f"EQ{i:04d}" for i in range(1, count+1)]
    equipment_types = ["MRI", "X-Ray", "Ultrasound", "CT Scanner", "Ventilator"]
    
    equipment = []
    for eq_id in equipment_ids:
        eq_type = np.random.choice(equipment_types)
        install_date = datetime.now() - timedelta(days=np.random.randint(365, 1825))
        equipment.append({
            "equipment_id": eq_id,
            "equipment_type": eq_type,
            "installation_date": install_date
        })
    
    return pd.DataFrame(equipment)

def generate_usage_logs(equipment_df, days=365, avg_uses_per_day=0.8):
    """Generate usage logs for equipment"""
    usage_logs = []
    for _, equip in equipment_df.iterrows():
        # Create usage pattern with some randomness
        num_uses = int(days * avg_uses_per_day * (0.5 + np.random.random()))
        for _ in range(num_uses):
            use_date = equip['installation_date'] + timedelta(days=np.random.randint(1, days))
            duration = np.random.randint(30, 240)  # 30 min to 4 hours
            
            usage_logs.append({
                "equipment_id": equip['equipment_id'],
                "check_out_time": use_date,
                "check_in_time": use_date + timedelta(minutes=duration),
                "duration_minutes": duration
            })
    
    return pd.DataFrame(usage_logs)

def generate_maintenance_events(equipment_df, usage_logs_df):
    """Generate maintenance events based on usage patterns"""
    maintenance_logs = []
    
    for _, equip in equipment_df.iterrows():
        # Group usage by equipment
        eq_usage = usage_logs_df[usage_logs_df['equipment_id'] == equip['equipment_id']]
        
        if len(eq_usage) == 0:
            continue
            
        # Sort by check-out time
        eq_usage = eq_usage.sort_values('check_out_time')
        
        # Calculate cumulative usage
        total_usage = 0
        last_maint_date = equip['installation_date']
        
        # Add scheduled maintenance every ~1000 minutes of usage or 90 days
        for _, usage in eq_usage.iterrows():
            total_usage += usage['duration_minutes']
            
            # Add randomness to maintenance threshold
            usage_threshold = 1000 * (0.8 + 0.4 * np.random.random())
            days_threshold = 90 * (0.8 + 0.4 * np.random.random())
            
            days_since_maint = (usage['check_out_time'] - last_maint_date).days
            
            if total_usage >= usage_threshold or days_since_maint >= days_threshold:
                # Schedule maintenance after this usage
                maint_date = usage['check_in_time'] + timedelta(days=np.random.randint(1, 7))
                maint_type = np.random.choice(['routine', 'preventive', 'corrective'], 
                                              p=[0.7, 0.2, 0.1])
                
                maintenance_logs.append({
                    "equipment_id": equip['equipment_id'],
                    "maintenance_date": maint_date,
                    "maintenance_type": maint_type,
                    "days_since_last": days_since_maint,
                    "usage_since_last": total_usage
                })
                
                # Reset counters
                total_usage = 0
                last_maint_date = maint_date
    
    return pd.DataFrame(maintenance_logs)

def create_ml_features(equipment_df, usage_logs_df, maintenance_logs_df):
    """Create ML features from the synthetic data"""
    # Set a reference date (today)
    reference_date = datetime.now()
    
    # Features list
    features = []
    
    # Process each equipment
    for _, equip in equipment_df.iterrows():
        eq_id = equip['equipment_id']
        
        # Get usage and maintenance for this equipment
        eq_usage = usage_logs_df[usage_logs_df['equipment_id'] == eq_id]
        eq_maint = maintenance_logs_df[maintenance_logs_df['equipment_id'] == eq_id]
        
        if len(eq_maint) == 0:
            continue
            
        # Sort maintenance by date
        eq_maint = eq_maint.sort_values('maintenance_date')
        
        # For each maintenance event, create a record with features leading up to it
        for i in range(1, len(eq_maint)):
            prev_maint = eq_maint.iloc[i-1]
            curr_maint = eq_maint.iloc[i]
            
            # Get usage between the two maintenance events
            usage_between = eq_usage[
                (eq_usage['check_out_time'] >= prev_maint['maintenance_date']) & 
                (eq_usage['check_in_time'] < curr_maint['maintenance_date'])
            ]
            
            if len(usage_between) == 0:
                continue
                
            # Calculate features
            days_since_maintenance = (curr_maint['maintenance_date'] - prev_maint['maintenance_date']).days
            total_usage_hours = usage_between['duration_minutes'].sum() / 60
            avg_daily_usage = total_usage_hours / max(1, days_since_maintenance)
            procedure_count = len(usage_between)
            
            # Target: Does this equipment need maintenance soon?
            # Define "soon" as within the next 30 days
            needs_maintenance_soon = True  # Since this record led to maintenance
            
            features.append({
                "equipment_id": eq_id,
                "days_since_maintenance": days_since_maintenance,
                "total_usage_hours": total_usage_hours,
                "avg_daily_usage": avg_daily_usage,
                "procedure_count": procedure_count,
                "needs_maintenance_soon": needs_maintenance_soon
            })
            
        # Add current state (may or may not need maintenance)
        if len(eq_maint) > 0:
            last_maint = eq_maint.iloc[-1]
            
            # Get usage since last maintenance
            usage_since = eq_usage[eq_usage['check_out_time'] >= last_maint['maintenance_date']]
            
            if len(usage_since) > 0:
                days_since_maintenance = (reference_date - last_maint['maintenance_date']).days
                total_usage_hours = usage_since['duration_minutes'].sum() / 60
                avg_daily_usage = total_usage_hours / max(1, days_since_maintenance)
                procedure_count = len(usage_since)
                
                # Decide if it needs maintenance based on thresholds
                usage_threshold = 50  # hours
                days_threshold = 75  # days
                
                needs_maintenance_soon = (
                    total_usage_hours >= usage_threshold * 0.7 or 
                    days_since_maintenance >= days_threshold * 0.7
                )
                
                features.append({
                    "equipment_id": eq_id,
                    "days_since_maintenance": days_since_maintenance,
                    "total_usage_hours": total_usage_hours,
                    "avg_daily_usage": avg_daily_usage,
                    "procedure_count": procedure_count,
                    "needs_maintenance_soon": needs_maintenance_soon
                })
    
    return pd.DataFrame(features)

def generate_dataset(num_equipment=50, days=365):
    """Generate full synthetic dataset"""
    print("Generating equipment data...")
    equipment_df = generate_equipment(num_equipment)
    
    print("Generating usage logs...")
    usage_logs_df = generate_usage_logs(equipment_df, days)
    
    print("Generating maintenance events...")
    maintenance_logs_df = generate_maintenance_events(equipment_df, usage_logs_df)
    
    print("Creating ML features...")
    features_df = create_ml_features(equipment_df, usage_logs_df, maintenance_logs_df)
    
    # Save all dataframes
    equipment_df.to_csv("data/synthetic/equipment.csv", index=False)
    usage_logs_df.to_csv("data/synthetic/usage_logs.csv", index=False)
    maintenance_logs_df.to_csv("data/synthetic/maintenance_logs.csv", index=False)
    features_df.to_csv("data/synthetic/ml_features.csv", index=False)
    
    print(f"Generated {len(equipment_df)} equipment records")
    print(f"Generated {len(usage_logs_df)} usage logs")
    print(f"Generated {len(maintenance_logs_df)} maintenance events")
    print(f"Created {len(features_df)} ML feature records")
    
    return {
        "equipment": equipment_df,
        "usage_logs": usage_logs_df,
        "maintenance_logs": maintenance_logs_df,
        "features": features_df
    }

if __name__ == "__main__":
    # Create data directories if they don't exist
    os.makedirs("data/synthetic", exist_ok=True)
    os.makedirs("data/logs", exist_ok=True)
    
    # Generate dataset
    dataset = generate_dataset(num_equipment=50, days=730)  # 2 years of data
