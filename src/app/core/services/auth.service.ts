import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser, LoginRequest, LoginResponse, RegisterRequest } from '../models/auth.models';

const TOKEN_KEY = 'tayta_token';
const USER_KEY = 'tayta_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly _user = signal<AuthUser | null>(this.readUser());

  /** Usuario autenticado actual (reactivo). */
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(tap((res) => this.storeSession(res)));
  }

  register(data: RegisterRequest): Observable<string> {
    return this.http.post(`${environment.apiUrl}/auth/register`, data, {
      responseType: 'text',
    });
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this._user.set(null);
  }

  getToken(): string | null {
    return this.isBrowser ? localStorage.getItem(TOKEN_KEY) : null;
  }

  private storeSession(res: LoginResponse): void {
    const user: AuthUser = { id: res.id, username: res.username, role: res.role };
    if (this.isBrowser) {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    this._user.set(user);
  }

  private readUser(): AuthUser | null {
    if (!this.isBrowser) return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }
}
