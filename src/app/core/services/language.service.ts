import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type Lang = 'es' | 'en';

/** Maneja el idioma de la app (ES/EN), lo aplica y lo recuerda. */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly current = signal<Lang>('es');

  /** Inicializa el idioma desde lo guardado (o español por defecto). */
  init(): void {
    this.translate.addLangs(['es', 'en']);
    let saved: Lang = 'es';
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'en') saved = 'en';
    } catch {
      /* SSR / sin localStorage */
    }
    this.set(saved);
  }

  toggle(): void {
    this.set(this.current() === 'es' ? 'en' : 'es');
  }

  set(lang: Lang): void {
    this.translate.use(lang);
    this.current.set(lang);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('lang', lang);
      if (typeof document !== 'undefined') document.documentElement.lang = lang;
    } catch {
      /* noop */
    }
  }
}
