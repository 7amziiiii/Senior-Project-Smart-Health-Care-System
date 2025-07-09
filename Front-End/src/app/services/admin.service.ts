import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
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

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile?: {
    role: string;
    approved_status: string;
    approved_by?: number;
    approval_date?: string;
  };
  date_joined?: string;
  last_login?: string;
  is_active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;
  private simulationMode = false; // Always false to use real backend API
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
    
    return this.http.get<any>(`${this.apiUrl}/auth/users/approval/`, {
      withCredentials: true // Include cookies for authentication
    }).pipe(
      map(response => {
        console.log('Backend response for pending users:', response);
        
        // Handle different response formats
        if (Array.isArray(response)) {
          // If response is already an array
          return response;
        } else if (response && response.pending_users) {
          // If response is {count, pending_users}
          return response.pending_users || [];
        } else if (response && typeof response === 'object') {
          // If response is another object structure, try to find users
          console.log('Unexpected response format, searching for users array');
          return Object.values(response).find(Array.isArray) || [];
        } else {
          // Fallback to empty array
          console.warn('Could not extract users from response');
          return [];
        }
      })
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
    
    console.log(`Sending approval request for user ID: ${userId} to ${this.apiUrl}/auth/users/${userId}/approve/`);
    
    // Include proper headers for authentication and CSRF protection
    return this.http.post<any>(
      `${this.apiUrl}/auth/users/${userId}/approve/`, 
      { action: 'approve' }, // Backend expects an 'action' parameter
      {
        withCredentials: true, // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest', // Helps with CSRF protection
        }
      }
    );
  }

  /**
   * Get all users in the system
   * Uses our new backend endpoint for admin user management
   */
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/auth/users/`, {
      withCredentials: true
    }).pipe(
      catchError(err => {
        console.error('Error fetching all users:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Get a single user by ID
   * @param userId The user ID to fetch
   */
  getUser(userId: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/users/${userId}/`, {
      withCredentials: true
    }).pipe(
      catchError(err => {
        console.error(`Error fetching user ${userId}:`, err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Update a user's information
   * @param userId The user ID to update
   * @param userData The updated user data
   */
  updateUser(userId: number, userData: any): Observable<User> {
    return this.http.put<User>(
      `${this.apiUrl}/auth/users/${userId}/`, 
      userData,
      {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    ).pipe(
      catchError(err => {
        console.error(`Error updating user ${userId}:`, err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Delete a user
   * @param userId The user ID to delete
   */
  deleteUser(userId: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/auth/users/${userId}/`,
      {
        withCredentials: true,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    ).pipe(
      catchError(err => {
        console.error(`Error deleting user ${userId}:`, err);
        return throwError(() => err);
      })
    );
  }
}
