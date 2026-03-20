import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { db } from '../../core/firebase/firebase';
import { collection, getDocs, setDoc, doc, orderBy, query, Timestamp } from 'firebase/firestore';

import { TournamentService } from '../../core/services/tournament';
import { AuthService } from '../../core/services/auth';
import { AlertService } from '../../core/services/alert';
import { MatchCardComponent } from '../../shared/components/match-card/match-card';
import { Match, Prediction, Tournament } from '../../core/models/models';

@Component({
  selector: 'app-predictions',
  standalone: true,
  imports: [CommonModule, FormsModule, MatchCardComponent],
  templateUrl: './predictions.html'
})
export class PredictionsComponent {
  public tournamentService = inject(TournamentService);
  private authService = inject(AuthService);
  private alertService = inject(AlertService);

  // Estado
  matches = signal<Match[]>([]);
  tournaments = signal<Tournament[]>([]);
  loading = signal(false);
  activeTab = signal<number>(1);
  
  get userId() {
    return this.authService.user()?.uid;
  }

  get companyId() {
    return this.authService.user()?.companyId;
  }

  constructor() {
    this.loadTournaments();
    
    // Recargar partidos cuando cambie el torneo actual
    effect(() => {
      const tid = this.tournamentService.currentTournamentId();
      if (tid) this.loadMatchesAndPredictions();
    });
  }

  async loadTournaments() {
    const user = this.authService.user();
    if (!user) return;
    const tours = await this.tournamentService.getAvailableTournaments(user.role, user.companyId);
    this.tournaments.set(tours);
  }

  selectTournament(id: string) {
    this.tournamentService.setCurrentTournament(id);
  }

  // Getter que utiliza el servicio centralizado para filtrar por jornada (24 partidos)
  get filteredMatches() {
    return this.tournamentService.getMatchesByDay(this.matches(), this.activeTab());
  }

  /**
   * Carga los partidos y las predicciones existentes del usuario
   */
  async loadMatchesAndPredictions() {
    if (!this.userId) return;
    this.loading.set(true);
    try {
      // 1. Cargar Partidos desde el nuevo path
      const allMatches = await this.tournamentService.getMatches();

      // 2. Cargar Predicciones del usuario (desde la colección global o vía service)
      const userPredsArray = await this.tournamentService.getUserPredictions(this.userId);
      const userPredsMap = userPredsArray.reduce((acc: any, p: Prediction) => {
        acc[p.matchId] = p;
        return acc;
      }, {});

      // 3. Unir datos
      const merged = allMatches.map((m: any) => ({
        ...m,
        userHomePrediction: userPredsMap[m.id]?.homeScore ?? null,
        userAwayPrediction: userPredsMap[m.id]?.awayScore ?? null
      }));

      this.matches.set(merged);
    } catch (e) {
      console.error("Error al cargar predicciones:", e);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Guarda o actualiza la predicción de un partido específico
   */
  async savePrediction(match: any) {
    if (match.userHomePrediction === null || match.userAwayPrediction === null) {
      this.alertService.error('Marcador incompleto', 'Ingresa ambos marcadores antes de guardar tu pronóstico.');
      return;
    }

    if (!this.userId || !this.companyId) {
      this.alertService.error('Sesión inválida', 'Error: Usuario no identificado o sin empresa asignada');
      return;
    }

    try {
      await this.tournamentService.savePrediction(match.id, {
        userId: this.userId,
        companyId: this.companyId,
        homeScore: Number(match.userHomePrediction),
        awayScore: Number(match.userAwayPrediction)
      });

      this.alertService.success('🏆 ¡Pronóstico Guardado!', 'Mucha suerte con este resultado.');
    } catch (e) {
      console.error("Error al guardar predicción:", e);
      this.alertService.error('Error al guardar', 'Hubo un problema técnico al procesar tu predicción.');
    }
  }
}