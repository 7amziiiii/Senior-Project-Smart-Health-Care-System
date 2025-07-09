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

export interface User extends PendingUser {
  profile?: {
    role: string;
    approval_status: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;
  // Set to public and explicitly false to ensure real API calls
  public simulationMode = false; 
  private pendingUsers: PendingUser[] = [];
  private users: User[] = [];

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
   * @param roleFilter Optional role to filter by
   */
  getAllUsers(roleFilter?: string): Observable<User[]> {
    if (this.simulationMode) {
      console.log('Simulation mode: Returning mock users');
      
      // If we don't have any users in our simulated store yet, create some mock ones
      if (this.users.length === 0) {
        this.users = [
          {
            id: 1,
            username: 'admin_user',
            email: 'admin@example.com',
            first_name: 'Admin',
            last_name: 'User',
            role: 'Admin',
            date_joined: new Date().toISOString(),
            is_active: true,
            profile: { role: 'admin', approval_status: 'approved' }
          },
          {
            id: 2,
            username: 'doctor_user',
            email: 'doctor@example.com',
            first_name: 'Doctor',
            last_name: 'User',
            role: 'Doctor',
            date_joined: new Date().toISOString(),
            is_active: true,
            profile: { role: 'doctor', approval_status: 'approved' }
          },
          {
            id: 3,
            username: 'nurse_user',
            email: 'nurse@example.com',
            first_name: 'Nurse',
            last_name: 'User',
            role: 'Nurse',
            date_joined: new Date().toISOString(),
            is_active: true,
            profile: { role: 'nurse', approval_status: 'approved' }
          }
        ];
      }
      
      if (roleFilter && roleFilter !== 'all') {
        return of(this.users.filter(u => u.profile?.role === roleFilter.toLowerCase()));
      }
      return of(this.users);
    }
    
    let url = `${this.apiUrl}/auth/users/`;
    if (roleFilter && roleFilter !== 'all') {
      url += `?role=${roleFilter}`;
    }
    
    return this.http.get<User[]>(url, {
      withCredentials: true // Include cookies for authentication
    });
  }
  
  /**
   * Get a user by ID
   * @param userId The user ID to get
   */
  getUser(userId: number): Observable<User> {
    if (this.simulationMode) {
      const user = this.users.find(u => u.id === userId);
      return user ? of(user) : throwError(() => new Error('User not found'));
    }
    
    return this.http.get<User>(`${this.apiUrl}/auth/users/${userId}/`, {
      withCredentials: true
    });
  }
  
  /**
   * Update a user
   * @param userId The user ID to update
   * @param userData The user data to update
   */
  updateUser(userId: number, userData: Partial<User>): Observable<User> {
    if (this.simulationMode) {
      const index = this.users.findIndex(u => u.id === userId);
      if (index === -1) {
        return throwError(() => new Error('User not found'));
      }
      
      this.users[index] = { ...this.users[index], ...userData };
      return of(this.users[index]);
    }
    
    return this.http.patch<User>(`${this.apiUrl}/auth/users/${userId}/`, userData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
  }
  
  /**
   * Delete a user
   * @param userId The user ID to delete
   */
  deleteUser(userId: number): Observable<any> {
    if (this.simulationMode) {
      const index = this.users.findIndex(u => u.id === userId);
      if (index === -1) {
        return throwError(() => new Error('User not found'));
      }
      
      const username = this.users[index].username;
      this.users.splice(index, 1);
      return of({ message: `User ${username} has been deleted successfully.` });
    }
    
    return this.http.delete<any>(`${this.apiUrl}/auth/users/${userId}/`, {
      withCredentials: true,
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
  }
}
