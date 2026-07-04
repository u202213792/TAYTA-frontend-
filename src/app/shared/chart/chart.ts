import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

/** Envoltorio reutilizable de Chart.js. Se le pasa la config y se re-renderiza al cambiar. */
@Component({
  selector: 'app-chart',
  standalone: true,
  template: '<canvas #cv></canvas>',
  styles: [':host{display:block;position:relative;width:100%;height:100%}canvas{width:100%!important}'],
})
export class ChartComponent implements AfterViewInit, OnDestroy {
  readonly config = input.required<ChartConfiguration>();
  private readonly cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private chart?: Chart;
  private viewReady = false;

  constructor() {
    // Re-renderiza cuando cambia la config (p. ej. al filtrar por adulto mayor).
    effect(() => {
      const cfg = this.config();
      if (this.viewReady) this.render(cfg);
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render(this.config());
  }

  private render(cfg: ChartConfiguration): void {
    this.chart?.destroy();
    this.chart = new Chart(this.cv().nativeElement, cfg);
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
