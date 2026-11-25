import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnInit,
  SimpleChanges,
  signal,
  OnChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmModalComponent } from '@shared/components/confirm-modal/confirm-modal.component';
import type { Match, Team, Tournament } from '../../../../data/database.types';
import { MatchService } from '../../../../core/services/match.service';
import { TeamService } from '../../../../core/services/team.service';
import { TournamentTeamService } from '../../../../core/services/tournament-team.service';
import type { MatchWithTeams } from '../../../../data/repositories/match.repository';
import { TournamentStore } from '../../../../state/tournament.store';
import { GeneratePhaseButtonComponent } from '../generate-phase-button/generate-phase-button.component';

type DetailTab = 'teams' | 'matches';

type DeleteTarget = { kind: 'team'; team: Team } | { kind: 'match'; match: MatchWithTeams };

@Component({
  selector: 'app-tournament-detail',
  imports: [RouterLink, FormsModule, GeneratePhaseButtonComponent, ConfirmModalComponent],
  templateUrl: './tournament-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentDetailComponent implements OnInit, OnChanges {
  @Input() id!: string;

  protected readonly store = inject(TournamentStore);
  private readonly teamService = inject(TeamService);
  private readonly tournamentTeamService = inject(TournamentTeamService);
  private readonly matchService = inject(MatchService);

  // ─── Tabs ────────────────────────────────────────────────────
  readonly tabs: { key: DetailTab; label: string }[] = [
    { key: 'teams', label: 'Equipos' },
    { key: 'matches', label: 'Partidos' },
  ];

  // ─── UI State ───────────────────────────────────────────────
  readonly activeTab = signal<DetailTab>('teams');
  readonly isLoadingDetail = signal(true);
  readonly isLoadingTab = signal(false);
  readonly tabError = signal<string | null>(null);
  readonly deleteTarget = signal<DeleteTarget | null>(null);

  // ─── Teams (roster del torneo) ─────────────────────────────
  readonly teams = signal<Team[]>([]);
  readonly showTeamForm = signal(false);
  readonly editingTeam = signal<Team | null>(null);
  readonly teamErrors = signal<Record<string, string>>({});
  teamName = '';
  teamShortName = '';
  teamLogoUrl = '';

  // ─── Agregar equipo: buscar existente (global) o crear nuevo ──
  readonly showAddTeam = signal(false);
  readonly allTeams = signal<Team[]>([]);
  readonly isLoadingAllTeams = signal(false);
  readonly teamSearch = signal('');
  readonly showNewTeamForm = signal(false);

  get filteredExistingTeams(): Team[] {
    const q = this.teamSearch().trim().toLowerCase();
    const rosterIds = new Set(this.teams().map((t) => t.id));
    const pool = this.allTeams().filter((t) => !rosterIds.has(t.id));
    if (!q) return pool.slice(0, 8);
    return pool.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 8);
  }

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
    this.loadDetail(this.id);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['id'] && !changes['id'].firstChange) {
      this.loadDetail(this.id);
    }
  }

  private loadDetail(id: string): void {
    this.isLoadingDetail.set(true);
    this.store.loadOne(id).finally(() => this.isLoadingDetail.set(false));
    this.loadTab('teams');
  }

  // ─── Tab ────────────────────────────────────────────────────

  async setTab(tab: DetailTab): Promise<void> {
    this.activeTab.set(tab);
    this.tabError.set(null);
    this.showTeamForm.set(false);
    this.closeAddTeam();
    this.showMatchForm.set(false);
    this.resultMatchId.set(null);
    await this.loadTab(tab);
  }

  private async loadTab(tab: DetailTab): Promise<void> {
    this.isLoadingTab.set(true);
    this.tabError.set(null);
    try {
      if (tab === 'teams') {
        this.teams.set(await this.tournamentTeamService.getByTournament(this.id));
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
      draft: 'bg-gray-800 text-gray-300 border-gray-700',
      active: 'bg-green-900 text-green-300 border-green-800',
      closed: 'bg-red-900 text-red-300 border-red-800',
    }[status];
  }

  matchStatusLabel(status: Match['status']): string {
    return { scheduled: 'Programado', in_progress: 'En curso', finished: 'Finalizado' }[status];
  }

  matchStatusClass(status: Match['status']): string {
    return {
      scheduled: 'bg-blue-900 text-blue-300 border-blue-800',
      in_progress: 'bg-yellow-900 text-yellow-300 border-yellow-800',
      finished: 'bg-gray-800 text-gray-300 border-gray-700',
    }[status];
  }

  toDatetimeLocal(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatDatetime(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ─── Editar equipo (global) ────────────────────────────────

  openTeamForm(team: Team): void {
    this.editingTeam.set(team);
    this.teamName = team.name;
    this.teamShortName = team.short_name ?? '';
    this.teamLogoUrl = team.logo_url ?? '';
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

    const editing = this.editingTeam();
    if (!editing) return;

    try {
      const updated = {
        name: this.teamName.trim(),
        short_name: this.teamShortName || undefined,
        logo_url: this.teamLogoUrl || undefined,
      };
      await this.teamService.update(editing.id, updated);
      this.teams.set(
        this.teams().map((t) =>
          t.id === editing.id
            ? {
                ...t,
                name: updated.name,
                short_name: updated.short_name ?? null,
                logo_url: updated.logo_url ?? null,
              }
            : t,
        ),
      );
      this.cancelTeamForm();
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  /** Quita el equipo del roster de este torneo — no lo borra globalmente
   *  (sigue existiendo para otros torneos y sus partidos pasados). */
  deleteTeam(team: Team): void {
    this.deleteTarget.set({ kind: 'team', team });
  }

  // ─── Agregar equipo: buscar existente o crear nuevo ─────────

  async openAddTeam(): Promise<void> {
    this.showAddTeam.set(true);
    this.showNewTeamForm.set(false);
    this.teamSearch.set('');
    if (this.allTeams().length === 0) {
      this.isLoadingAllTeams.set(true);
      try {
        this.allTeams.set(await this.teamService.getAll());
      } catch (e: unknown) {
        this.tabError.set(e instanceof Error ? e.message : 'Error al cargar equipos');
      } finally {
        this.isLoadingAllTeams.set(false);
      }
    }
  }

  closeAddTeam(): void {
    this.showAddTeam.set(false);
    this.showNewTeamForm.set(false);
    this.teamSearch.set('');
    this.teamErrors.set({});
  }

  async selectExistingTeam(team: Team): Promise<void> {
    try {
      await this.tournamentTeamService.add(this.id, team.id);
      this.teams.set([...this.teams(), team].sort((a, b) => a.name.localeCompare(b.name)));
      this.closeAddTeam();
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al agregar equipo');
    }
  }

  openNewTeamForm(): void {
    this.showNewTeamForm.set(true);
    this.teamName = this.teamSearch();
    this.teamShortName = '';
    this.teamLogoUrl = '';
    this.teamErrors.set({});
  }

  async submitNewTeamForm(): Promise<void> {
    const errors: Record<string, string> = {};
    if (!this.teamName.trim()) errors['name'] = 'El nombre es requerido';
    if (this.teamShortName && this.teamShortName.length > 5)
      errors['short_name'] = 'Máximo 5 caracteres';
    if (Object.keys(errors).length) {
      this.teamErrors.set(errors);
      return;
    }

    try {
      const created = await this.teamService.create({
        name: this.teamName.trim(),
        short_name: this.teamShortName || undefined,
        logo_url: this.teamLogoUrl || undefined,
      });
      await this.tournamentTeamService.add(this.id, created.id);
      this.teams.set([...this.teams(), created].sort((a, b) => a.name.localeCompare(b.name)));
      this.allTeams.set([...this.allTeams(), created]);
      this.closeAddTeam();
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al crear el equipo');
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
    // Cada partido se puede modificar hasta el minuto anterior en que empieza.
    const matchDateTime = new Date(this.matchDate);
    const deadlineDateTime = new Date(matchDateTime.getTime() - 60 * 1000);
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
        const updated = {
          home_team_id: this.matchHomeTeamId,
          away_team_id: this.matchAwayTeamId,
          match_date: this.matchDate,
          prediction_deadline: this.matchDeadline,
          round: this.matchRound,
        };
        await this.matchService.update(editing.id, updated);
        const homeTeam =
          this.teams().find((t) => t.id === this.matchHomeTeamId) ?? editing.home_team;
        const awayTeam =
          this.teams().find((t) => t.id === this.matchAwayTeamId) ?? editing.away_team;
        this.matches.set(
          this.matches().map((m) =>
            m.id === editing.id
              ? { ...m, ...updated, home_team: homeTeam, away_team: awayTeam }
              : m,
          ),
        );
      } else {
        await this.matchService.create({
          tournament_id: this.id,
          home_team_id: this.matchHomeTeamId,
          away_team_id: this.matchAwayTeamId,
          match_date: this.matchDate,
          prediction_deadline: this.matchDeadline,
          round: this.matchRound,
        });
        this.matches.set(await this.matchService.getByTournament(this.id));
      }
      this.cancelMatchForm();
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
      this.matches.set(
        this.matches().map((m) =>
          m.id === matchId
            ? {
                ...m,
                home_score: this.resultHome,
                away_score: this.resultAway,
                status: 'finished' as const,
              }
            : m,
        ),
      );
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al cargar resultado');
    }
  }

  deleteMatch(match: MatchWithTeams): void {
    this.deleteTarget.set({ kind: 'match', match });
  }

  // ─── Modal de borrado (equipo o partido) ───────────────────────

  get deleteModalMessage(): string {
    const target = this.deleteTarget();
    if (!target) return '';
    if (target.kind === 'team')
      return `¿Quitar a "${target.team.name}" de este torneo? El equipo sigue existiendo para otros torneos y sus partidos ya jugados.`;
    const home = target.match.home_team?.short_name ?? target.match.home_team?.name ?? '?';
    const away = target.match.away_team?.short_name ?? target.match.away_team?.name ?? '?';
    return `¿Eliminar el partido ${home} vs ${away}?`;
  }

  get deleteModalConfirmLabel(): string {
    return this.deleteTarget()?.kind === 'team' ? 'Quitar del torneo' : 'Eliminar';
  }

  closeDeleteModal(): void {
    this.deleteTarget.set(null);
  }

  async confirmDeleteTarget(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    this.closeDeleteModal();
    try {
      if (target.kind === 'team') {
        await this.tournamentTeamService.remove(this.id, target.team.id);
        this.teams.set(this.teams().filter((t) => t.id !== target.team.id));
      } else {
        await this.matchService.remove(target.match.id);
        this.matches.set(this.matches().filter((m) => m.id !== target.match.id));
      }
    } catch (e: unknown) {
      this.tabError.set(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }
}
