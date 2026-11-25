import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal } from '@angular/core';
import { ConfirmModalComponent } from '@shared/components/confirm-modal/confirm-modal.component';
import type { PhaseStatus } from '../../../../data/database.types';
import { TournamentService } from '../../../../core/services/tournament.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-generate-phase-button',
  imports: [ConfirmModalComponent],
  templateUrl: './generate-phase-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneratePhaseButtonComponent implements OnInit {
  @Input({ required: true }) tournamentId!: string;

  private readonly tournamentService = inject(TournamentService);
  private readonly toastService = inject(ToastService);

  readonly status = signal<PhaseStatus | null>(null);
  readonly isLoading = signal(false);
  readonly isGenerating = signal(false);
  readonly showConfirmModal = signal(false);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.status.set(await this.tournamentService.getPhaseStatus(this.tournamentId));
    } catch {
      // No bloquear la UI si el estado no se puede calcular
    } finally {
      this.isLoading.set(false);
    }
  }

  get canGenerate(): boolean {
    const s = this.status();
    return !!s && s.currentPhaseComplete && !!s.nextPhase;
  }

  get nextPhaseLabel(): string {
    return this.status()?.nextPhase ?? '';
  }

  openConfirmModal(): void {
    const s = this.status();
    if (!s?.nextPhase || !s.currentPhaseComplete) return;
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
  }

  async generate(): Promise<void> {
    const s = this.status();
    this.closeConfirmModal();
    if (!s?.nextPhase || !s.currentPhaseComplete) return;

    const label = s.nextPhase;
    this.isGenerating.set(true);
    try {
      const result = await this.tournamentService.generateNextPhase(this.tournamentId, label);
      this.toastService.success(
        `${result.resolved} partido(s) de ${label} actualizados correctamente`,
      );
      await this.refresh();
    } catch (e: unknown) {
      this.toastService.error(e instanceof Error ? e.message : 'Error al calcular fase');
    } finally {
      this.isGenerating.set(false);
    }
  }
}
