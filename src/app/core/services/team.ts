import { Injectable, inject, signal } from '@angular/core';
import { db, storage } from '../firebase/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Country as Team } from '../data/countries';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private teamsCollection = collection(db, 'teams');
  
  // Fuente de verdad para los equipos
  public teams = signal<Team[]>([]);
  public loading = signal(false);

  constructor() { }

  async loadTeams(): Promise<Team[]> {
    this.loading.set(true);
    try {
      const q = query(this.teamsCollection, orderBy('name', 'asc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
      this.teams.set(list);
      return list;
    } catch (e) {
      console.error('Error al cargar equipos:', e);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  async addTeam(team: Team) {
    const docRef = doc(this.teamsCollection, team.id);
    await setDoc(docRef, team);
    await this.loadTeams(); // Recargar tras agregar
  }

  async updateTeam(id: string, data: Partial<Team>) {
    const docRef = doc(this.teamsCollection, id);
    await updateDoc(docRef, data);
    await this.loadTeams(); // Recargar tras actualizar
  }

  async deleteTeam(id: string) {
    const docRef = doc(this.teamsCollection, id);
    await deleteDoc(docRef);
    await this.loadTeams(); // Recargar tras eliminar
  }

  async uploadLogo(file: File, teamId: string): Promise<string> {
    const storageRef = ref(storage, `teams/${teamId}_${Date.now()}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  }

  /**
   * Semilla inicial para pasar los países del archivo estático a Firestore
   */
  async seedTeams(teams: Team[]) {
    for (const team of teams) {
      await this.addTeam(team);
    }
  }

  /**
   * Elimina TODOS los equipos del catálogo global en Firestore
   */
  async clearAllTeams(): Promise<number> {
    const snap = await getDocs(this.teamsCollection);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    this.teams.set([]);
    return snap.docs.length;
  }
}
