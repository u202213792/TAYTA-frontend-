import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ChartConfiguration, Plugin } from 'chart.js';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { AuthService } from '../../core/services/auth.service';
import { Elderly, Monitoring } from '../../core/models/domain.models';
import { extractError } from '../../core/utils/http-error';
import { ChartComponent } from '../../shared/chart/chart';

// Paleta (teal + estados) para los gráficos
const C = {
  teal: '#0d9488',
  tealSoft: 'rgba(13,148,136,0.14)',
  ok: '#0d9488',
  warn: '#d97706',
  danger: '#dc2626',
  grid: 'rgba(15,23,42,0.06)',
  track: '#e7e5e0',
  ink: '#475569',
};

@Component({
  selector: 'app-monitoring',
  imports: [FormsModule, ChartComponent, TranslatePipe],
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

  // ── Gráficos (Chart.js) ──
  // Datos numéricos (para textos) + configuraciones de gráfico.

  readonly statusCounts = computed(() => {
    let normal = 0, alerta = 0, critico = 0;
    for (const m of this.filtered()) {
      const s = (m.vitalSignsStatus || '').toUpperCase();
      if (s.startsWith('NORMAL')) normal++;
      else if (s.startsWith('ALERTA')) alerta++;
      else if (s) critico++;
    }
    return { normal, alerta, critico, total: normal + alerta + critico };
  });

  readonly medAdherence = computed(() => {
    let alDia = 0, pend = 0;
    for (const m of this.filtered()) {
      const s = (m.medicineStatus || '').toUpperCase();
      if (!s) continue;
      if (s.includes('DÍA') || s.includes('DIA')) alDia++;
      else pend++;
    }
    const total = alDia + pend;
    return { alDia, pend, total, pct: total ? Math.round((alDia / total) * 100) : 0 };
  });

  private monthlyData = computed(() => {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const map = new Map<string, number>();
    for (const m of this.filtered()) {
      if (!m.monitoringDate) continue;
      const key = m.monitoringDate.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.keys()].sort().slice(-6).map((k) => {
      const [yy, mm] = k.split('-');
      return { label: `${meses[+mm - 1]} ${yy.slice(2)}`, count: map.get(k)! };
    });
  });

  private recent(filterFn: (m: Monitoring) => boolean) {
    return [...this.filtered()]
      .filter((m) => m.monitoringDate && filterFn(m))
      .sort((a, b) => (a.monitoringDate < b.monitoringDate ? -1 : 1))
      .slice(-8);
  }

  // Banda verde del rango normal de temperatura (36–37.5 °C)
  private readonly tempBand: Plugin = {
    id: 'tempBand',
    beforeDatasetsDraw(chart) {
      const y = chart.scales['y'];
      if (!y) return;
      const { ctx, chartArea } = chart;
      const top = y.getPixelForValue(37.5);
      const bottom = y.getPixelForValue(36);
      ctx.save();
      ctx.fillStyle = 'rgba(22,163,74,0.10)';
      ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, bottom - top);
      ctx.restore();
    },
  };

  private axes(yMin?: number, yMax?: number): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        y: { min: yMin, max: yMax, ticks: { color: C.ink }, grid: { color: C.grid }, beginAtZero: yMin == null },
        x: { ticks: { color: C.ink }, grid: { display: false } },
      },
    };
  }

  private readonly donutLegend = {
    display: true, position: 'bottom' as const,
    labels: { usePointStyle: true, boxWidth: 8, padding: 14, color: C.ink },
  };

  // Temperatura (línea + banda normal)
  readonly tempCfg = computed<ChartConfiguration | null>(() => {
    const data = this.recent((m) => m.temperature != null);
    if (data.length < 2) return null;
    return {
      type: 'line',
      data: {
        labels: data.map((m) => m.monitoringDate!.slice(5)),
        datasets: [{
          label: 'Temp. °C',
          data: data.map((m) => Number(m.temperature)),
          borderColor: C.teal, backgroundColor: C.tealSoft, fill: true, tension: 0.35,
          borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6,
          pointBackgroundColor: '#fff', pointBorderColor: C.teal, pointBorderWidth: 2,
        }],
      },
      options: { ...this.axes(35, 40), plugins: { legend: { display: false } } },
      plugins: [this.tempBand],
    };
  });

  // Presión arterial (sistólica + diastólica)
  readonly bpCfg = computed<ChartConfiguration | null>(() => {
    const parsed = this.recent((m) => !!m.bloodPressure && m.bloodPressure.includes('/'))
      .map((m) => {
        const [s, d] = m.bloodPressure.split('/').map((v) => parseInt(v.trim(), 10));
        return { date: m.monitoringDate!.slice(5), sys: s, dia: d };
      })
      .filter((p) => !isNaN(p.sys) && !isNaN(p.dia));
    if (parsed.length < 2) return null;
    return {
      type: 'line',
      data: {
        labels: parsed.map((p) => p.date),
        datasets: [
          { label: 'Sistólica', data: parsed.map((p) => p.sys), borderColor: C.danger, backgroundColor: C.danger, tension: 0.35, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6 },
          { label: 'Diastólica', data: parsed.map((p) => p.dia), borderColor: C.teal, backgroundColor: C.teal, tension: 0.35, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6 },
        ],
      },
      options: { ...this.axes(40, 200), plugins: { legend: this.donutLegend } },
    };
  });

  // Estado de signos vitales (dona)
  readonly statusCfg = computed<ChartConfiguration>(() => {
    const s = this.statusCounts();
    return {
      type: 'doughnut',
      data: {
        labels: ['Normal', 'Alerta', 'Crítico'],
        datasets: [{ data: [s.normal, s.alerta, s.critico], backgroundColor: [C.ok, C.warn, C.danger], borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: this.donutLegend } },
    };
  });

  // Adherencia a la medicación (dona)
  readonly medCfg = computed<ChartConfiguration>(() => {
    const m = this.medAdherence();
    return {
      type: 'doughnut',
      data: {
        labels: ['Al día', 'Pendiente'],
        datasets: [{ data: [m.alDia, m.pend], backgroundColor: [C.teal, C.track], borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: this.donutLegend } },
    };
  });

  // Monitoreos por mes (barras)
  readonly monthlyCfg = computed<ChartConfiguration>(() => {
    const rows = this.monthlyData();
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.label),
        datasets: [{ label: 'Monitoreos', data: rows.map((r) => r.count), backgroundColor: C.teal, borderRadius: 6, maxBarThickness: 46 }],
      },
      options: { ...this.axes(), plugins: { legend: { display: false } } },
    };
  });

  readonly hasMonthly = computed(() => this.monthlyData().length > 0);

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
    return this.editingId == null ? 'monitoring.formNew' : 'monitoring.formEdit';
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
