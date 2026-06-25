import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { AuthService } from '../../core/services/auth.service';
import { Payment, Subscription } from '../../core/models/domain.models';
import { extractError } from '../../core/utils/http-error';

@Component({
  selector: 'app-subscription',
  imports: [DecimalPipe, FormsModule],
  templateUrl: './subscription.html',
  styleUrl: './subscription.scss',
})
export default class SubscriptionPage {
  private readonly api = inject(TaytaApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly subscriptions = signal<Subscription[]>([]);
  readonly payments = signal<Payment[]>([]);

  readonly isAdmin = computed(() => this.auth.user()?.role === 'ADMIN');
  readonly isGuardian = computed(() => this.auth.user()?.role === 'GUARDIAN');

  readonly plans = [
    {
      type: 'BASIC',
      price: 60,
      limit: '1 adulto mayor',
      features: ['Calendario de citas y medicación', 'Monitoreo básico de signos vitales'],
    },
    {
      type: 'STANDARD',
      price: 90,
      limit: 'Hasta 3 adultos mayores',
      features: ['Todo lo de Basic', 'Monitoreo completo', 'Historia clínica', 'Alertas básicas'],
    },
    {
      type: 'PREMIUM',
      price: 120,
      limit: 'Adultos mayores ilimitados',
      features: ['Todo lo de Standard', 'Enfermero asignado', 'Alertas en tiempo real', 'Soporte prioritario 24/7'],
    },
  ];

  readonly paymentMethods = ['Tarjeta', 'Efectivo', 'Yape / Plin'];

  readonly currentPlan = computed(() => {
    const active = this.subscriptions().find((s) => (s.status || '').toUpperCase() === 'ACTIVE');
    return (active?.planType || '').toUpperCase();
  });

  readonly hasActive = computed(() => this.currentPlan() !== '');

  // Filtro por apoderado (solo admin)
  readonly guardianFilter = signal<number | 'all'>('all');
  readonly guardianOptions = computed(() => {
    const map = new Map<number, string>();
    for (const s of this.subscriptions()) {
      if (s.guardian) {
        map.set(s.guardian.id, s.guardian.user?.username || ('DNI ' + s.guardian.dni));
      }
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  });

  readonly visibleSubs = computed(() => {
    const f = this.guardianFilter();
    return f === 'all' ? this.subscriptions() : this.subscriptions().filter((s) => s.guardian?.id === f);
  });

  readonly visiblePayments = computed(() => {
    const f = this.guardianFilter();
    return f === 'all' ? this.payments() : this.payments().filter((p) => p.subscription?.guardian?.id === f);
  });

  readonly totalPaid = computed(() =>
    this.visiblePayments()
      .filter((p) => (p.status || '').toUpperCase() === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
  );

  // ── Modal de contratación ──
  readonly subModalPlan = signal<string | null>(null);
  readonly method = signal('Tarjeta');
  readonly subscribing = signal(false);
  readonly subError = signal<string | null>(null);
  readonly subscribedOk = signal(false);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const username = this.auth.user()?.username;
    const isAdmin = this.auth.user()?.role === 'ADMIN';

    forkJoin({
      subs: this.api.getSubscriptions(),
      pays: this.api.getPayments(),
    }).subscribe({
      next: ({ subs, pays }) => {
        const mySubs = isAdmin ? subs : subs.filter((s) => s.guardian?.user?.username === username);
        const ids = new Set(mySubs.map((s) => s.id));
        this.subscriptions.set(mySubs);
        this.payments.set(
          pays
            .filter((p) => p.subscription && ids.has(p.subscription.id))
            .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1)),
        );
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  planClass(plan: string): string {
    return `plan--${(plan || '').toLowerCase()}`;
  }

  isActive(status: string): boolean {
    return (status || '').toUpperCase() === 'ACTIVE';
  }

  netPrice(s: Subscription): number {
    return Number(s.price || 0) - Number(s.discount || 0);
  }

  openSubscribe(planType: string): void {
    this.subModalPlan.set(planType);
    this.method.set('Tarjeta');
    this.subError.set(null);
  }

  closeSubscribe(): void {
    this.subModalPlan.set(null);
  }

  confirmSubscribe(): void {
    const plan = this.subModalPlan();
    if (!plan || this.subscribing()) return;
    this.subscribing.set(true);
    this.subError.set(null);

    this.api.subscribe({ planType: plan, method: this.method() }).subscribe({
      next: () => {
        this.subscribing.set(false);
        this.subModalPlan.set(null);
        this.subscribedOk.set(true);
        this.load();
        // Pago simulado: queda activo al instante → al dashboard ya desbloqueado.
        setTimeout(() => this.router.navigate(['/app/dashboard']), 1400);
      },
      error: (err) => {
        this.subscribing.set(false);
        this.subError.set(extractError(err, 'No se pudo contratar el plan.'));
      },
    });
  }
}
