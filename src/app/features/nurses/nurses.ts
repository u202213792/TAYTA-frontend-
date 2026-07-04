import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaytaApi } from '../../core/services/tayta-api.service';
import { Elderly, Nurse, NurseElderly } from '../../core/models/domain.models';
import { extractError } from '../../core/utils/http-error';

interface NurseCard {
  nurse: Nurse;
  assigned: { assignmentId: number; elderly: Elderly | null }[];
  available: Elderly[];
  count: number;
  full: boolean;
}

@Component({
  selector: 'app-nurses',
  imports: [FormsModule],
  templateUrl: './nurses.html',
  styleUrl: './nurses.scss',
})
export default class Nurses {
  private readonly api = inject(TaytaApi);

  readonly MAX = 4;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly nurses = signal<Nurse[]>([]);
  readonly elderly = signal<Elderly[]>([]);
  readonly assignments = signal<NurseElderly[]>([]);

  // Estado por enfermero: adulto seleccionado en el desplegable, error y "ocupado"
  readonly selected = signal<Record<number, number>>({});
  readonly assignError = signal<Record<number, string>>({});
  readonly busy = signal<number | null>(null);

  readonly cards = computed<NurseCard[]>(() => {
    const links = this.assignments();
    const all = this.elderly();
    return this.nurses().map((nurse) => {
      const mine = links.filter((l) => l.nurse?.id === nurse.id);
      const assignedIds = new Set(mine.map((l) => l.elderly?.id));
      return {
        nurse,
        assigned: mine.map((l) => ({ assignmentId: l.id, elderly: l.elderly })),
        available: all.filter((e) => !assignedIds.has(e.id)),
        count: mine.length,
        full: mine.length >= this.MAX,
      };
    });
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.getNurses().subscribe({
      next: (n) => {
        this.nurses.set(n);
        this.api.getElderly().subscribe((e) => this.elderly.set(e));
        this.reloadAssignments(() => this.loading.set(false));
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private reloadAssignments(done?: () => void): void {
    this.api.getNurseElderly().subscribe({
      next: (a) => {
        this.assignments.set(a);
        done?.();
      },
      error: () => {
        this.error.set(true);
        done?.();
      },
    });
  }

  nurseName(n: Nurse): string {
    return n.user?.username ?? `Enfermero #${n.id}`;
  }

  elderlyName(e: Elderly | null): string {
    if (!e) return '—';
    return e.name?.trim() || e.user?.username || `DNI ${e.dni}`;
  }

  setSelected(nurseId: number, elderlyId: number): void {
    this.selected.update((s) => ({ ...s, [nurseId]: elderlyId }));
  }

  assign(nurseId: number): void {
    const elderlyId = Number(this.selected()[nurseId]);
    if (!elderlyId || this.busy() !== null) return;

    this.busy.set(nurseId);
    this.assignError.update((e) => ({ ...e, [nurseId]: '' }));

    this.api.assignNurseElderly(nurseId, elderlyId).subscribe({
      next: () => {
        this.selected.update((s) => ({ ...s, [nurseId]: 0 }));
        this.reloadAssignments(() => this.busy.set(null));
      },
      error: (err) => {
        this.assignError.update((e) => ({
          ...e,
          [nurseId]: extractError(err, 'No se pudo asignar.'),
        }));
        this.busy.set(null);
      },
    });
  }

  unassign(assignmentId: number): void {
    if (this.busy() !== null) return;
    this.busy.set(assignmentId);
    this.api.unassignNurseElderly(assignmentId).subscribe({
      next: () => this.reloadAssignments(() => this.busy.set(null)),
      error: () => this.busy.set(null),
    });
  }
}
