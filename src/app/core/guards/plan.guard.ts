import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { TaytaApi } from '../services/tayta-api.service';

/**
 * Restringe el acceso a las secciones de la plataforma cuando un APODERADO
 * no tiene una suscripción activa. Lo redirige al dashboard (modelo "Vitrina").
 * ADMIN y NURSE no se ven afectados. Suscripción y dashboard quedan libres.
 */
export const planGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const api = inject(TaytaApi);
  const router = inject(Router);

  // Solo aplica al apoderado.
  if (auth.user()?.role !== 'GUARDIAN') return true;

  return api.getSubscriptions().pipe(
    map((subs) => {
      const tienePlan = subs.some((s) => (s.status || '').toUpperCase() === 'ACTIVE');
      return tienePlan ? true : router.createUrlTree(['/app/dashboard']);
    }),
    catchError(() => of(router.createUrlTree(['/app/dashboard']))),
  );
};
