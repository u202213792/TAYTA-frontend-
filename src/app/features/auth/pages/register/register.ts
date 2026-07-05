import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../../core/services/auth.service';
import { extractError } from '../../../../core/utils/http-error';
import { LangToggle } from '../../../../shared/lang-toggle/lang-toggle';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, TranslatePipe, LangToggle],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly intentSubscribe = computed(
    () => this.route.snapshot.queryParamMap.get('intent') === 'subscribe',
  );

  readonly form = { username: '', email: '', password: '', confirm: '' };

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  onRegister(): void {
    if (this.loading()) return;
    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Validación local de confirmación de contraseña
    if (this.form.password !== this.form.confirm) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }

    this.loading.set(true);
    this.auth
      .register({
        username: this.form.username.trim(),
        email: this.form.email.trim(),
        password: this.form.password,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.successMessage.set('Cuenta creada con éxito. Redirigiendo al login...');
          const extras = this.intentSubscribe() ? { queryParams: { intent: 'subscribe' } } : {};
          setTimeout(() => this.router.navigate(['/login'], extras), 1500);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(extractError(err, 'No se pudo completar el registro. Inténtalo de nuevo.'));
        },
      });
  }
}
