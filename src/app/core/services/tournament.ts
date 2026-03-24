import { Injectable, inject, signal, effect } from '@angular/core';
import { db } from '../firebase/firebase';
import { AuthService } from './auth';
import { CompanyService } from './company';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  setDoc,
  updateDoc,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { COUNTRIES_DATA, Country } from '../data/countries';
import { Tournament, Match, Prediction, LeaderboardEntry } from '../models/models';
import { TeamService } from './team';

@Injectable({
  providedIn: 'root'
})
export class TournamentService {
  private teamService = inject(TeamService);
  private countries = COUNTRIES_DATA;
  public teams = this.teamService.teams;
  public tournaments = signal<Tournament[]>([]);
  public currentTournamentId = signal<string>('');
  public loading = signal<boolean>(false);

  private auth = inject(AuthService);
  private companyService = inject(CompanyService);

  constructor() {
    // Escuchamos cambios de usuario para ajustar el torneo de su empresa
    effect(async () => {
      const u = this.auth.user();
      if (u && u.companyId && u.companyId !== 'pending' && u.companyId !== 'global') {
        const company = await this.companyService.getCompany(u.companyId);
        if (company?.activeTournamentId) {
          this.currentTournamentId.set(company.activeTournamentId);
        }
        if (u.role === 'superadmin') {
          this.loadTournaments();
        }
      }
    }, { allowSignalWrites: true });

    // Cargar catálogos inicialmente solo de manera segura
    // this.loadTournaments(); <-- Eliminamos esta llamada global
    this.teamService.loadTeams();
  }

  async loadTournaments() {
    this.loading.set(true);
    try {
      const tourRef = collection(db, 'tournaments');
      const snap = await getDocs(tourRef);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
      
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      this.tournaments.set(list);
    } catch (e) {
      console.error('Prodeus Service: Error cargando torneos:', e);

    } finally {
      this.loading.set(false);
    }
  }



  // --- Selection ---

  setCurrentTournament(id: string) {
    this.currentTournamentId.set(id);
  }

  getCurrentTournamentId() {
    return this.currentTournamentId();
  }

  // --- Paths ---

  getTournamentRef() {
    return doc(db, 'tournaments', this.currentTournamentId());
  }

  getMatchesCollection() {
    return collection(db, 'tournaments', this.currentTournamentId(), 'matches');
  }

  getLeaderboardCollection() {
    return collection(db, 'tournaments', this.currentTournamentId(), 'leaderboards');
  }

  getMatchPredictionsCollection(matchId: string) {
    return collection(db, 'tournaments', this.currentTournamentId(), 'matches', matchId, 'predictions');
  }

  // --- Methods ---

  /**
   * Obtiene los torneos disponibles para un usuario según su rol y empresa
   */
  async getAvailableTournaments(role: string, companyId?: string): Promise<Tournament[]> {
    const tourRef = collection(db, 'tournaments');
    let q;

    try {
      if (role === 'superadmin') {
        const snap = await getDocs(query(tourRef, orderBy('startDate', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
      } else {
        // Para usuarios/admins, traemos los torneos en los que está inscripta su empresa
        if (companyId) {
          const companyData = await this.companyService.getCompany(companyId);
          const tIds = companyData?.subscribedTournaments || 
                       (companyData?.activeTournamentId ? [companyData.activeTournamentId] : []);
          
          if (tIds.length > 0) {
            const tournamentSnaps = await Promise.all(
              tIds.map(tourId => getDoc(doc(db, 'tournaments', tourId)))
            );
            return tournamentSnaps
              .filter(snap => snap.exists())
              .map(snap => ({ id: snap.id, ...snap.data() } as Tournament));
          }
        }

        // Si no tiene empresa o torneo activo, mostramos solo los públicos PRÓXIMOS (para suscripción)
        const publicSnap = await getDocs(query(tourRef, where('type', '==', 'public'), where('status', '==', 'upcoming')));
        return publicSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
      }
    } catch (error) {
      console.error("Error al obtener torneos:", error);
      return [];
    }
  }

  /**
   * Crea un nuevo torneo
   */
  async createTournament(tournament: Partial<Tournament>) {
    const tourRef = collection(db, 'tournaments');
    const docRef = await addDoc(tourRef, {
      ...tournament,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  }

  getCountry(id: string): Country | undefined {
    if (!id) return undefined;
    const lowerId = id.toLowerCase().trim();
    // Buscar primero en el catálogo dinámico de Firestore
    const fromFirestore = this.teams().find(t => t.id.toLowerCase() === lowerId);
    if (fromFirestore) return fromFirestore;

    // Si no está, buscar en el fallback estático
    return this.countries.find(c => c.id.toLowerCase() === lowerId);
  }

  async getMatches(): Promise<Match[]> {
    const tid = this.currentTournamentId();
    if (!tid) {
      console.warn('TournamentService: Intentando cargar partidos sin ID de torneo.');
      return [];
    }
    try {
      const q = query(this.getMatchesCollection(), orderBy('matchDate', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data() as any;
        return { 
          id: d.id, 
          ...data,
          homeTeamId: data.homeTeamId || data.homeTeam,
          awayTeamId: data.awayTeamId || data.awayTeam
        } as Match;
      });
    } catch (e: any) {
      console.error(`TournamentService: Error cargando partidos del torneo ${tid}:`, e);
      throw e;
    }
  }

  async savePrediction(matchId: string, prediction: Partial<Prediction>) {
    const predId = `${prediction.userId}_${matchId}`;
    const predRef = doc(this.getMatchPredictionsCollection(matchId), predId);

    const globalPredRef = doc(collection(db, 'predictions'), predId);

    const data = {
      ...prediction,
      matchId,
      tournamentId: this.currentTournamentId(),
      lastUpdated: Timestamp.now()
    };

    await setDoc(predRef, data, { merge: true });
    await setDoc(globalPredRef, data, { merge: true });
  }

  async getUserPredictions(userId: string) {
    const user = this.auth.user();
    if (!user || !user.companyId) {
      console.warn('TournamentService: Intentando cargar predicciones sin usuario o empresa asignada.');
      return [];
    }

    // Las reglas de seguridad exigen filtrar por companyId para permitir la lectura.
    const q = query(
      collection(db, 'predictions'),
      where('companyId', '==', user.companyId),
      where('userId', '==', userId)
    );
    
    const snap = await getDocs(q);
    const tid = this.currentTournamentId();
    
    // Filtrado adicional por torneo en memoria si es necesario
    return snap.docs
      .map(d => d.data() as Prediction)
      .filter(p => p.tournamentId === tid);
  }

  getMatchesByDay(allMatches: Match[], matchday: number): Match[] {
    const sorted = [...allMatches].sort((a, b) => {
      const dateA = a.matchDate?.seconds ? a.matchDate.seconds * 1000 : new Date(a.matchDate).getTime();
      const dateB = b.matchDate?.seconds ? b.matchDate.seconds * 1000 : new Date(b.matchDate).getTime();
      return dateA - dateB;
    });

    const start = (matchday - 1) * 24;
    return sorted.slice(start, start + 24);
  }
}
