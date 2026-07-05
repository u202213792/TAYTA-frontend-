import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { TranslatePipe } from '@ngx-translate/core';
import { CalendarEntry, Elderly, Monitoring, NurseElderly } from '../../core/models/domain.models';

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
  labelKey: string;
  detail: string;
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
  imports: [RouterLink, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export default class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly api = inject(TaytaApi);

  readonly user = this.auth.user;
  readonly loading = signal(true);
  readonly isGuardian = computed(() => this.user()?.role === 'GUARDIAN');
  readonly isNurse = computed(() => this.user()?.role === 'NURSE');
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

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
        labelKey: 'dashboard.act.monitoring',
        detail: `(${m.vitalSignsStatus || 's/d'})` + (m.nurse?.user?.username ? ` · ${m.nurse.user.username}` : ''),
        time: `${m.monitoringDate}${m.monitoringTime ? ' · ' + m.monitoringTime.slice(0, 5) : ''}`,
      }));
  });

  readonly gUpcoming = computed<UpcomingEvent[]>(() => {
    const id = this.selectedElderly()?.id;
    if (id == null) return [];
    const mine = this.rawCalendars().filter((c) => c.elderly?.id === id);
    return this.flattenUpcoming(mine, this.today).slice(0, 3);
  });

  private statusOf(m: Monitoring | null) {
    const s = (m?.vitalSignsStatus || '').toUpperCase();
    if (s.startsWith('NORMAL')) return { label: 'dashboard.status.ok', cls: 'ok' };
    if (s.startsWith('ALERTA')) return { label: 'dashboard.status.warn', cls: 'warn' };
    if (s) return { label: 'dashboard.status.danger', cls: 'danger' };
    return { label: 'dashboard.status.none', cls: 'muted' };
  }

  readonly gStatus = computed(() => this.statusOf(this.gLatest()));

  readonly greeting = computed(() => {
    const role = this.user()?.role;
    if (role === 'ADMIN') return 'dashboard.greeting.admin';
    if (role === 'NURSE') return 'dashboard.greeting.nurse';
    return 'dashboard.greeting.guardian';
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
    if (role === 'ADMIN') return 'dashboard.hero.admin';
    if (role === 'NURSE') return 'dashboard.hero.nurse';
    return 'dashboard.hero.guardian';
  });

  readonly quickActions = computed<QuickAction[]>(() => {
    const role = this.user()?.role;
    if (role === 'ADMIN') {
      return [
        { label: 'dashboard.qa.users', description: 'dashboard.qa.usersDesc', icon: 'group', path: '/app/users' },
        { label: 'dashboard.qa.nurses', description: 'dashboard.qa.nursesDesc', icon: 'medical_services', path: '/app/nurses' },
        { label: 'dashboard.qa.subs', description: 'dashboard.qa.subsDesc', icon: 'workspace_premium', path: '/app/subscription' },
        { label: 'dashboard.qa.centers', description: 'dashboard.qa.centersDesc', icon: 'local_hospital', path: '/app/health-centers' },
      ];
    }
    if (role === 'NURSE') {
      return [
        { label: 'dashboard.qa.monitoring', description: 'dashboard.qa.monitoringDesc', icon: 'monitor_heart', path: '/app/monitoring' },
        { label: 'dashboard.qa.calendar', description: 'dashboard.qa.calendarDesc', icon: 'calendar_month', path: '/app/calendar' },
        { label: 'dashboard.qa.patients', description: 'dashboard.qa.patientsDesc', icon: 'elderly', path: '/app/elderly' },
      ];
    }
    return [];
  });

  // ── ENFERMERO: sus adultos asignados + sus monitoreos ──
  readonly nAssigned = signal<Elderly[]>([]);
  private readonly nMon = signal<Monitoring[]>([]);

  private nLatestFor(id: number): Monitoring | null {
    return this.nMon().find((m) => m.elderly?.id === id) ?? null; // nMon viene ordenado desc
  }

  readonly nElderlyCards = computed(() =>
    this.nAssigned().map((e) => {
      const latest = this.nLatestFor(e.id);
      return { elderly: e, latest, status: this.statusOf(latest) };
    }),
  );

  readonly nStats = computed(() => {
    const month = this.today.slice(0, 7);
    const monThisMonth = this.nMon().filter((m) => (m.monitoringDate || '').startsWith(month)).length;
    const alerts = this.nElderlyCards().filter((c) => c.status.cls === 'warn' || c.status.cls === 'danger').length;
    return { count: this.nAssigned().length, monThisMonth, alerts };
  });

  readonly nActivity = computed<ActivityItem[]>(() =>
    this.nMon().slice(0, 5).map((m) => ({
      icon: 'monitor_heart',
      accent: 'blue',
      labelKey: '',
      detail: `${m.elderly?.name || ''} · ${m.vitalSignsStatus || 's/d'}`,
      time: `${m.monitoringDate}${m.monitoringTime ? ' · ' + m.monitoringTime.slice(0, 5) : ''}`,
    })),
  );

  // ── ADMIN: métricas de gestión + alertas + distribución de roles ──
  readonly aStats = signal<StatCard[]>([]);
  readonly aRoles = signal<{ role: string; count: number }[]>([]);
  readonly aAlerts = signal<Monitoring[]>([]);

  constructor() {
    if (this.isGuardian()) this.loadGuardian();
    else if (this.isNurse()) this.loadNurse();
    else this.loadAdmin();
  }

  private loadNurse(): void {
    forkJoin({
      mine: this.api.getMyNurseElderly().pipe(catchError(() => of([] as NurseElderly[]))),
      mons: this.api.getMonitorings().pipe(catchError(() => of([] as Monitoring[]))),
    }).subscribe((r) => {
      this.nAssigned.set(r.mine.map((x) => x.elderly).filter((e): e is Elderly => !!e));
      this.nMon.set(
        [...r.mons].sort((a, b) =>
          (a.monitoringDate + (a.monitoringTime ?? '')) < (b.monitoringDate + (b.monitoringTime ?? '')) ? 1 : -1,
        ),
      );
      this.loading.set(false);
    });
  }

  private loadAdmin(): void {
    const today = this.today;
    forkJoin({
      users: this.api.getUsers().pipe(catchError(() => of([]))),
      nurses: this.api.getNurses().pipe(catchError(() => of([]))),
      elderly: this.api.getElderly().pipe(catchError(() => of([]))),
      subs: this.api.countActiveSubscriptions().pipe(catchError(() => of({ count: 0 }))),
      mons: this.api.getMonitorings().pipe(catchError(() => of([] as Monitoring[]))),
    }).subscribe((r) => {
      this.aStats.set([
        { label: 'dashboard.admin.totalUsers', value: r.users.length, icon: 'group', accent: 'blue' },
        { label: 'dashboard.admin.nurses', value: r.nurses.length, icon: 'medical_services', accent: 'violet' },
        { label: 'dashboard.admin.elderly', value: r.elderly.length, icon: 'elderly', accent: 'teal' },
        { label: 'dashboard.admin.activeSubs', value: r.subs.count, icon: 'workspace_premium', accent: 'green' },
      ]);

      const roleMap = new Map<string, number>();
      for (const u of r.users) {
        const role = u.role?.roleName || '—';
        roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
      }
      this.aRoles.set([...roleMap.entries()].map(([role, count]) => ({ role, count })));

      this.aAlerts.set(
        [...r.mons]
          .filter((m) => {
            const s = (m.vitalSignsStatus || '').toUpperCase();
            return s && !s.startsWith('NORMAL');
          })
          .sort((a, b) => (a.monitoringDate < b.monitoringDate ? 1 : -1))
          .slice(0, 6),
      );

      this.loading.set(false);
    });
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
      if (c.appointmentDate) out.push({ type: 'cita', icon: 'event_available', accent: 'blue', label: 'dashboard.event.appointment', date: c.appointmentDate, time: c.appointmentTime });
      if (c.medicineDate) out.push({ type: 'med', icon: 'medication', accent: 'violet', label: 'dashboard.event.medication', date: c.medicineDate, time: c.medicineTime });
      if (c.therapyDate) out.push({ type: 'ter', icon: 'healing', accent: 'teal', label: 'dashboard.event.therapy', date: c.therapyDate, time: c.therapyTime });
    }
    return out
      .filter((e) => e.date >= today)
      .sort((a, b) => (a.date + (a.time ?? '') < b.date + (b.time ?? '') ? -1 : 1));
  }
}
