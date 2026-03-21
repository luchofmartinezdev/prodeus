import { Component, inject, signal, OnInit, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { db } from '../../core/firebase/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { AuthService } from '../../core/services/auth';
import { CompanyService } from '../../core/services/company';
import { TournamentService } from '../../core/services/tournament';
import { LeaderboardEntry, Tournament } from '../../core/models/models';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leaderboard.html'
})
export class LeaderboardComponent implements OnInit {
  public auth = inject(AuthService);
  public tournamentService = inject(TournamentService);
  private companyService = inject(CompanyService);

  activeTab = signal<'general' | 'matchday'>('general');
  selectedMatchday = signal<number>(1);
  leaderboard = signal<LeaderboardEntry[]>([]);
  tournaments = signal<Tournament[]>([]);
  companyName = signal<string>('Mi Empresa');
  isLoading = signal(true);

  // Derivados para UI organizada
  podium = computed(() => this.leaderboard().slice(0, 3));
  remainingPlayers = computed(() => this.leaderboard().slice(3));


  constructor() {
    this.loadTournaments();
    
    // Recargar ranking cuando cambie el torneo, la pestaña o la fecha seleccionada
    effect(() => {
      const tid = this.tournamentService.currentTournamentId();
      const tab = this.activeTab();
      const day = this.selectedMatchday();
      
      if (tid) {
        if (tab === 'general') {
          this.loadLeaderboard();
        } else {
          this.loadMatchdayLeaderboard();
        }
      }
    });
  }

  async loadTournaments() {
    const user = this.auth.user();
    if (!user) return;
    const tours = await this.tournamentService.getAvailableTournaments(user.role, user.companyId);
    this.tournaments.set(tours);
  }

  selectTournament(id: string) {
    this.tournamentService.setCurrentTournament(id);
  }

  setTab(tab: 'general' | 'matchday') {
    this.activeTab.set(tab);
  }

  async ngOnInit() {
    // La carga inicial se maneja por el effect
  }

  /**
   * Carga el ranking general basado en totalPoints del usuario
   */
  async loadLeaderboard() {
    this.isLoading.set(true);
    try {
      const user = this.auth.user();
      if (!user || !user.companyId) {
        this.leaderboard.set([]);
        return;
      }

      if (this.companyName() === 'Mi Empresa') {
        const comp = await this.companyService.getCompany(user.companyId);
        if (comp) this.companyName.set(comp.name);
      }

      const q = query(
        collection(db, 'users'),
        where('companyId', '==', user.companyId),
        orderBy('totalPoints', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const ranking = querySnapshot.docs.map((doc, index) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          name: data.displayName || data.name || 'Usuario',
          email: data.email,
          photoURL: data.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.displayName || data.name || 'U')}&background=random`,
          totalPoints: data.totalPoints || 0,
          rank: index + 1,
          lastUpdated: data.createdAt
        } as LeaderboardEntry;
      });

      this.leaderboard.set(ranking);
    } catch (error) {
      console.error("Error cargando leaderboard general:", error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Carga el ranking específico de una fecha sumando los puntos de las predicciones de esos partidos
   */
  async loadMatchdayLeaderboard() {
    this.isLoading.set(true);
    try {
      const user = this.auth.user();
      const tournamentId = this.tournamentService.currentTournamentId();
      if (!user || !user.companyId || !tournamentId) return;

      // 1. Obtener los IDs de los partidos de esa fecha
      const matchesQ = query(
        collection(db, `tournaments/${tournamentId}/matches`),
        where('matchday', '==', this.selectedMatchday())
      );
      const matchesSnap = await getDocs(matchesQ);
      const matchIds = matchesSnap.docs.map(d => d.id);

      if (matchIds.length === 0) {
        this.leaderboard.set([]);
        return;
      }

      // 2. Obtener usuarios de la empresa para tener sus nombres/fotos
      const usersQ = query(collection(db, 'users'), where('companyId', '==', user.companyId));
      const usersSnap = await getDocs(usersQ);
      const usersMap = new Map();
      usersSnap.docs.forEach(d => usersMap.set(d.id, d.data()));

      // 3. Obtener todas las predicciones para esos partidos que pertenecen a la empresa
      // Nota: En Firestore v9+ "where in" soporta hasta 10 elementos. 
      // Si hay más partidos, habría que hacer múltiples consultas o cambiar la estrategia.
      // Por ahora para fases de grupos (max 10-16 partidos) lo manejaremos simple.
      
      const userPointsMap = new Map<string, number>();
      
      // Inicializar todos los usuarios de la empresa con 0 puntos
      usersSnap.docs.forEach(d => userPointsMap.set(d.id, 0));

      // Consultar predicciones en bloques de 10 partidos (límite de Firestore 'in')
      for (let i = 0; i < matchIds.length; i += 10) {
        const chunk = matchIds.slice(i, i + 10);
        const predQ = query(
          collection(db, 'predictions'),
          where('companyId', '==', user.companyId),
          where('matchId', 'in', chunk)
        );
        const predSnap = await getDocs(predQ);
        predSnap.docs.forEach(d => {
          const data = d.data();
          const userId = data['userId'];
          const points = data['points'] || 0;
          userPointsMap.set(userId, (userPointsMap.get(userId) || 0) + points);

        });
      }

      // 4. Convertir mapa a LeaderboardEntry y ordenar
      const ranking: LeaderboardEntry[] = Array.from(userPointsMap.entries())
        .map(([userId, points]) => {
          const userData = usersMap.get(userId);
          return {
            id: userId,
            name: userData?.displayName || userData?.name || 'Usuario',
            photoURL: userData?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.displayName || 'U')}&background=random`,
            totalPoints: points,
            rank: 0,
            lastUpdated: new Date()
          } as LeaderboardEntry;
        })
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      this.leaderboard.set(ranking);
    } catch (error) {
      console.error("Error cargando leaderboard por fecha:", error);
    } finally {
      this.isLoading.set(false);
    }
  }
}