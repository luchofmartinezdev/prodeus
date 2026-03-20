import { Component, inject, signal, OnInit, effect } from '@angular/core';
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

  leaderboard = signal<LeaderboardEntry[]>([]);
  tournaments = signal<Tournament[]>([]);
  companyName = signal<string>('Mi Empresa');
  isLoading = signal(true);

  constructor() {
    this.loadTournaments();
    
    // Recargar ranking cuando cambie el torneo actual
    effect(() => {
      const tid = this.tournamentService.currentTournamentId();
      if (tid) this.loadLeaderboard();
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

  async ngOnInit() {
    // La carga inicial se maneja por el effect
  }

  async loadLeaderboard() {
    this.isLoading.set(true);
    try {
      const user = this.auth.user();
      if (!user || !user.companyId) {
        this.leaderboard.set([]);
        return;
      }

      // Cargar nombre de la empresa si no lo tenemos
      if (this.companyName() === 'Mi Empresa') {
        const comp = await this.companyService.getCompany(user.companyId);
        if (comp) this.companyName.set(comp.name);
      }

      // Consultar todos los usuarios que pertenecen a la misma empresa
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
          photoURL: data.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.displayName || 'U')}&background=random`,
          totalPoints: data.totalPoints || 0,
          rank: index + 1,
          lastUpdated: data.createdAt
        } as LeaderboardEntry;
      });

      this.leaderboard.set(ranking);
    } catch (error) {
      console.error("Error cargando leaderboard:", error);
    } finally {
      this.isLoading.set(false);
    }
  }
}