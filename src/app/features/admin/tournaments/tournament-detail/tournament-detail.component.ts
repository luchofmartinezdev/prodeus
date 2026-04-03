import { SlicePipe } from '@angular/common';
import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Match, Team, Tournament } from '../../../../data/database.types';
import { MatchService } from '../../../../core/services/match.service';
import { TeamService } from '../../../../core/services/team.service';
import type { MatchWithTeams } from '../../../../data/repositories/match.repository';
import { TournamentStore } from '../../../../state/tournament.store';
import { GeneratePhaseButtonComponent } from '../generate-phase-button/generate-phase-button.component';

type DetailTab = 'teams' | 'matches';

@Component({
  selector: 'app-tournament-detail',
  imports: [RouterLink, FormsModule, SlicePipe, GeneratePhaseButtonComponent],
  templateUrl: './tournament-detail.component.html',
})
export class TournamentDetailComponent implements OnInit {
  @Input() id!: string;

  protected readonly store = inject(TournamentStore);
  private readonly teamService = inject(TeamService);
  private readonly matchService = inject(MatchService);

  // ─── Tabs ────────────────────────────────────────────────────
  readonly tabs: { key: DetailTab; label: string }[] = [
    { key: 'teams', label: 'Equipos' },
    { key: 'matches', label: 'Partidos' },
  ];

  // ─── UI State ───────────────────────────────────────────────
  readonly activeTab = signal<DetailTab>('teams');
  readonly isLoadingTab = signal(false);
  readonly tabError = signal<string | null>(null);

  // ─── Teams ──────────────────────────────────────────────────
  readonly teams = signal<Team[]>([]);
  readonly showTeamForm = signal(false);
  readonly editingTeam = signal<Team | null>(null);
  readonly teamErrors = signal<Record<string, string>>({});
  teamName = '';
  teamShortName = '';
  teamLogoUrl = '';

  // ─── Matches ────────────────────────────────────────────────
  readonly matches = signal<MatchWithTeams[]>([]);
  readonly showMatchForm = signal(false);
  readonly editingMatch = signal<MatchWithTeams | null>(null);
  readonly resultMatchId = signal<string | null>(null);
  readonly matchErrors = signal<Record<string, string>>({});
  matchHomeTeamId = '';
  matchAwayTeamId = '';
  matchDate = '';
  matchDeadline = '';
  matchRound = '';
  resultHome = 0;
  resultAway = 0;

  ngOnInit(): void {
    this.store.loadOne(this.id);
    this.loadTab('teams');
  }

  // ─── Tab ────────────────────────────────────────────────────

  async setTab(tab: DetailTab): Promise<void> {
    this.activeTab.set(tab);
    this.tabError.set(null);
    this.showTeamForm.set(false);
    this.showMatchForm.set(false);
    this.resultMatchId.set(null);
    await this.loadTab(tab);
  }

