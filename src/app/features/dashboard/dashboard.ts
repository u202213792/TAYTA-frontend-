import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { CalendarEntry, Elderly, Monitoring } from '../../core/models/domain.models';

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  accent: string;
}

interface QuickAction {
  label: string;
  description: string;
  icon: string;
  path: string;
}

interface ActivityItem {
  icon: string;
  accent: string;
  text: string;
  time: string;
}

interface UpcomingEvent {
  type: string;
  icon: string;
  accent: string;
  label: string;
  date: string;
  time: string | null;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export default class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly api = inject(TaytaApi);

  readonly user = this.auth.user;
  readonly loading = signal(true);
  readonly stats = signal<StatCard[]>([]);
  readonly isGuardian = computed(() => this.user()?.role === 'GUARDIAN');

  // Modelo "Vitrina": apoderado sin plan activo
  readonly hasActivePlan = computed(() => !!this.gPlan());
  readonly locked = computed(() => this.isGuardian() && !this.loading() && !this.hasActivePlan());
  readonly showUpgrade = signal(false);

  openUpgrade(): void { this.showUpgrade.set(true); }
  closeUpgrade(): void { this.showUpgrade.set(false); }

  // ── Datos del apoderado (vista rica, por adulto mayor) ──
  readonly gElderlyList = signal<Elderly[]>([]);
  readonly selectedId = signal<number | null>(null);
  private readonly rawMonitorings = signal<Monitoring[]>([]);
  private readonly rawCalendars = signal<CalendarEntry[]>([]);
  readonly gPlan = signal<string | null>(null);
  readonly gNextCharge = signal<string | null>(null);
  private readonly today = new Date().toISOString().slice(0, 10);

  readonly gElderlyCount = computed(() => this.gElderlyList().length);

  readonly selectedElderly = computed(() => {
    const id = this.selectedId();
    return this.gElderlyList().find((e) => e.id === id) ?? this.gElderlyList()[0] ?? null;
  });

  readonly gLatest = computed<Monitoring | null>(() => {
    const id = this.selectedElderly()?.id;
    if (id == null) return null;
    return this.rawMonitorings().find((m) => m.elderly?.id === id) ?? null;
  });

  readonly gActivity = computed<ActivityItem[]>(() => {
    const id = this.selectedElderly()?.id;
    if (id == null) return [];
    return this.rawMonitorings()
      .filter((m) => m.elderly?.id === id)
      .slice(0, 4)
      .map((m) => ({
        icon: 'monitor_heart',
        accent: 'violet',
        text: `Monitoreo (${m.vitalSignsStatus || 's/d'})` + (m.nurse?.user?.username ? ` · ${m.nurse.user.username}` : ''),
        time: `${m.monitoringDate}${m.monitoringTime ? ' · ' + m.monitoringTime.slice(0, 5) : ''}`,
      }));
  });

  readonly gUpcoming = computed<UpcomingEvent[]>(() => {
    const id = this.selectedElderly()?.id;
    if (id == null) return [];
    const mine = this.rawCalendars().filter((c) => c.elderly?.id === id);
    return this.flattenUpcoming(mine, this.today).slice(0, 3);
  });

  readonly gStatus = computed(() => {
    const s = (this.gLatest()?.vitalSignsStatus || '').toUpperCase();
    if (s.startsWith('NORMAL')) return { label: 'Estable', cls: 'ok' };
    if (s.startsWith('ALERTA')) return { label: 'En alerta', cls: 'warn' };
    if (s) return { label: 'Crítico', cls: 'danger' };
    return { label: 'Sin datos', cls: 'muted' };
  });

  readonly greeting = computed(() => {
    const role = this.user()?.role;
    if (role === 'ADMIN') return 'Panel de administración';
    if (role === 'NURSE') return 'Panel del personal de enfermería';
    return 'Panel del apoderado';
  });

  readonly heroClass = computed(() => {
    const role = this.user()?.role;
    if (role === 'NURSE') return 'hero--nurse';
    if (role === 'GUARDIAN') return 'hero--guardian';
    return 'hero--admin';
  });

  readonly heroIcon = computed(() => {
    const role = this.user()?.role;
    if (role === 'ADMIN') return 'admin_panel_settings';
    if (role === 'NURSE') return 'medical_services';
    return 'diversity_1';
  });

  readonly heroNote = computed(() => {
    const role = this.user()?.role;
    if (role === 'ADMIN') return 'Gestiona la plataforma y revisa las métricas clave.';
    if (role === 'NURSE') return 'Registra el monitoreo y organiza la atención del día.';
    return 'Sigue de cerca la salud y el cuidado de tu adulto mayor.';
  });

