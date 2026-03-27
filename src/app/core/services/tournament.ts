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
      const q = query(this.getMatchesCollection());
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

  // --- AUTOMATION ENGINE ---

  /**
   * Dispara el chequeo de avance automático tras finalizar un partido
   */
  async triggerAdvancementCheck(match: Match) {
    console.log(`🤖 Verificando avance automático para partido: ${match.id}`);

    // 1. Caso Playoffs: Si este partido tiene un ganador y un destino (nextMatchId)
    if (match.status === 'finished' && match.nextMatchId && match.winnerTeamId) {
      const nextMatchRef = doc(db, `tournaments/${match.tournamentId}/matches`, match.nextMatchId);
      const updateData: any = {};
      if (match.isHomeInNext) updateData.homeTeamId = match.winnerTeamId;
      else updateData.awayTeamId = match.winnerTeamId;

      await updateDoc(nextMatchRef, updateData);
      console.log(`✅ Ganador ${match.winnerTeamId} movido a partido ${match.nextMatchId}`);
    }

    // 2. Caso Fase de Grupos: Si el partido pertenece a un grupo estándar (A-L)
    if (match.status === 'finished' && match.group && match.group.length === 1) {
      await this.checkGroupCompletion(match.tournamentId, match.group);
    }
  }

  private async checkGroupCompletion(tournamentId: string, groupName: string) {
    const q = query(collection(db, `tournaments/${tournamentId}/matches`), where('group', '==', groupName));
    const snap = await getDocs(q);
    const matches = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));

    const allFinished = matches.every(m => m.status === 'finished');
    if (!allFinished) return;

    console.log(`📊 Grupo ${groupName} completado. Calculando tabla...`);
    const standings = this.calculateStandings(matches);

    // Buscar partidos de playoffs que esperan al 1ro o 2do de este grupo
    const knockoutQ = query(collection(db, `tournaments/${tournamentId}/matches`), where('status', '==', 'scheduled'));
    const kSnap = await getDocs(knockoutQ);

    for (const d of kSnap.docs) {
      const m = d.data() as Match;
      const updates: any = {};

      if (m.homePlaceholder === `1${groupName}`) updates.homeTeamId = standings[0].teamId;
      if (m.homePlaceholder === `2${groupName}`) updates.homeTeamId = standings[1].teamId;
      if (m.awayPlaceholder === `1${groupName}`) updates.awayTeamId = standings[0].teamId;
      if (m.awayPlaceholder === `2${groupName}`) updates.awayTeamId = standings[1].teamId;

      if (Object.keys(updates).length > 0) {
        await updateDoc(d.ref, updates);
        console.log(`📌 Actualizado partido playoff ${d.id} con clasificado de Grupo ${groupName}`);
      }
    }
  }

  private calculateStandings(matches: Match[]) {
    const table: Record<string, any> = {};
    matches.forEach(m => {
      [m.homeTeamId, m.awayTeamId].forEach(id => {
        if (!table[id]) table[id] = { teamId: id, pts: 0, gd: 0, gf: 0 };
      });

      const h = m.homeScore ?? 0;
      const a = m.awayScore ?? 0;

      table[m.homeTeamId].gf += h;
      table[m.awayTeamId].gf += a;
      table[m.homeTeamId].gd += (h - a);
      table[m.awayTeamId].gd += (a - h);

      if (h > a) table[m.homeTeamId].pts += 3;
      else if (a > h) table[m.awayTeamId].pts += 3;
      else {
        table[m.homeTeamId].pts += 1;
        table[m.awayTeamId].pts += 1;
      }
    });

    // Criterio básico: Puntos -> Diferencia de Gol -> Goles a Favor
    return Object.values(table).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }
}