  private async loadTab(tab: DetailTab): Promise<void> {
    this.isLoadingTab.set(true);
    this.tabError.set(null);
    try {
      if (tab === 'teams') {
        this.teams.set(await this.teamService.getByTournament(this.id));
      } else if (tab === 'matches') {
        this.matches.set(await this.matchService.getByTournament(this.id));
      }
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      this.isLoadingTab.set(false);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────

  statusLabel(status: Tournament['status']): string {
    return { draft: 'Borrador', active: 'Activo', closed: 'Cerrado' }[status];
  }

  statusClass(status: Tournament['status']): string {
    return {
      draft: 'bg-gray-700 text-gray-300',
      active: 'bg-green-900 text-green-300',
      closed: 'bg-red-900 text-red-300',
    }[status];
  }

  matchStatusLabel(status: Match['status']): string {
    return { scheduled: 'Programado', in_progress: 'En curso', finished: 'Finalizado' }[status];
  }

  matchStatusClass(status: Match['status']): string {
    return {
      scheduled: 'bg-blue-900 text-blue-300',
      in_progress: 'bg-yellow-900 text-yellow-300',
      finished: 'bg-gray-700 text-gray-400',
    }[status];
  }

  toDatetimeLocal(iso: string): string {
    return iso ? iso.slice(0, 16) : '';
  }

  formatDatetime(iso: string): string {
    return iso ? iso.slice(0, 16).replace('T', ' ') : '';
  }

  // ─── Teams CRUD ──────────────────────────────────────────────

  openTeamForm(team?: Team): void {
    this.editingTeam.set(team ?? null);
    this.teamName = team?.name ?? '';
    this.teamShortName = team?.short_name ?? '';
    this.teamLogoUrl = team?.logo_url ?? '';
    this.teamErrors.set({});
    this.showTeamForm.set(true);
  }

  cancelTeamForm(): void {
    this.showTeamForm.set(false);
    this.editingTeam.set(null);
    this.teamErrors.set({});
  }

  async submitTeamForm(): Promise<void> {
    const errors: Record<string, string> = {};
    if (!this.teamName.trim()) errors['name'] = 'El nombre es requerido';
    if (this.teamShortName && this.teamShortName.length > 5)
      errors['short_name'] = 'Máximo 5 caracteres';
    if (Object.keys(errors).length) {
      this.teamErrors.set(errors);
      return;
    }

    try {
      const editing = this.editingTeam();
      if (editing) {
        await this.teamService.update(editing.id, {
          name: this.teamName.trim(),
          short_name: this.teamShortName || undefined,
          logo_url: this.teamLogoUrl || undefined,
        });
      } else {
        await this.teamService.create({
          tournament_id: this.id,
          name: this.teamName.trim(),
          short_name: this.teamShortName || undefined,
          logo_url: this.teamLogoUrl || undefined,
        });
      }
      this.cancelTeamForm();
      this.teams.set(await this.teamService.getByTournament(this.id));
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  async deleteTeam(team: Team): Promise<void> {
    if (!confirm(`¿Eliminar equipo "${team.name}"?`)) return;
    try {
      await this.teamService.remove(team.id);
      this.teams.set(this.teams().filter((t) => t.id !== team.id));
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  // ─── Matches CRUD ─────────────────────────────────────────

  openMatchForm(match?: MatchWithTeams): void {
    this.editingMatch.set(match ?? null);
    this.matchHomeTeamId = match?.home_team_id ?? '';
    this.matchAwayTeamId = match?.away_team_id ?? '';
    // Bracket/placeholder matches cannot be edited via this form
    this.matchDate = match ? this.toDatetimeLocal(match.match_date) : '';
    this.matchDeadline = match ? this.toDatetimeLocal(match.prediction_deadline) : '';
    this.matchRound = match?.round ?? '';
    this.matchErrors.set({});
    this.showMatchForm.set(true);
  }

  onMatchDateChange(): void {
    if (!this.matchDate) {
      this.matchDeadline = '';
      return;
    }
    // Calculate deadline as 5 minutes before match_date
    const matchDateTime = new Date(this.matchDate);
    const deadlineDateTime = new Date(matchDateTime.getTime() - 5 * 60 * 1000);
    this.matchDeadline = this.toDatetimeLocal(deadlineDateTime.toISOString());
  }

  cancelMatchForm(): void {
    this.showMatchForm.set(false);
    this.editingMatch.set(null);
    this.matchErrors.set({});
  }

  async submitMatchForm(): Promise<void> {
    const errors: Record<string, string> = {};
    if (!this.matchHomeTeamId) errors['home'] = 'Seleccioná el local';
    if (!this.matchAwayTeamId) errors['away'] = 'Seleccioná el visitante';
    if (
      this.matchHomeTeamId &&
      this.matchAwayTeamId &&
      this.matchHomeTeamId === this.matchAwayTeamId
    )
      errors['away'] = 'Los equipos no pueden ser iguales';
    if (!this.matchDate) errors['date'] = 'Seleccioná la fecha';
    if (!this.matchDeadline) errors['deadline'] = 'Seleccioná el deadline';
    if (
      this.matchDate &&
      this.matchDeadline &&
      new Date(this.matchDeadline) >= new Date(this.matchDate)
    )
      errors['deadline'] = 'El deadline debe ser antes de la fecha del partido';
    if (Object.keys(errors).length) {
      this.matchErrors.set(errors);
      return;
    }

    try {
      const editing = this.editingMatch();
      if (editing) {
        await this.matchService.update(editing.id, {
          home_team_id: this.matchHomeTeamId,
          away_team_id: this.matchAwayTeamId,
          match_date: this.matchDate,
          prediction_deadline: this.matchDeadline,
          round: this.matchRound,
        });
      } else {
        await this.matchService.create({
          tournament_id: this.id,
          home_team_id: this.matchHomeTeamId,
          away_team_id: this.matchAwayTeamId,
          match_date: this.matchDate,
          prediction_deadline: this.matchDeadline,
          round: this.matchRound,
        });
      }
      this.cancelMatchForm();
      this.matches.set(await this.matchService.getByTournament(this.id));
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  openResultForm(matchId: string): void {
    this.resultMatchId.set(matchId);
    this.resultHome = 0;
    this.resultAway = 0;
  }

  async submitResult(matchId: string): Promise<void> {
    try {
      await this.matchService.loadResult(matchId, {
        home_score: this.resultHome,
        away_score: this.resultAway,
      });
      this.resultMatchId.set(null);
      this.matches.set(await this.matchService.getByTournament(this.id));
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al cargar resultado');
    }
  }

  async deleteMatch(match: MatchWithTeams): Promise<void> {
    const home = match.home_team?.short_name ?? match.home_team?.name ?? '?';
    const away = match.away_team?.short_name ?? match.away_team?.name ?? '?';
    if (!confirm(`¿Eliminar el partido ${home} vs ${away}?`)) return;
    try {
      await this.matchService.remove(match.id);
      this.matches.set(this.matches().filter((m) => m.id !== match.id));
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }
}
