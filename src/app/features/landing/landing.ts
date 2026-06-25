import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export default class Landing {
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

  scrollTo(id: string, ev: Event): void {
    ev.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
