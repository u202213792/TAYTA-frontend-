import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { AuthService } from '../../core/services/auth.service';
import { CalendarEntry, Elderly, ElderlyPayload, Monitoring } from '../../core/models/domain.models';
import type { MonitoringPayload, CalendarPayload } from '../../core/models/domain.models';
import { extractError } from '../../core/utils/http-error';

interface ProfileEvent {
  label: string;
  icon: string;
  date: string;
  time: string | null;
  detail: string | null;
}

@Component({
  selector: 'app-elderly-detail',
  imports: [FormsModule],
  templateUrl: './elderly-detail.html',
  styleUrl: './elderly-detail.scss',
})
export default class ElderlyDetail {
  private readonly api = inject(TaytaApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly isNew = this.id === null;

  readonly loading = signal(!this.isNew);
  readonly notFound = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly editing = signal(this.isNew);
  readonly errorMsg = signal<string | null>(null);
  readonly confirmDelete = signal(false);
  readonly showLimit = signal(false);
  readonly limitMsg = signal('');

  private model: Elderly | null = null;
  form = this.blankForm();

  // Perfil consolidado
  readonly monitorings = signal<Monitoring[]>([]);
  readonly events = signal<ProfileEvent[]>([]);

  // Registro contextual dentro de la ficha
  readonly isNurse = computed(() => this.auth.user()?.role === 'NURSE');
  readonly canCalendar = computed(() => ['NURSE', 'ADMIN'].includes(this.auth.user()?.role ?? ''));
  private currentNurseId: number | null = null;

  readonly vitalOptions = ['NORMAL', 'ALERTA', 'CRÍTICO'];
  readonly medicineOptions = ['AL DÍA', 'PENDIENTE'];

  readonly monOpen = signal(false);
  readonly monSaving = signal(false);
  readonly monError = signal<string | null>(null);
  monForm = this.blankMon();

  readonly calOpen = signal(false);
  readonly calSaving = signal(false);
  readonly calError = signal<string | null>(null);
  calForm = this.blankCal();

  private blankMon() {
    const now = new Date();
    return {
      vitalSignsStatus: 'NORMAL',
      monitoringDate: now.toISOString().slice(0, 10),
      monitoringTime: now.toTimeString().slice(0, 5),
      temperature: 36.5,
      bloodPressure: '',
      medicineStatus: 'AL DÍA',
      observations: '',
    };
  }

  private blankCal() {
    return {
      appointmentDate: '',
      appointmentTime: '',
      medicineDate: '',
      medicineTime: '',
      therapyDate: '',
      therapyTime: '',
      vaccines: '',
    };
  }

  readonly canEdit = computed(() => ['ADMIN', 'GUARDIAN'].includes(this.auth.user()?.role ?? ''));
  readonly canDelete = computed(() => this.auth.user()?.role === 'ADMIN');

  readonly title = computed(() => {
    if (this.isNew) return 'Nuevo adulto mayor';
    return this.model?.name || this.model?.user?.username || (this.model ? `DNI ${this.model.dni}` : 'Adulto mayor');
  });

  readonly bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  readonly genders = [
    { v: 'M', label: 'Masculino' },
    { v: 'F', label: 'Femenino' },
  ];

  constructor() {
    if (!this.isNew) {
      this.load();
      this.loadProfile();
    }
  }

  private loadProfile(): void {
    const eid = Number(this.id);
    const today = new Date().toISOString().slice(0, 10);

    // Resolver el perfil de enfermero/a actual (para registrar monitoreos)
    if (this.isNurse()) {
      const username = this.auth.user()?.username;
      this.api.getNurses().subscribe((nurses) => {
        this.currentNurseId = nurses.find((n) => n.user?.username === username)?.id ?? null;
      });
    }

    this.api.getMonitorings().subscribe((list) => {
      this.monitorings.set(
        list
          .filter((m) => m.elderly?.id === eid)
          .sort((a, b) => (a.monitoringDate < b.monitoringDate ? 1 : -1))
          .slice(0, 6),
      );
    });

    this.api.getCalendars().subscribe((list) => {
      const ev: ProfileEvent[] = [];
      for (const c of list.filter((c) => c.elderly?.id === eid)) {
        if (c.appointmentDate) ev.push({ label: 'Cita médica', icon: 'event_available', date: c.appointmentDate, time: c.appointmentTime, detail: null });
        if (c.medicineDate) ev.push({ label: 'Medicación', icon: 'medication', date: c.medicineDate, time: c.medicineTime, detail: null });
        if (c.therapyDate) ev.push({ label: 'Terapia', icon: 'healing', date: c.therapyDate, time: c.therapyTime, detail: null });
        if (c.vaccines) ev.push({ label: 'Vacuna', icon: 'vaccines', date: c.therapyDate || c.appointmentDate || today, time: null, detail: c.vaccines });
      }
      this.events.set(ev.filter((e) => e.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 5));
    });
  }

  vitalClass(status: string): string {
    const s = (status || '').toUpperCase();
    if (s.startsWith('NORMAL')) return 'pill--ok';
    if (s.startsWith('ALERTA')) return 'pill--warn';
    return 'pill--danger';
  }

  // ── Registrar monitoreo (NURSE) ──
  toggleMon(): void {
    this.monOpen.update((v) => !v);
    this.monError.set(null);
  }

  submitMon(): void {
    if (this.monSaving()) return;
    if (this.currentNurseId == null) {
      this.monError.set('No se pudo identificar tu perfil de enfermero/a.');
      return;
    }
    this.monSaving.set(true);
    this.monError.set(null);

    const payload: MonitoringPayload = {
      elderly: { id: Number(this.id) },
      nurse: { id: this.currentNurseId },
      vitalSignsStatus: this.monForm.vitalSignsStatus,
      monitoringDate: this.monForm.monitoringDate,
      monitoringTime: this.monForm.monitoringTime,
      temperature: Number(this.monForm.temperature),
      bloodPressure: this.monForm.bloodPressure,
      observations: this.monForm.observations,
      medicineStatus: this.monForm.medicineStatus,
    };

    this.api.createMonitoring(payload).subscribe({
      next: () => {
        this.monSaving.set(false);
        this.monOpen.set(false);
        this.monForm = this.blankMon();
        this.loadProfile();
      },
      error: (err) => {
        this.monSaving.set(false);
        this.monError.set(extractError(err, 'No se pudo guardar el monitoreo.'));
      },
    });
  }

  // ── Registrar evento de calendario (NURSE/ADMIN) ──
  toggleCal(): void {
    this.calOpen.update((v) => !v);
    this.calError.set(null);
  }

  submitCal(): void {
    if (this.calSaving()) return;
    const f = this.calForm;
    if (!f.appointmentDate && !f.medicineDate && !f.therapyDate) {
      this.calError.set('Indica al menos una fecha (cita, medicación o terapia).');
      return;
    }
    this.calSaving.set(true);
    this.calError.set(null);

    const payload: CalendarPayload = { elderly: { id: Number(this.id) } };
    if (f.appointmentDate) { payload.appointmentDate = f.appointmentDate; payload.appointmentTime = f.appointmentTime || null; }
    if (f.medicineDate) { payload.medicineDate = f.medicineDate; payload.medicineTime = f.medicineTime || null; }
    if (f.therapyDate) { payload.therapyDate = f.therapyDate; payload.therapyTime = f.therapyTime || null; }
    if (f.vaccines) payload.vaccines = f.vaccines;

    this.api.createCalendar(payload).subscribe({
      next: () => {
        this.calSaving.set(false);
        this.calOpen.set(false);
        this.calForm = this.blankCal();
        this.loadProfile();
      },
      error: (err) => {
        this.calSaving.set(false);
        this.calError.set(extractError(err, 'No se pudo guardar el evento.'));
      },
    });
  }

  private blankForm() {
    return {
      name: '',
      dni: '',
      bloodType: 'O+',
      gender: 'M',
      height: null as number | null,
      allergies: '',
      currentWeight: null as number | null,
      chronicDiseases: '',
      currentMedication: '',
      medicalObservations: '',
    };
  }

  private load(): void {
    this.api.getElderlyById(Number(this.id)).subscribe({
      next: (e) => {
        if (!e) {
          this.notFound.set(true);
          this.loading.set(false);
          return;
        }
        this.model = e;
        this.fillForm(e);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  private fillForm(e: Elderly): void {
    this.form = {
      name: e.name ?? '',
      dni: e.dni ?? '',
      bloodType: e.bloodType ?? 'O+',
      gender: e.gender ?? 'M',
      height: e.height ?? null,
      allergies: e.allergies ?? '',
      currentWeight: e.currentWeight ?? null,
      chronicDiseases: e.chronicDiseases ?? '',
      currentMedication: e.currentMedication ?? '',
      medicalObservations: e.medicalObservations ?? '',
    };
  }

  current(): Elderly | null {
    return this.model;
  }

  startEdit(): void {
    if (this.model) this.fillForm(this.model);
    this.editing.set(true);
    this.errorMsg.set(null);
  }

  cancelEdit(): void {
    if (this.isNew) {
      this.router.navigate(['/app/elderly']);
      return;
    }
    if (this.model) this.fillForm(this.model);
    this.editing.set(false);
    this.errorMsg.set(null);
  }

  save(): void {
    if (this.saving()) return;
    if (!this.form.name.trim()) {
      this.errorMsg.set('El nombre es obligatorio.');
      return;
    }
    if (!this.form.dni.trim()) {
      this.errorMsg.set('El DNI es obligatorio.');
      return;
    }
    if (!/^\d{8}$/.test(this.form.dni.trim())) {
      this.errorMsg.set('El DNI debe tener exactamente 8 dígitos.');
      return;
    }
    this.errorMsg.set(null);
    this.saving.set(true);

    const payload: ElderlyPayload = {
      name: this.form.name.trim(),
      dni: this.form.dni.trim(),
      bloodType: this.form.bloodType,
      gender: this.form.gender,
      height: this.form.height != null ? Number(this.form.height) : null,
      allergies: this.form.allergies,
      currentWeight: this.form.currentWeight != null ? Number(this.form.currentWeight) : null,
      chronicDiseases: this.form.chronicDiseases,
      currentMedication: this.form.currentMedication,
      medicalObservations: this.form.medicalObservations,
      // Conservar el vínculo con el usuario al editar (el update reemplaza todo)
      user: this.model?.user ? { id: this.model.user.id } : null,
    };

    const req = this.isNew
      ? this.api.createElderly(payload)
      : this.api.updateElderly(Number(this.id), payload);

    req.subscribe({
      next: (saved) => {
        this.saving.set(false);
        if (this.isNew) {
          this.router.navigate(['/app/elderly', saved.id]);
        } else {
          this.model = saved;
          this.editing.set(false);
        }
      },
      error: (err) => {
        this.saving.set(false);
        const msg = extractError(err, 'No se pudo guardar. Inténtalo de nuevo.');
        // Límite del plan o sin suscripción → invitar a mejorar el plan.
        if (err?.status === 400 && /plan|suscrip/i.test(msg)) {
          this.limitMsg.set(msg);
          this.showLimit.set(true);
        } else {
          this.errorMsg.set(msg);
        }
      },
    });
  }

  goToPlans(): void {
    this.showLimit.set(false);
    this.router.navigate(['/app/subscription']);
  }

  remove(): void {
    if (this.deleting() || this.isNew) return;
    this.deleting.set(true);
    this.api.deleteElderly(Number(this.id)).subscribe({
      next: () => this.router.navigate(['/app/elderly']),
      error: () => {
        this.deleting.set(false);
        this.errorMsg.set('No se pudo eliminar.');
      },
    });
  }

  back(): void {
    this.router.navigate(['/app/elderly']);
  }
}
