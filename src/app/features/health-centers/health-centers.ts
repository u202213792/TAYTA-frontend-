import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { AuthService } from '../../core/services/auth.service';
import { HealthCenter, HealthCenterPayload } from '../../core/models/domain.models';
import { extractError } from '../../core/utils/http-error';

@Component({
  selector: 'app-health-centers',
  imports: [FormsModule],
  templateUrl: './health-centers.html',
  styleUrl: './health-centers.scss',
})
export default class HealthCenters {
  private readonly api = inject(TaytaApi);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<HealthCenter[]>([]);

  readonly canManage = computed(() => this.auth.user()?.role === 'ADMIN');

  // Modal de crear/editar
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  private editingId: number | null = null;
  form = this.blankForm();

  // Confirmación de borrado
  readonly toDelete = signal<HealthCenter | null>(null);
  readonly deleting = signal(false);

  constructor() {
    this.load();
  }

  private blankForm() {
    return {
      centerName: '',
      address: '',
      emergencyPhone: '',
      rating: null as number | null,
      latitude: null as number | null,
      longitude: null as number | null,
    };
  }

  private load(): void {
    this.api.getHealthCenters().subscribe({
      next: (data) => {
        this.items.set([...data].sort((a, b) => Number(b.rating) - Number(a.rating)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  openNew(): void {
    this.editingId = null;
    this.form = this.blankForm();
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  openEdit(c: HealthCenter, ev: Event): void {
    ev.stopPropagation();
    this.editingId = c.id;
    this.form = {
      centerName: c.centerName ?? '',
      address: c.address ?? '',
      emergencyPhone: c.emergencyPhone ?? '',
      rating: c.rating ?? null,
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
    };
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  get modalTitle(): string {
    return this.editingId == null ? 'Nuevo centro de salud' : 'Editar centro de salud';
  }

  save(): void {
    if (this.saving()) return;
    if (!this.form.centerName.trim()) {
      this.formError.set('El nombre es obligatorio.');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);

    const payload: HealthCenterPayload = {
      centerName: this.form.centerName.trim(),
      address: this.form.address,
      emergencyPhone: this.form.emergencyPhone,
      rating: this.form.rating != null ? Number(this.form.rating) : null,
      latitude: this.form.latitude != null ? Number(this.form.latitude) : null,
      longitude: this.form.longitude != null ? Number(this.form.longitude) : null,
    };

    const req =
      this.editingId == null
        ? this.api.createHealthCenter(payload)
        : this.api.updateHealthCenter(this.editingId, payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractError(err, 'No se pudo guardar. Inténtalo de nuevo.'));
      },
    });
  }

  askDelete(c: HealthCenter, ev: Event): void {
    ev.stopPropagation();
    this.toDelete.set(c);
  }

  remove(): void {
    const c = this.toDelete();
    if (!c || this.deleting()) return;
    this.deleting.set(true);
    this.api.deleteHealthCenter(c.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toDelete.set(null);
        this.load();
      },
      error: () => {
        this.deleting.set(false);
      },
    });
  }
}
