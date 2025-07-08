import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MaintenancePrediction {
  equipment_id: string;
  maintenance_needed_soon: boolean;
  confidence: number;
}

export interface PredictionRequest {
  equipment_id: string;
  days_since_maintenance: number;
  total_usage_hours: number;
  avg_daily_usage: number;
  procedure_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class MlService {
  private mlApiUrl = 'http://localhost:8001';

  constructor(private http: HttpClient) { }

  /**
   * Get maintenance prediction for equipment
   */
  getPrediction(request: PredictionRequest): Observable<MaintenancePrediction> {
    return this.http.post<MaintenancePrediction>(`${this.mlApiUrl}/predict`, request);
  }

  /**
   * Log maintenance event
   */
  logMaintenance(equipmentId: string, maintenanceType: string, date: Date, daysSinceLast: number): Observable<any> {
    return this.http.post(`${this.mlApiUrl}/log/maintenance`, {
      equipment_id: equipmentId,
      maintenance_date: date.toISOString(),
      maintenance_type: maintenanceType,
      days_since_last: daysSinceLast
    });
  }

  /**
   * Log usage event
   */
  logUsage(equipmentId: string, checkOut: Date, checkIn: Date, durationMinutes: number, procedureId: string): Observable<any> {
    return this.http.post(`${this.mlApiUrl}/log/usage`, {
      equipment_id: equipmentId,
      check_out_time: checkOut.toISOString(),
      check_in_time: checkIn.toISOString(),
      duration_minutes: durationMinutes,
      procedure_id: procedureId
    });
  }

  /**
   * Manually trigger model retraining
   */
  triggerRetraining(): Observable<any> {
    return this.http.post(`${this.mlApiUrl}/retrain`, {});
  }
}
