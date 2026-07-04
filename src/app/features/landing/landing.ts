import { AfterViewInit, Component, ElementRef, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export default class Landing implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;
  private counterObs?: IntersectionObserver;

  readonly year = new Date().getFullYear();

  readonly services = [
    { icon: 'monitor_heart', title: 'Monitoreo de signos vitales', text: 'Registro de temperatura, presión y estado de salud por personal de enfermería.' },
    { icon: 'calendar_month', title: 'Calendario de salud', text: 'Citas médicas, medicación, terapias y vacunas organizadas por adulto mayor.' },
    { icon: 'local_hospital', title: 'Centros de salud', text: 'Directorio de centros médicos cercanos con calificación y contacto de emergencia.' },
    { icon: 'family_restroom', title: 'Acompañamiento familiar', text: 'El apoderado sigue de cerca el bienestar de su adulto mayor desde un solo lugar.' },
  ];

  readonly vitalSteps = [
    { n: '1', icon: 'assignment', title: 'Registro del control', text: 'La enfermera técnica registra cada visita con fecha y hora.' },
    { n: '2', icon: 'thermostat', title: 'Signos vitales', text: 'Temperatura, presión arterial y estado de medicación.' },
    { n: '3', icon: 'trending_up', title: 'Seguimiento', text: 'El historial se visualiza en gráficos para ver la evolución.' },
    { n: '4', icon: 'notifications_active', title: 'Alertas', text: 'Estados Normal, Alerta o Crítico para actuar a tiempo.' },
  ];

  ngAfterViewInit(): void {
    // Forzar la reproducción del video del hero (algunos navegadores no arrancan
    // el autoplay solos, sobre todo con archivos grandes).
    const video = this.host.nativeElement.querySelector('video.hero-bg') as HTMLVideoElement | null;
    if (video) {
      video.muted = true;
      const tryPlay = () => video.play().catch(() => {});
      tryPlay();
      video.addEventListener('canplay', tryPlay, { once: true });
    }

    if (typeof IntersectionObserver === 'undefined') return;
    // El modo animado se activa en el .landing interno (no en el host, por la
    // encapsulación de Angular: el CSS scopeado no alcanza al elemento host).
    const root = this.host.nativeElement.querySelector('.landing') ?? this.host.nativeElement;
    root.classList.add('js-reveal');
    const targets = root.querySelectorAll('.reveal');
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    targets.forEach((el) => this.observer!.observe(el));

    // Contadores que animan de 0 al valor al entrar en pantalla
    const counters = root.querySelectorAll<HTMLElement>('.count');
    this.counterObs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.animateCount(entry.target as HTMLElement);
            this.counterObs?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.4 },
    );
    counters.forEach((c) => this.counterObs!.observe(c));
  }

  private animateCount(el: HTMLElement): void {
    const to = Number(el.dataset['to'] ?? '0');
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out
      el.textContent = Math.round(to * eased).toLocaleString('es-PE');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.counterObs?.disconnect();
  }

  scrollTo(id: string, ev: Event): void {
    ev.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
