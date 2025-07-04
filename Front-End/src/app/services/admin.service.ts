import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PendingUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  date_joined: string;
  is_active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;
  private simulationMode = true; // Set to true to use frontend-only simulation
  private pendingUsers: PendingUser[] = [];

  constructor(private http: HttpClient) { }

  /**
   * Get all pending users (users with is_active=false)
   * Backend returns {count: number, pending_users: PendingUser[]}
   * If simulation mode is enabled, returns mock data
   */
  getPendingUsers(): Observable<PendingUser[]> {
    if (this.simulationMode) {
      console.log('Simulation mode: Returning mock pending users');
      
      // If we don't have any users in our simulated store yet, create some mock ones
      if (this.pendingUsers.length === 0) {
        this.pendingUsers = [
          {
            id: 1,
            username: 'john_doe',
            email: 'john@example.com',
            first_name: 'John',
            last_name: 'Doe',
            role: 'Doctor',
            date_joined: new Date().toISOString(),
            is_active: false
          },
          {
            id: 2,
            username: 'jane_smith',
            email: 'jane@example.com',
            first_name: 'Jane',
            last_name: 'Smith',
            role: 'Nurse',
            date_joined: new Date().toISOString(),
            is_active: false
          },
          {
            id: 3,
            username: 'bob_tech',
            email: 'bob@example.com',
            first_name: 'Bob',
            last_name: 'Tech',
            role: 'Maintenance Engineer',
            date_joined: new Date().toISOString(),
            is_active: false
          }
        ];
      }
      
      return of(this.pendingUsers);
    }
    
    return this.http.get<{count: number, pending_users: PendingUser[]}>(`${this.apiUrl}/auth/users/approval/`)
      .pipe(
        map(response => response.pending_users || [])
      );
  }

  /**
   * Approve a user by ID
   * @param userId The user ID to approve
   */
  approveUser(userId: number): Observable<any> {
    if (this.simulationMode) {
      console.log('Simulation mode: Approving user', userId);
      
      // Find and remove the user from our simulated pending users
      const user = this.pendingUsers.find(u => u.id === userId);
      if (user) {
        // Remove from pending list
        this.pendingUsers = this.pendingUsers.filter(u => u.id !== userId);
        
        // Return simulated successful response
        return of({
          message: `User ${user.username} has been approved successfully.`,
          user_id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          is_active: true
        });
      }
      
      // If user not found, return error
      return throwError(() => new Error('User not found'));
    }
    
    return this.http.post<any>(`${this.apiUrl}/auth/users/${userId}/approve/`, { action: 'approve' });
  }
}
