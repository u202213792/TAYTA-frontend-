import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Permite el acceso solo si el rol del usuario está en route.data['roles']. */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowed = (route.data?.['roles'] as string[]) ?? [];

  const role = auth.user()?.role;
  if (role && allowed.includes(role)) return true;

  return router.createUrlTree(['/app/dashboard']);
};
