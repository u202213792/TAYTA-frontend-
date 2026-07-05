import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../../core/services/auth.service';
import { extractError } from '../../../../core/utils/http-error';
import { LangToggle } from '../../../../shared/lang-toggle/lang-toggle';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, TranslatePipe, LangToggle],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export default class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Intención de compra (viene de la landing con ?intent=subscribe)
  readonly intentSubscribe = computed(
    () => this.route.snapshot.queryParamMap.get('intent') === 'subscribe',
  );

  readonly usuario = { username: '', password: '' };
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly slowHint = signal(false);
  private slowTimer: ReturnType<typeof setTimeout> | null = null;

  onLogin(): void {
    if (this.loading()) return;
    this.errorMessage.set(null);
    this.slowHint.set(false);
    this.loading.set(true);
    this.slowTimer = setTimeout(() => this.slowHint.set(true), 4000);

    const credentials = {
      username: this.usuario.username.trim(),
      password: this.usuario.password,
    };

    this.auth.login(credentials).subscribe({
      next: () => {
        this.clearTimer();
        this.loading.set(false);
        // Intención de compra → directo a planes; si no, al dashboard.
        const dest = this.intentSubscribe() ? '/app/subscription' : '/app/dashboard';
        this.router.navigate([dest]);
      },
      error: (err) => {
        this.clearTimer();
        this.loading.set(false);
        this.slowHint.set(false);
        this.errorMessage.set(
          err?.status === 401 || err?.status === 403
            ? 'Usuario o contraseña incorrectos.'
            : extractError(err, 'No se pudo conectar con el servidor. Inténtalo de nuevo.'),
        );
      },
    });
  }

  private clearTimer(): void {
    if (this.slowTimer) {
      clearTimeout(this.slowTimer);
      this.slowTimer = null;
    }
  }
}
