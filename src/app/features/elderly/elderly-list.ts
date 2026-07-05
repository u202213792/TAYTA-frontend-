import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { AuthService } from '../../core/services/auth.service';
import { Elderly } from '../../core/models/domain.models';

@Component({
  selector: 'app-elderly-list',
  imports: [TranslatePipe],
  templateUrl: './elderly-list.html',
  styleUrl: './elderly-list.scss',
})
export default class ElderlyList {
  private readonly api = inject(TaytaApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<Elderly[]>([]);

  readonly canCreate = computed(() => ['ADMIN', 'GUARDIAN'].includes(this.auth.user()?.role ?? ''));

  constructor() {
    this.api.getElderly().subscribe({
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

  open(id: number): void {
    this.router.navigate(['/app/elderly', id]);
  }

  create(): void {
    this.router.navigate(['/app/elderly/new']);
  }
}
