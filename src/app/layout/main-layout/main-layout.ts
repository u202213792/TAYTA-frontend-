import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { LangToggle } from '../../shared/lang-toggle/lang-toggle';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  roles: string[];
}

const NAV: NavItem[] = [
  { label: 'nav.dashboard', icon: 'dashboard', path: '/app/dashboard', roles: ['ADMIN', 'GUARDIAN', 'NURSE'] },
  { label: 'nav.elderly', icon: 'elderly', path: '/app/elderly', roles: ['ADMIN', 'GUARDIAN', 'NURSE'] },
  { label: 'nav.monitoring', icon: 'monitor_heart', path: '/app/monitoring', roles: ['ADMIN', 'GUARDIAN', 'NURSE'] },
  { label: 'nav.calendar', icon: 'calendar_month', path: '/app/calendar', roles: ['GUARDIAN', 'NURSE'] },
  { label: 'nav.healthCenters', icon: 'local_hospital', path: '/app/health-centers', roles: ['ADMIN', 'GUARDIAN', 'NURSE'] },
  { label: 'nav.subscription', icon: 'workspace_premium', path: '/app/subscription', roles: ['ADMIN', 'GUARDIAN'] },
  { label: 'nav.users', icon: 'group', path: '/app/users', roles: ['ADMIN'] },
  { label: 'nav.nurses', icon: 'medical_services', path: '/app/nurses', roles: ['ADMIN'] },
];

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LangToggle],
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
  readonly roleLower = computed(() => (this.user()?.role ?? '').toLowerCase());

  // Etiqueta del panel según el rol (refuerza la identidad de cada uno)
  readonly panelTag = computed(() => {
    switch (this.user()?.role) {
      case 'GUARDIAN': return 'panelTag.guardian';
      case 'NURSE': return 'panelTag.nurse';
      case 'ADMIN': return 'panelTag.admin';
      default: return 'panelTag.default';
    }
  });

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
