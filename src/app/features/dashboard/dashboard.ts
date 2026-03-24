import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth'; 
import { db } from '../../core/firebase/firebase';
import { collection, getCountFromServer } from 'firebase/firestore'; 
import { TournamentService } from '../../core/services/tournament';
import { CompanyService } from '../../core/services/company';
import { AlertService } from '../../core/services/alert';
import { Tournament } from '../../core/models/models';

import { ImmersiveBannerComponent } from '../../shared/components/immersive-banner/immersive-banner';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ImmersiveBannerComponent],
  templateUrl: './dashboard.html'
})
export class DashboardComponent {
  public auth = inject(AuthService);
  public router = inject(Router);
  public tournamentService = inject(TournamentService);
  private companyService = inject(CompanyService);
  public alertService = inject(AlertService);
  
  // Métricas globales para el SuperAdmin
  totalUsers = signal(0);
  totalCompanies = signal(0);
  totalPredictions = signal(0);

  // Listado para Admins de Empresa
  availableTournaments = signal<Tournament[]>([]);
  company = signal<any | null>(null);

  // Un saludo dinámico basado en el nombre del usuario
  userFirstName = computed(() => {
    const name = this.auth.user()?.displayName;
    return name ? name.split(' ')[0] : 'Campeón';
  });

  stats = {
    globalRank: 1,
    accuracy: 0,
    totalPlayers: 0,
    pendingMatches: 0
  };

  constructor() {
    effect(async () => {
      const u = this.auth.user();
      if (u) {
        if (u.role === 'superadmin') {
          this.loadGlobalMetrics();
        } else {
          // Tanto 'admin' como 'user' cargan los torneos de su empresa
          this.loadCompanyView();
        }
      }
    });
  }

  async loadGlobalMetrics() {
    try {
      const [usersCount, companiesCount, predictionsCount] = await Promise.all([
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'companies')),
        getCountFromServer(collection(db, 'predictions'))
      ]);

      this.totalUsers.set(usersCount.data().count);
      this.totalCompanies.set(companiesCount.data().count);
      this.totalPredictions.set(predictionsCount.data().count);
    } catch (e) {
      console.error("Error loading global metrics", e);
    }
  }

  async loadCompanyView() {
    const u = this.auth.user();
    if (!u.companyId) return;
    
    // Cargar datos de la empresa para el joinCode y configuración
    const comp = await this.companyService.getCompany(u.companyId);
    this.company.set(comp);

    const tours = await this.tournamentService.getAvailableTournaments(u.role, u.companyId);
    this.availableTournaments.set(tours);
  }

  async createCompanyGroup(tournamentId: string) {
    const u = this.auth.user();
    if (!u || !u.companyId) {
      this.alertService.error('Información faltante', 'No se encontró información de la empresa.');
      return;
    }

    // Validación: ¿Ya participa en este torneo?
    const subscribed = this.company()?.subscribedTournaments || [];
    if (tournamentId === this.company()?.activeTournamentId || subscribed.includes(tournamentId)) {
      this.alertService.info('Torneo ya inscripto', '¡Tu empresa ya participa en este torneo!');
      return;
    }

    const confirmed = await this.alertService.confirm(
      'Activar Prode',
      '¿Seguro quieres activar este torneo para tu empresa? Los empleados podrán empezar a cargar predicciones.'
    );

    if (!confirmed) return;

    try {
      await this.companyService.updateCompanyTournament(u.companyId, tournamentId);
      await this.alertService.success('✅ ¡Éxito!', 'Prode activado. Tus empleados ya pueden participar.');
      this.router.navigate(['/leaderboard']);
    } catch (e) {
      console.error('Error al activar prode:', e);
      this.alertService.error('Error', 'Mmm, algo salió mal. Intenta de nuevo.');
    }
  }

  copyJoinCode() {
    const code = this.company()?.joinCode;
    if (code) {
      navigator.clipboard.writeText(code);
      this.alertService.success('Código Copiado', `El código ${code} se copió al portapapeles.`);
    }
  }
}