  readonly quickActions = computed<QuickAction[]>(() => {
    const role = this.user()?.role;
    if (role === 'ADMIN') {
      return [
        { label: 'Usuarios', description: 'Gestiona cuentas y roles', icon: 'group', path: '/app/users' },
        { label: 'Centros de salud', description: 'Administra los centros', icon: 'local_hospital', path: '/app/health-centers' },
        { label: 'Adultos mayores', description: 'Registro general', icon: 'elderly', path: '/app/elderly' },
      ];
    }
    if (role === 'NURSE') {
      return [
        { label: 'Registrar monitoreo', description: 'Signos vitales y observaciones', icon: 'monitor_heart', path: '/app/monitoring' },
        { label: 'Calendario clínico', description: 'Citas, terapias y vacunas', icon: 'calendar_month', path: '/app/calendar' },
        { label: 'Mis pacientes', description: 'Adultos mayores asignados', icon: 'elderly', path: '/app/elderly' },
      ];
    }
    return [];
  });

  constructor() {
    if (this.isGuardian()) {
      this.loadGuardian();
    } else {
      this.loadStats();
    }
  }

  selectElderly(id: number): void {
    this.selectedId.set(id);
  }

  // ── Carga del apoderado ──
  private loadGuardian(): void {
    forkJoin({
      elderly: this.api.getElderly().pipe(catchError(() => of([] as Elderly[]))),
      monitorings: this.api.getMonitorings().pipe(catchError(() => of([] as Monitoring[]))),
      calendars: this.api.getCalendars().pipe(catchError(() => of([] as CalendarEntry[]))),
      subs: this.api.getSubscriptions().pipe(catchError(() => of([]))),
    }).subscribe((r) => {
      this.gElderlyList.set(r.elderly);
      this.selectedId.set(r.elderly[0]?.id ?? null);

      const ids = new Set(r.elderly.map((e) => e.id));
      const mine = r.monitorings
        .filter((m) => m.elderly && ids.has(m.elderly.id))
        .sort((a, b) => ((a.monitoringDate + (a.monitoringTime ?? '')) < (b.monitoringDate + (b.monitoringTime ?? '')) ? 1 : -1));
      this.rawMonitorings.set(mine);
      this.rawCalendars.set(r.calendars);

      const active = r.subs.find((s) => (s.status || '').toUpperCase() === 'ACTIVE');
      this.gPlan.set(active?.planType ?? null);
      this.gNextCharge.set(active?.expiryDate ?? null);

      this.loading.set(false);
    });
  }

  private flattenUpcoming(entries: CalendarEntry[], today: string): UpcomingEvent[] {
    const out: UpcomingEvent[] = [];
    for (const c of entries) {
      if (c.appointmentDate) out.push({ type: 'cita', icon: 'event_available', accent: 'blue', label: 'Cita médica', date: c.appointmentDate, time: c.appointmentTime });
      if (c.medicineDate) out.push({ type: 'med', icon: 'medication', accent: 'violet', label: 'Medicación', date: c.medicineDate, time: c.medicineTime });
      if (c.therapyDate) out.push({ type: 'ter', icon: 'healing', accent: 'teal', label: 'Terapia', date: c.therapyDate, time: c.therapyTime });
    }
    return out
      .filter((e) => e.date >= today)
      .sort((a, b) => (a.date + (a.time ?? '') < b.date + (b.time ?? '') ? -1 : 1));
  }

  // ── Carga ADMIN / NURSE (tarjetas de stats) ──
  private loadStats(): void {
    const role = this.user()?.role;
    const today = new Date().toISOString().slice(0, 10);
    const start = '2024-01-01';

    if (role === 'ADMIN') {
      forkJoin({
        users: this.api.getUsers().pipe(catchError(() => of([]))),
        centers: this.api.getHealthCenters().pipe(catchError(() => of([]))),
        registered: this.api.countUsersRegistered(start, today).pipe(catchError(() => of({ count: 0 }))),
        subs: this.api.countActiveSubscriptions().pipe(catchError(() => of({ count: 0 }))),
      }).subscribe((r) => {
        this.stats.set([
          { label: 'Usuarios totales', value: r.users.length, icon: 'group', accent: 'blue' },
          { label: 'Centros de salud', value: r.centers.length, icon: 'local_hospital', accent: 'teal' },
          { label: 'Suscripciones activas', value: r.subs.count, icon: 'workspace_premium', accent: 'green' },
          { label: 'Usuarios registrados', value: r.registered.count, icon: 'how_to_reg', accent: 'violet' },
        ]);
        this.loading.set(false);
      });
      return;
    }

    forkJoin({
      elderly: this.api.getElderly().pipe(catchError(() => of([]))),
      centers: this.api.getHealthCenters().pipe(catchError(() => of([]))),
    }).subscribe((r) => {
      this.stats.set([
        { label: 'Adultos mayores', value: r.elderly.length, icon: 'elderly', accent: 'blue' },
        { label: 'Centros de salud', value: r.centers.length, icon: 'local_hospital', accent: 'teal' },
      ]);
      this.loading.set(false);
    });
  }
}
