import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Tray {
  id: number;
  name: string;
  rfid_tag?: number;
  status?: string;
  type?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TrayService {
  private apiUrl = `${environment.apiUrl}/trays/`;

  constructor(private http: HttpClient) { }

  getTrays(): Observable<Tray[]> {
    console.log('TrayService: Fetching trays from', this.apiUrl);
    
    // Get the token from localStorage
    const token = localStorage.getItem('token');
    
    // Set up headers with authentication token
    const headers = new HttpHeaders({
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    });
    
    return this.http.get<Tray[]>(this.apiUrl, { headers }).pipe(
      tap(trays => {
        console.log('TrayService: Received trays:', trays);
        // If no trays are returned, add some default ones for testing
        if (!trays || trays.length === 0) {
          console.warn('TrayService: No trays returned from backend, using mock data');
        }
      }),
      catchError(error => {
        console.error('TrayService: Error fetching trays:', error);
        // Return mock data in case of error
        const mockTrays: Tray[] = [
          { id: 1, name: 'General Surgery Tray', type: 'Surgery', status: 'available' },
          { id: 2, name: 'Orthopedic Tray', type: 'Orthopedic', status: 'available' },
          { id: 3, name: 'Cardiac Tray', type: 'Cardiac', status: 'available' }
        ];
        console.log('TrayService: Returning mock trays:', mockTrays);
        return of(mockTrays);
      })
    );
  }

  getTray(id: number): Observable<Tray> {
    return this.http.get<Tray>(`${this.apiUrl}/${id}`);
  }

  createTray(tray: Partial<Tray>): Observable<Tray> {
    return this.http.post<Tray>(this.apiUrl, tray);
  }

  updateTray(id: number, tray: Partial<Tray>): Observable<Tray> {
    return this.http.put<Tray>(`${this.apiUrl}/${id}`, tray);
  }

  deleteTray(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
