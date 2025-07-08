import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Instrument {
  id?: number;
  name: string;
  status: string;
  rfid_tag?: number | null;
  tray_id?: number | null;
  status_display?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InstrumentService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Get all instruments
   */
  getAllInstruments(): Observable<Instrument[]> {
    return this.http.get<Instrument[]>(`${this.apiUrl}/instruments/`);
  }

  /**
   * Get instrument by ID
   */
  getInstrument(id: number): Observable<Instrument> {
    return this.http.get<Instrument>(`${this.apiUrl}/instruments/${id}/`);
  }

  /**
   * Create a new instrument with associated RFID tag
   */
  createInstrument(instrument: Instrument): Observable<Instrument> {
    return this.http.post<Instrument>(`${this.apiUrl}/instruments/`, instrument);
  }

  /**
   * Update an existing instrument
   */
  updateInstrument(id: number, instrument: Instrument): Observable<Instrument> {
    return this.http.put<Instrument>(`${this.apiUrl}/instruments/${id}/`, instrument);
  }

  /**
   * Delete an instrument
   */
  deleteInstrument(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/instruments/${id}/`);
  }
}
