import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { Role, UserRow } from '../../core/models/domain.models';
import { extractError } from '../../core/utils/http-error';

@Component({
  selector: 'app-users-list',
  imports: [FormsModule],
  templateUrl: './users-list.html',
  styleUrl: './users-list.scss',
})
export default class UsersList {
  private readonly api = inject(TaytaApi);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<UserRow[]>([]);
  readonly roles = signal<Role[]>([]);

  // Filtro por rol
  readonly roleFilter = signal<string>('all');
  readonly filtered = computed(() => {
    const f = this.roleFilter();
    return f === 'all' ? this.items() : this.items().filter((u) => u.role?.roleName === f);
  });

  // Modal de edición
  readonly editing = signal<UserRow | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  form = { email: '', roleId: 0, enabled: true };

  // Confirmar borrado
  readonly toDelete = signal<UserRow | null>(null);
  readonly deleting = signal(false);

  constructor() {
    this.load();
    this.api.getRoles().subscribe((r) => this.roles.set(r));
  }

  private load(): void {
    this.api.getUsers().subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  roleClass(role: string | undefined): string {
    return `badge--${(role ?? '').toLowerCase()}`;
  }

  openEdit(u: UserRow): void {
    this.editing.set(u);
    this.form = { email: u.email, roleId: u.role?.id ?? 0, enabled: u.enabled };
    this.formError.set(null);
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  save(): void {
    const u = this.editing();
    if (!u || this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);

    // El backend conserva la contraseña existente (ya no se expone ni se reenvía).
    const payload = {
      id: u.id,
      username: u.username,
      email: this.form.email,
      enabled: this.form.enabled,
      createdAt: u.createdAt,
      role: { id: Number(this.form.roleId) },
    };

    this.api.updateUser(u.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractError(err, 'No se pudo guardar. Inténtalo de nuevo.'));
      },
    });
  }

  remove(): void {
    const u = this.toDelete();
    if (!u || this.deleting()) return;
    this.deleting.set(true);
    this.api.deleteUser(u.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toDelete.set(null);
        this.load();
      },
      error: () => this.deleting.set(false),
    });
  }
}
