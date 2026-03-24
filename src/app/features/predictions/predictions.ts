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

import { ButtonComponent } from '../../shared/components/button/button';
import { FormFieldComponent } from '../../shared/components/form-field/form-field';

@Component({
  selector: 'app-predictions',
  standalone: true,
  imports: [CommonModule, FormsModule, MatchCardComponent, ButtonComponent, FormFieldComponent],
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

    // Si hay torneos y no hay ninguno seleccionado, seleccionar el primero
    if (tours.length > 0 && !this.tournamentService.currentTournamentId()) {
      this.selectTournament(tours[0].id || '');
    }
  }

  selectTournament(id: string) {
    this.tournamentService.setCurrentTournament(id);
  }

  // Getter que utiliza el servicio centralizado para filtrar por jornada (24 partidos)
  get filteredMatches(): Match[] {
    return this.tournamentService.getMatchesByDay(this.matches(), this.activeTab());
  }

  /**
   * Carga los partidos y las predicciones existentes del usuario
   */
  async loadMatchesAndPredictions() {
    if (!this.userId) {
      console.warn("Predictions: userId no disponible.");
      return;
    }
    const tid = this.tournamentService.currentTournamentId();
    if (!tid) {
      console.warn("Predictions: tournamentId no disponible.");
      return;
    }

    this.loading.set(true);
    try {
      // 1. Cargar Partidos
      console.log(`Predictions: Cargando partidos para torneo ${tid}...`);
      const allMatches = await this.tournamentService.getMatches();
      console.log(`Predictions: ${allMatches.length} partidos cargados.`);

      // 2. Cargar Predicciones
      console.log(`Predictions: Cargando predicciones de usuario ${this.userId}...`);
      const userPredsArray = await this.tournamentService.getUserPredictions(this.userId);
      console.log(`Predictions: ${userPredsArray.length} predicciones cargadas.`);

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
    } catch (e: any) {
      console.error("Error al cargar predicciones (detallado):", e);
      if (e.code === 'permission-denied') {
         this.alertService.error('Acceso Denegado', 'No tienes permisos para ver estos datos. Verificá si tu empresa está aprobada.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Guarda o actualiza la predicción de un partido específico
   */
  async savePrediction(match: any) {
    if (this.isMatchClosed(match)) {
      this.alertService.error('Partido Cerrado', 'No puedes realizar pronósticos sobre partidos que ya terminaron o comenzaron.');
      return;
    }

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

  isMatchClosed(match: any): boolean {
    if (match.status === 'finished') return true;
    if (!match.matchDate) return false;
    
    const now = new Date();
    // Manejar tanto JS Date como Firestore Timestamp
    const mDate = match.matchDate?.toDate ? match.matchDate.toDate() : new Date(match.matchDate);
    return now > mDate;
  }
}
