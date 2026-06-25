import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-placeholder',
  imports: [],
  template: `
    <div class="ph">
      <span class="ph-icon material-symbols-rounded">{{ data().icon }}</span>
      <h1>{{ data().title }}</h1>
      <p>Esta sección está en construcción. Pronto podrás gestionarla aquí.</p>
      <span class="ph-tag">Próximamente</span>
    </div>
  `,
  styles: [
    `
      .ph {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.6rem;
        padding: 4rem 1.5rem;
        background: var(--surface);
        border: 1px dashed var(--line);
        border-radius: var(--radius);
      }
      .ph-icon {
        display: grid;
        place-items: center;
        width: 84px;
        height: 84px;
        border-radius: 24px;
        background: var(--blue-100);
        color: var(--blue-700);
        font-size: 44px;
        margin-bottom: 0.5rem;
      }
      .ph h1 { font-size: 1.5rem; }
      .ph p { margin: 0; color: var(--muted); max-width: 420px; }
      .ph-tag {
        margin-top: 0.8rem;
        padding: 0.35rem 0.9rem;
        border-radius: 999px;
        background: var(--blue-50);
        color: var(--blue-700);
        font-size: 0.78rem;
        font-weight: 700;
      }
    `,
  ],
})
export default class Placeholder {
  private readonly route = inject(ActivatedRoute);

  readonly data = toSignal(
    this.route.data.pipe(
      map((d) => ({ title: (d['title'] as string) ?? 'Sección', icon: (d['icon'] as string) ?? 'construction' })),
    ),
    { initialValue: { title: 'Sección', icon: 'construction' } },
  );
}
