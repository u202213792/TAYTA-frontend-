import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { AuthService } from '../../core/services/auth.service';
import { Elderly, Monitoring } from '../../core/models/domain.models';
import { extractError } from '../../core/utils/http-error';

@Component({
  selector: 'app-monitoring',
  imports: [FormsModule],
  templateUrl: './monitoring.html',
  styleUrl: './monitoring.scss',
})
export default class MonitoringPage {
  private readonly api = inject(TaytaApi);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<Monitoring[]>([]);

  private readonly role = computed(() => this.auth.user()?.role ?? '');
  readonly isNurse = computed(() => this.role() === 'NURSE');
  readonly canManage = computed(() => ['NURSE', 'ADMIN'].includes(this.role()));

  // ── Filtro por adulto mayor ──
  readonly elderlyFilter = signal<number | 'all'>('all');
  readonly filterOptions = computed(() => {
    const map = new Map<number, string>();
    for (const m of this.items()) {
      if (m.elderly) {
        map.set(m.elderly.id, m.elderly.name || m.elderly.user?.username || ('DNI ' + m.elderly.dni));
      }
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  });
  readonly filtered = computed(() => {
    const f = this.elderlyFilter();
    return f === 'all' ? this.items() : this.items().filter((m) => m.elderly?.id === f);
  });

  // ── Gráficos ──
  readonly statusCounts = computed(() => {
    let normal = 0, alerta = 0, critico = 0;
    for (const m of this.filtered()) {
      const s = (m.vitalSignsStatus || '').toUpperCase();
      if (s.startsWith('NORMAL')) normal++;
      else if (s.startsWith('ALERTA')) alerta++;
      else if (s) critico++;
    }
    const total = normal + alerta + critico || 1;
    return {
      normal, alerta, critico, total,
      pNormal: Math.round((normal / total) * 100),
      pAlerta: Math.round((alerta / total) * 100),
      pCritico: Math.round((critico / total) * 100),
    };
  });

  private recent(filterFn: (m: Monitoring) => boolean) {
    return [...this.filtered()]
      .filter((m) => m.monitoringDate && filterFn(m))
      .sort((a, b) => (a.monitoringDate < b.monitoringDate ? -1 : 1))
      .slice(-8);
  }

  // Temperatura: escala fija 35–40 °C con banda de rango normal (36–37.5)
  readonly tempChart = computed(() => {
    const data = this.recent((m) => m.temperature != null);
    if (data.length < 2) return null;

    const W = 320, H = 110, pad = 14, MIN = 35, MAX = 40;
    const y = (t: number) => +(H - pad - ((t - MIN) / (MAX - MIN)) * (H - 2 * pad)).toFixed(1);
    const x = (i: number) => +(pad + (i * (W - 2 * pad)) / (data.length - 1)).toFixed(1);

    const pts = data.map((m, i) => ({ x: x(i), y: y(Number(m.temperature)), temp: m.temperature }));
    const bandTop = y(37.5);
    const bandBottom = y(36);
    return {
      pts,
      line: pts.map((p) => `${p.x},${p.y}`).join(' '),
      W, H, pad,
      bandTop, bandHeight: +(bandBottom - bandTop).toFixed(1),
    };
  });

  // Presión arterial: líneas sistólica/diastólica (escala 40–200)
  readonly bpChart = computed(() => {
    const data = this.recent((m) => !!m.bloodPressure && m.bloodPressure.includes('/'))
      .map((m) => {
        const [s, d] = m.bloodPressure.split('/').map((v) => parseInt(v.trim(), 10));
        return { sys: s, dia: d };
      })
      .filter((p) => !isNaN(p.sys) && !isNaN(p.dia));
    if (data.length < 2) return null;

    const W = 320, H = 110, pad = 14, MIN = 40, MAX = 200;
    const y = (v: number) => +(H - pad - ((v - MIN) / (MAX - MIN)) * (H - 2 * pad)).toFixed(1);
    const x = (i: number) => +(pad + (i * (W - 2 * pad)) / (data.length - 1)).toFixed(1);

    return {
      sys: data.map((p, i) => `${x(i)},${y(p.sys)}`).join(' '),
      dia: data.map((p, i) => `${x(i)},${y(p.dia)}`).join(' '),
      W, H,
      last: data[data.length - 1],
    };
  });

  // Adherencia a la medicación (AL DÍA vs PENDIENTE) — dona
  readonly medAdherence = computed(() => {
    let alDia = 0, pend = 0;
    for (const m of this.filtered()) {
      const s = (m.medicineStatus || '').toUpperCase();
      if (!s) continue;
      if (s.includes('DÍA') || s.includes('DIA')) alDia++;
      else pend++;
    }
    const total = alDia + pend;
    const pct = total ? Math.round((alDia / total) * 100) : 0;
    const circ = 2 * Math.PI * 42;
    return { alDia, pend, total, pct, dash: +((pct / 100) * circ).toFixed(1), circ: +circ.toFixed(1) };
  });

  // Monitoreos por mes (barras) — últimos 6 meses con datos
  readonly monthlyCounts = computed(() => {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const map = new Map<string, number>();
    for (const m of this.filtered()) {
      if (!m.monitoringDate) continue;
      const key = m.monitoringDate.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const keys = [...map.keys()].sort().slice(-6);
    const max = Math.max(1, ...keys.map((k) => map.get(k)!));
    return keys.map((k) => {
      const [yy, mm] = k.split('-');
      return { label: `${meses[+mm - 1]} ${yy.slice(2)}`, count: map.get(k)!, pct: Math.round((map.get(k)! / max) * 100) };
    });
  });

  // ── Formulario (crear/editar) ──
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly elderlyOptions = signal<Elderly[]>([]);
  private currentNurseId: number | null = null;
  private editingId: number | null = null;
  private editingNurseId: number | null = null;

  readonly vitalOptions = ['NORMAL', 'ALERTA', 'CRÍTICO'];
  readonly medicineOptions = ['AL DÍA', 'PENDIENTE'];

  form = this.blankForm();

  // ── Borrado ──
  readonly toDelete = signal<Monitoring | null>(null);
  readonly deleting = signal(false);

  constructor() {
    this.loadList();
    if (this.canManage()) this.loadFormData();
  }

  private blankForm() {
    const now = new Date();
    return {
      elderlyId: null as number | null,
      vitalSignsStatus: 'NORMAL',
      monitoringDate: now.toISOString().slice(0, 10),
      monitoringTime: now.toTimeString().slice(0, 5),
      temperature: 36.5,
      bloodPressure: '',
      medicineStatus: 'AL DÍA',
      observations: '',
    };
  }

  private loadList(): void {
    this.api.getMonitorings().subscribe({
      next: (data) => {
        this.items.set([...data].sort((a, b) => (a.monitoringDate < b.monitoringDate ? 1 : -1)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadFormData(): void {
    this.api.getElderly().subscribe((e) => this.elderlyOptions.set(e));
    const username = this.auth.user()?.username;
    this.api.getNurses().subscribe((nurses) => {
      const me = nurses.find((n) => n.user?.username === username);
      this.currentNurseId = me?.id ?? null;
    });
  }

  get formTitle(): string {
    return this.editingId == null ? 'Nuevo registro' : 'Editar registro';
  }

  openNew(): void {
    this.editingId = null;
    this.editingNurseId = null;
    this.form = this.blankForm();
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEdit(m: Monitoring): void {
    this.editingId = m.id;
    this.editingNurseId = m.nurse?.id ?? null;
    this.form = {
      elderlyId: m.elderly?.id ?? null,
      vitalSignsStatus: m.vitalSignsStatus || 'NORMAL',
      monitoringDate: m.monitoringDate || new Date().toISOString().slice(0, 10),
      monitoringTime: (m.monitoringTime || '09:00').slice(0, 5),
      temperature: m.temperature ?? 36.5,
      bloodPressure: m.bloodPressure || '',
      medicineStatus: m.medicineStatus || 'AL DÍA',
      observations: m.observations || '',
    };
    this.formError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  vitalClass(status: string): string {
    const s = (status || '').toUpperCase();
    if (s.startsWith('NORMAL')) return 'pill--ok';
    if (s.startsWith('ALERTA')) return 'pill--warn';
    return 'pill--danger';
  }

  submit(): void {
    if (this.saving()) return;
    if (!this.form.elderlyId) {
      this.formError.set('Selecciona un adulto mayor.');
      return;
    }
    const nurseId = this.editingId != null ? this.editingNurseId : this.currentNurseId;
    if (nurseId == null) {
      this.formError.set('No se pudo identificar el enfermero/a del registro.');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);

    const payload = {
      elderly: { id: this.form.elderlyId },
      nurse: { id: nurseId },
      vitalSignsStatus: this.form.vitalSignsStatus,
      monitoringDate: this.form.monitoringDate,
      monitoringTime: this.form.monitoringTime,
      temperature: Number(this.form.temperature),
      bloodPressure: this.form.bloodPressure,
      observations: this.form.observations,
      medicineStatus: this.form.medicineStatus,
    };

    const req =
      this.editingId == null
        ? this.api.createMonitoring(payload)
        : this.api.updateMonitoring(this.editingId, payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.loadList();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractError(err, 'No se pudo guardar el monitoreo. Inténtalo de nuevo.'));
      },
    });
  }

  remove(): void {
    const m = this.toDelete();
    if (!m || this.deleting()) return;
    this.deleting.set(true);
    this.api.deleteMonitoring(m.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toDelete.set(null);
        this.loadList();
      },
      error: () => this.deleting.set(false),
    });
  }
}
