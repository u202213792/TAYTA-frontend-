import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CalendarEntry,
  CalendarPayload,
  CountResult,
  Elderly,
  ElderlyPayload,
  HealthCenter,
  HealthCenterPayload,
  Monitoring,
  MonitoringPayload,
  Nurse,
  Payment,
  Subscription,
  SubscribePayload,
  UserRow,
} from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class TaytaApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  // ── Lectura general (todos los roles) ──
  getElderly(): Observable<Elderly[]> {
    return this.http.get<Elderly[]>(`${this.base}/elderly`);
  }

  getElderlyById(id: number): Observable<Elderly> {
    return this.http.get<Elderly>(`${this.base}/elderly/${id}`);
  }

  createElderly(payload: ElderlyPayload): Observable<Elderly> {
    return this.http.post<Elderly>(`${this.base}/elderly`, payload);
  }

  updateElderly(id: number, payload: ElderlyPayload): Observable<Elderly> {
    return this.http.put<Elderly>(`${this.base}/elderly/${id}`, payload);
  }

  deleteElderly(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/elderly/${id}`);
  }

  getHealthCenters(): Observable<HealthCenter[]> {
    return this.http.get<HealthCenter[]>(`${this.base}/health-centers`);
  }

  createHealthCenter(payload: HealthCenterPayload): Observable<HealthCenter> {
    return this.http.post<HealthCenter>(`${this.base}/health-centers`, payload);
  }

  updateHealthCenter(id: number, payload: HealthCenterPayload): Observable<HealthCenter> {
    return this.http.put<HealthCenter>(`${this.base}/health-centers/${id}`, payload);
  }

  deleteHealthCenter(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/health-centers/${id}`);
  }

  getMonitorings(): Observable<Monitoring[]> {
    return this.http.get<Monitoring[]>(`${this.base}/monitoring`);
  }

  getNurses(): Observable<Nurse[]> {
    return this.http.get<Nurse[]>(`${this.base}/nurses`);
  }

  getCalendars(): Observable<CalendarEntry[]> {
    return this.http.get<CalendarEntry[]>(`${this.base}/calendars`);
  }

  getSubscriptions(): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${this.base}/subscriptions`);
  }

  getPayments(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.base}/payments`);
  }

  subscribe(payload: SubscribePayload): Observable<Subscription> {
    return this.http.post<Subscription>(`${this.base}/subscriptions/subscribe`, payload);
  }

  // ── Escritura (NURSE/ADMIN) ──
  createMonitoring(payload: MonitoringPayload): Observable<Monitoring> {
    return this.http.post<Monitoring>(`${this.base}/monitoring`, payload);
  }

  updateMonitoring(id: number, payload: MonitoringPayload): Observable<Monitoring> {
    return this.http.put<Monitoring>(`${this.base}/monitoring/${id}`, payload);
  }

  deleteMonitoring(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/monitoring/${id}`);
  }

  createCalendar(payload: CalendarPayload): Observable<CalendarEntry> {
    return this.http.post<CalendarEntry>(`${this.base}/calendars`, payload);
  }

  // ── Solo ADMIN ──
  getUsers(): Observable<UserRow[]> {
    return this.http.get<UserRow[]>(`${this.base}/users`);
  }

  updateUser(id: number, payload: unknown): Observable<UserRow> {
    return this.http.put<UserRow>(`${this.base}/users/${id}`, payload);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${id}`);
  }

  getRoles(): Observable<{ id: number; roleName: string }[]> {
    return this.http.get<{ id: number; roleName: string }[]>(`${this.base}/roles`);
  }

  // ── Consultas de estadísticas (solo ADMIN) ──
  countUsersRegistered(startDate: string, endDate: string): Observable<CountResult> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<CountResult>(`${this.base}/queries/users-registered`, { params });
  }

  countActiveSubscriptions(): Observable<CountResult> {
    return this.http.get<CountResult>(`${this.base}/queries/active-subscriptions`);
  }

  countMonitorings(startDate: string, endDate: string): Observable<CountResult> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<CountResult>(`${this.base}/queries/monitoring-count`, { params });
  }
}
