import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { CalendarEntry, CalendarPayload, Elderly } from '../../core/models/domain.models';
import { extractError } from '../../core/utils/http-error';

type EventType = 'cita' | 'medicacion' | 'terapia' | 'vacuna';

interface AgendaEvent {
  type: EventType;
  date: string;
  time: string | null;
  detail: string | null;
  elderly: string;
  elderlyId: number | null;
}

const TYPE_META: Record<EventType, { label: string; icon: string; accent: string }> = {
  cita: { label: 'calendar.type.cita', icon: 'event_available', accent: 'blue' },
  medicacion: { label: 'calendar.type.medicacion', icon: 'medication', accent: 'violet' },
  terapia: { label: 'calendar.type.terapia', icon: 'healing', accent: 'teal' },
  vacuna: { label: 'calendar.type.vacuna', icon: 'vaccines', accent: 'green' },
};

@Component({
  selector: 'app-calendar',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export default class CalendarPage {
  private readonly api = inject(TaytaApi);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal(false);
  private readonly events = signal<AgendaEvent[]>([]);

  readonly isStaff = computed(() => ['NURSE', 'ADMIN'].includes(this.auth.user()?.role ?? ''));
  readonly filter = signal<EventType | 'todos'>('todos');
  private readonly today = new Date().toISOString().slice(0, 10);

  private readonly lang = inject(LanguageService);

  readonly filters: { key: EventType | 'todos'; label: string }[] = [
    { key: 'todos', label: 'calendar.filters.todos' },
    { key: 'cita', label: 'calendar.filters.cita' },
    { key: 'medicacion', label: 'calendar.filters.medicacion' },
    { key: 'terapia', label: 'calendar.filters.terapia' },
    { key: 'vacuna', label: 'calendar.filters.vacuna' },
  ];

  // Filtro por adulto mayor
  readonly elderlyFilter = signal<number | 'all'>('all');
  readonly filterOptions = computed(() => {
    const map = new Map<number, string>();
    for (const e of this.events()) {
      if (e.elderlyId != null) map.set(e.elderlyId, e.elderly);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  });

  readonly visibleEvents = computed(() => {
    const f = this.filter();
    const ef = this.elderlyFilter();
    return this.events().filter(
      (e) => (f === 'todos' || e.type === f) && (ef === 'all' || e.elderlyId === ef),
    );
  });

  // ── Formulario (NURSE/ADMIN) ──
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly elderlyOptions = signal<Elderly[]>([]);
  form = this.blankForm();

  constructor() {
    this.load();
    if (this.isStaff()) {
      this.api.getElderly().subscribe((e) => this.elderlyOptions.set(e));
    }
  }

  private blankForm() {
    return {
      elderlyId: null as number | null,
      appointmentDate: '',
      appointmentTime: '',
      medicineDate: '',
      medicineTime: '',
      therapyDate: '',
      therapyTime: '',
      vaccines: '',
    };
  }

  private load(): void {
    this.api.getCalendars().subscribe({
      next: (data) => {
        this.events.set(this.flatten(data));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private elderlyName(c: CalendarEntry): string {
    return c.elderly?.name || c.elderly?.user?.username || (c.elderly?.dni ? 'DNI ' + c.elderly.dni : 'General');
  }

  private flatten(entries: CalendarEntry[]): AgendaEvent[] {
    const out: AgendaEvent[] = [];
    for (const c of entries) {
      const who = this.elderlyName(c);
      const eid = c.elderly?.id ?? null;
      if (c.appointmentDate) out.push({ type: 'cita', date: c.appointmentDate, time: c.appointmentTime, detail: null, elderly: who, elderlyId: eid });
      if (c.medicineDate) out.push({ type: 'medicacion', date: c.medicineDate, time: c.medicineTime, detail: null, elderly: who, elderlyId: eid });
      if (c.therapyDate) out.push({ type: 'terapia', date: c.therapyDate, time: c.therapyTime, detail: null, elderly: who, elderlyId: eid });
      if (c.vaccines) {
        out.push({
          type: 'vacuna',
          date: c.therapyDate || c.appointmentDate || c.medicineDate || this.today,
          time: c.therapyTime,
          detail: c.vaccines,
          elderly: who,
          elderlyId: eid,
        });
      }
    }
    return out.sort((a, b) => (a.date + (a.time ?? '') < b.date + (b.time ?? '') ? -1 : 1));
  }

  meta(type: EventType) {
    return TYPE_META[type];
  }

  day(date: string): string {
    return String(new Date(date + 'T00:00:00').getDate()).padStart(2, '0');
  }

  month(date: string): string {
    const locale = this.lang.current() === 'en' ? 'en-US' : 'es-ES';
    return new Date(date + 'T00:00:00').toLocaleDateString(locale, { month: 'short' });
  }

  isUpcoming(date: string): boolean {
    return date >= this.today;
  }

  toggleForm(): void {
    this.formOpen.update((v) => !v);
    this.formError.set(null);
  }

  submit(): void {
    if (this.saving()) return;
    const f = this.form;
    if (!f.elderlyId) {
      this.formError.set('Selecciona el adulto mayor.');
      return;
    }
    if (!f.appointmentDate && !f.medicineDate && !f.therapyDate) {
      this.formError.set('Indica al menos una fecha (cita, medicación o terapia).');
      return;
    }

    const payload: CalendarPayload = { elderly: { id: f.elderlyId } };
    if (f.appointmentDate) { payload.appointmentDate = f.appointmentDate; payload.appointmentTime = f.appointmentTime || null; }
    if (f.medicineDate) { payload.medicineDate = f.medicineDate; payload.medicineTime = f.medicineTime || null; }
    if (f.therapyDate) { payload.therapyDate = f.therapyDate; payload.therapyTime = f.therapyTime || null; }
    if (f.vaccines) payload.vaccines = f.vaccines;

    this.formError.set(null);
    this.saving.set(true);
    this.api.createCalendar(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.form = this.blankForm();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractError(err, 'No se pudo guardar. Inténtalo de nuevo.'));
      },
    });
  }
}
