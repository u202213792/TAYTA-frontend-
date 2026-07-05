import { Component, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

/** Botón que alterna el idioma de la app (ES ⇄ EN). Reutilizable en navbar/topbar. */
@Component({
  selector: 'app-lang-toggle',
  standalone: true,
  template: `
    <button
      class="lang-toggle"
      type="button"
      (click)="lang.toggle()"
      [title]="lang.current() === 'es' ? 'Switch to English' : 'Cambiar a español'">
      <span class="material-symbols-rounded">language</span>
      <span>{{ lang.current() === 'es' ? 'EN' : 'ES' }}</span>
    </button>
  `,
  styles: [`
    .lang-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.4rem 0.7rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-family: inherit;
      font-weight: 700;
      font-size: 0.8rem;
      line-height: 1;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .lang-toggle:hover { background: rgba(0, 0, 0, 0.06); }
    .lang-toggle .material-symbols-rounded { font-size: 18px; }
  `],
})
export class LangToggle {
  readonly lang = inject(LanguageService);
}
