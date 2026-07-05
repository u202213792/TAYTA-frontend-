import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './core/services/language.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('TAYTA');

  constructor() {
    // Aplica el idioma guardado (ES por defecto) al iniciar la app.
    inject(LanguageService).init();
  }
}
