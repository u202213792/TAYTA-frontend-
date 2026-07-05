import { AfterViewInit, Component, ElementRef, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LangToggle } from '../../shared/lang-toggle/lang-toggle';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, TranslatePipe, LangToggle],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export default class Landing implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;
  private counterObs?: IntersectionObserver;

  readonly year = new Date().getFullYear();

  readonly services = [
    { icon: 'monitor_heart', titleKey: 'landing.services.s1Title', textKey: 'landing.services.s1Text' },
    { icon: 'calendar_month', titleKey: 'landing.services.s2Title', textKey: 'landing.services.s2Text' },
    { icon: 'local_hospital', titleKey: 'landing.services.s3Title', textKey: 'landing.services.s3Text' },
    { icon: 'family_restroom', titleKey: 'landing.services.s4Title', textKey: 'landing.services.s4Text' },
  ];

  readonly vitalSteps = [
    { n: '1', icon: 'assignment', titleKey: 'landing.vitals.s1Title', textKey: 'landing.vitals.s1Text' },
    { n: '2', icon: 'thermostat', titleKey: 'landing.vitals.s2Title', textKey: 'landing.vitals.s2Text' },
    { n: '3', icon: 'trending_up', titleKey: 'landing.vitals.s3Title', textKey: 'landing.vitals.s3Text' },
    { n: '4', icon: 'notifications_active', titleKey: 'landing.vitals.s4Title', textKey: 'landing.vitals.s4Text' },
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
