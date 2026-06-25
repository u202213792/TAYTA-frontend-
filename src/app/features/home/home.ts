import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  imports: [],
  template: `
    <div style="padding: 2rem; font-family: sans-serif;">
      <h2>Bienvenido, {{ auth.user()?.username }} 👋</h2>
      <p>Rol: {{ auth.user()?.role }}</p>
      <button (click)="logout()">Cerrar sesión</button>
    </div>
  `,
})
export default class Home {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
