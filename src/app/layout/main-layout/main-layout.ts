import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  roles: string[];
}

const NAV: NavItem[] = [
  { label: 'Inicio', icon: 'dashboard', path: '/app/dashboard', roles: ['ADMIN', 'GUARDIAN', 'NURSE'] },
  { label: 'Adultos mayores', icon: 'elderly', path: '/app/elderly', roles: ['ADMIN', 'GUARDIAN', 'NURSE'] },
  { label: 'Monitoreo', icon: 'monitor_heart', path: '/app/monitoring', roles: ['ADMIN', 'GUARDIAN', 'NURSE'] },
  { label: 'Calendario', icon: 'calendar_month', path: '/app/calendar', roles: ['GUARDIAN', 'NURSE'] },
  { label: 'Centros de salud', icon: 'local_hospital', path: '/app/health-centers', roles: ['ADMIN', 'GUARDIAN', 'NURSE'] },
  { label: 'Suscripción', icon: 'workspace_premium', path: '/app/subscription', roles: ['ADMIN', 'GUARDIAN'] },
  { label: 'Usuarios', icon: 'group', path: '/app/users', roles: ['ADMIN'] },
];

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly sidebarOpen = signal(false);

  readonly navItems = computed(() => {
    const role = this.user()?.role ?? '';
    return NAV.filter((item) => item.roles.includes(role));
  });

  readonly initials = computed(() => {
    const name = this.user()?.username ?? '';
    return name.slice(0, 2).toUpperCase();
  });

  readonly roleClass = computed(() => `badge--${(this.user()?.role ?? '').toLowerCase()}`);

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
