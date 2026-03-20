import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { db } from '../../core/firebase/firebase';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  orderBy,
  query,
  writeBatch
} from 'firebase/firestore';

// Importación de tipos y constantes
import { COUNTRIES_DATA, Country } from '../../core/data/countries';
import { TournamentService } from '../../core/services/tournament';
import { MatchCardComponent } from '../../shared/components/match-card/match-card';
import { Match, Tournament, Company } from '../../core/models/models';
import { AuthService } from '../../core/services/auth';
import { CompanyService } from '../../core/services/company';
import { TeamService } from '../../core/services/team';
import { AlertService } from '../../core/services/alert';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, MatchCardComponent],
  templateUrl: './admin-panel.html'
})
export class AdminPanelComponent implements OnInit {
  private tournamentService = inject(TournamentService);
  private authService = inject(AuthService);
  private companyService = inject(CompanyService);
  private teamService = inject(TeamService);
  public alertService = inject(AlertService);

  // Estados
  tournaments = this.tournamentService.tournaments;
  companies = signal<Company[]>([]);
  matches = signal<Match[]>([]);
  loading = signal(false);
  activeTab = signal<number>(1);
  currentTournamentId = signal<string>('');
  user = this.authService.user;
  currentCompany = signal<Company | null>(null);
  selectedMatchday = signal<number>(1);
  bulkJson = signal<string>('');

  // Vista Previa de Carga Masiva
  bulkPreview = signal<{ id: string; name: string; fileName: string; previewUrl: string; matched: boolean; exists: boolean }[]>([]);
  private activeFileInput: HTMLInputElement | null = null;

  // Catálogo de equipos
  teams = this.teamService.teams;
  countries = COUNTRIES_DATA;

  // Paginación y Categorías de Equipos
  teamCategory = signal<'all' | 'national' | 'club'>('all');
  pageSize = signal<number>(24);
  currentPage = signal<number>(1);

  // Computeds para filtrado y paginación
  filteredTeamsByType = computed(() => {
    const all = this.teams();
    const type = this.teamCategory();
    if (type === 'all') return all;
    return all.filter(t => t.type === type);
  });

  paginatedTeams = computed(() => {
    const list = this.filteredTeamsByType();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  totalPages = computed(() => {
    const total = this.filteredTeamsByType().length;
    return Math.ceil(total / this.pageSize());
  });

  // Helpers de navegación
  changeTeamCategory(type: 'all' | 'national' | 'club') {
    this.teamCategory.set(type);
    this.currentPage.set(1);
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  // Formulario nuevo torneo
  newTournament = {
    name: '',
    type: 'public' as 'public' | 'private',
    companyId: '',
    isTemplate: false,
    startDate: '',
    endDate: ''
  };

  // Formulario nuevo partido
  newMatch = {
    homeId: '',
    awayId: '',
    date: '',
    stadium: 'Estadio Mundialista',
    group: 'A'
  };

  constructor() { }

  ngOnInit() {
    this.loadInitialData();
  }

  async loadInitialData() {
    try {
      this.loading.set(true);
      await this.tournamentService.loadTournaments();
      const u = this.user();
      if (u && u.role === 'admin' && u.companyId) {
        const comp = await this.companyService.getCompany(u.companyId);
        this.currentCompany.set(comp);
      }
    } catch (error) {
      console.error('Matchly Admin: Error en carga inicial:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async changeTab(tab: number) {
    this.activeTab.set(tab);
    if (tab === 2) await this.loadCompanies();
    if (tab === 3) await this.teamService.loadTeams();
  }

  async loadCompanies() {
    try {
      const snap = await getDocs(collection(db, 'companies'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Company));
      this.companies.set(list);
    } catch (e) { }
  }

  async handleAddTeam(name: string, id: string, fileInput: any) {
    if (!name || !id) return;
    this.loading.set(true);
    try {
      let finalLogo = 'https://flagcdn.com/unknown.svg';
      const file = fileInput.files[0];
      if (file) finalLogo = await this.teamService.uploadLogo(file, id);
      await this.teamService.addTeam({ id: id.toLowerCase().trim(), name: name.trim(), flagUrl: finalLogo });
      fileInput.value = '';
    } catch (e) {
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  async deleteTeam(id: string) {
    const ok = await this.alertService.confirm('Eliminar Equipo', '¿Estás seguro de que quieres eliminar este equipo del catálogo?');
    if (!ok) return;
    this.loading.set(true);
    try {
      await this.teamService.deleteTeam(id);
    } catch (e) {
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  async seedFromStatic() {
    const ok = await this.alertService.confirm('Importar Catálogo', 'Esto cargará todos los países predeterminados a la base de datos. ¿Continuar?');
    if (!ok) return;
    this.loading.set(true);
    try {
      await this.teamService.seedTeams(this.countries);
      this.alertService.success('Importación Exitosa', 'Los países predeterminados han sido importados al catálogo.');
    } catch (e) {
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  async clearAllTeams() {
    const ok = await this.alertService.confirm('⚠️ Peligro', 'Esto eliminará TODOS los equipos del catálogo permanentemente. ¿Confirmar?');
    if (!ok) return;
    this.loading.set(true);
    try {
      const count = await this.teamService.clearAllTeams();
      await this.alertService.success('🗑️ Catálogo Limpio', `Se eliminaron ${count} equipos del catálogo.`);
    } catch (e) {
      console.error('Error limpiando catálogo:', e);
      this.alertService.error('Error', 'No se pudo limpiar el catálogo. Revisá la consola.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Migración: Convierte empresas del formato anterior (1 solo torneo)
   * al formato nuevo (array de torneos)
   */
  async migrateCompanies() {
    const ok = await this.alertService.confirm(
      'Migrar Empresas',
      '¿Quieres actualizar todas las empresas al nuevo formato de múltiples torneos?'
    );
    if (!ok) return;

    this.loading.set(true);
    let updatedCount = 0;
    try {
      const snap = await getDocs(collection(db, 'companies'));
      const batch = writeBatch(db);

      snap.docs.forEach(d => {
        const data = d.data();
        const activeTid = data['activeTournamentId'];
        const subscribed = data['subscribedTournaments'];

        // Si tiene uno activo pero no tiene el array, migramos
        if (activeTid && !subscribed) {
          batch.update(d.ref, {
            subscribedTournaments: [activeTid]
          });
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await batch.commit();
        this.alertService.success('Migración exitosa', `Se actualizaron ${updatedCount} empresas.`);
      } else {
        this.alertService.info('Sin cambios', 'Todas las empresas ya cuentan con el nuevo formato.');
      }
    } catch (e) {
      console.error('Error en migración:', e);
      this.alertService.error('Error', 'Hubo un fallo al migrar los datos.');
    } finally {
      this.loading.set(false);
    }
  }

  async selectTournament(id: string) {
    this.currentTournamentId.set(id);
    this.tournamentService.currentTournamentId.set(id);
    await Promise.all([this.teamService.loadTeams(), this.loadMatches()]);
  }

  backToList() {
    this.currentTournamentId.set('');
    this.matches.set([]);
  }

  async saveTournament() {
    if (!this.newTournament.name) return;
    this.loading.set(true);
    try {
      await addDoc(collection(db, 'tournaments'), {
        ...this.newTournament,
        status: 'upcoming',
        startDate: new Date(),
        endDate: new Date()
      });
      this.newTournament.name = '';
      await this.tournamentService.loadTournaments();
    } catch (e) {
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  get filteredMatches() {
    return this.tournamentService.getMatchesByDay(this.matches(), this.selectedMatchday());
  }

  async loadMatches() {
    if (!this.currentTournamentId()) return;
    this.loading.set(true);
    try {
      const q = query(collection(db, `tournaments/${this.currentTournamentId()}/matches`), orderBy('matchDate'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          homeTeamId: data.homeTeamId || data.homeTeam,
          awayTeamId: data.awayTeamId || data.awayTeam
        } as Match;
      });
      this.matches.set(list);
    } catch (e) {
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  async createMatch() {
    if (!this.newMatch.homeId || !this.newMatch.awayId || !this.currentTournamentId()) return;
    this.loading.set(true);
    try {
      const matchesRef = collection(db, `tournaments/${this.currentTournamentId()}/matches`);
      await addDoc(matchesRef, {
        tournamentId: this.currentTournamentId(),
        homeTeamId: this.newMatch.homeId,
        awayTeamId: this.newMatch.awayId,
        matchDate: new Date(this.newMatch.date),
        predictionCloseMinutes: 15,
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        stadium: this.newMatch.stadium,
        group: this.newMatch.group
      });
      await this.loadMatches();
    } catch (e) {
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  async setFinalResult(matchId: string, hScore: any, aScore: any) {
    if (!this.currentTournamentId()) return;
    this.loading.set(true);
    try {
      const matchRef = doc(db, `tournaments/${this.currentTournamentId()}/matches`, matchId);
      await updateDoc(matchRef, { homeScore: Number(hScore), awayScore: Number(aScore), status: 'finished' });
      await this.loadMatches();
    } catch (e) {
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  async setActiveTournamentForCompany(tournamentId: string) {
    const u = this.user();
    if (!u || !u.companyId) return;
    this.loading.set(true);
    try {
      await this.companyService.updateCompanyTournament(u.companyId, tournamentId);
      const comp = await this.companyService.getCompany(u.companyId);
      this.currentCompany.set(comp);
      alert('Torneo activado para tu empresa.');
    } catch (e) {
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  // ────── HELPERS DE ARCHIVO ──────
  private buildFileMap(input: HTMLInputElement): Map<string, File> {
    const fileMap = new Map<string, File>();
    const add = (k: string, f: File) => { fileMap.set(k, f); fileMap.set(k.toLowerCase(), f); };

    for (let i = 0; i < input.files!.length; i++) {
      const f = input.files![i];
      const rel = (f as any).webkitRelativePath as string || '';

      add(f.name, f);                                            // aldosivi.png
      add(f.name.replace(/\.[^.]+$/, ''), f);                    // aldosivi

      if (rel) {
        add(rel, f);                                             // carpeta/Arg/aldosivi.png
        const parts = rel.split('/');
        if (parts.length > 1) add(parts.slice(1).join('/'), f); // Arg/aldosivi.png
        if (parts.length > 2) add(parts.slice(2).join('/'), f); // aldosivi.png
      }
    }
    return fileMap;
  }

  private lookupFile(raw: string, fileMap: Map<string, File>): File | undefined {
    const key = raw.replace(/\\/g, '/'); // normalizar backslash de Windows
    return fileMap.get(key)
      ?? fileMap.get(key.toLowerCase())
      ?? fileMap.get(key.split('/').pop() ?? '')
      ?? fileMap.get((key.split('/').pop() ?? '').toLowerCase());
  }

  /** Limpia caracteres de control inválidos que rompen JSON.parse */
  private sanitizeJson(str: string): string {
    return str
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // control chars excepto \t \n \r
      .replace(/\r\n/g, '\n')  // normalizar line endings
      .replace(/\r/g, '\n');   // CR sueltos
  }

  // ────── BULK UPLOAD PREVIEW ──────
  generateBulkPreview(fileInput?: HTMLInputElement) {
    if (fileInput) this.activeFileInput = fileInput;
    const input = fileInput ?? this.activeFileInput ?? undefined;

    this.bulkPreview().forEach(p => { if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl); });

    const jsonStr = this.bulkJson().trim();
    if (!jsonStr || !input?.files?.length) { this.bulkPreview.set([]); return; }

    try {
      const raw = JSON.parse(this.sanitizeJson(jsonStr));
      const rows: any[] = Array.isArray(raw) ? raw : (raw.teams || []);
      const fileMap = this.buildFileMap(input);

      const existingIds = new Set(this.teams().map(t => t.id.toLowerCase()));

      const preview = rows.map((t: any) => {
        const id   = String(t.id || t.ID || '').toLowerCase().trim();
        const name = t.nombre || t.name || t.Name || t.nombre_local || t.nombre_equipo || '';

        // Detectar el campo que contiene el nombre del archivo local
        const rawFile = t.archivo_local || t.archivo
          || (!String(t.logoUrl || '').startsWith('http') ? t.logoUrl : '')
          || (!String(t.flagUrl  || '').startsWith('http') ? t.flagUrl  : '')
          || '';
        const fileName = rawFile;

        const matchedFile = fileName ? this.lookupFile(fileName, fileMap) : undefined;
        const matched = !!matchedFile;
        const exists = existingIds.has(id);
        
        const previewUrl = matchedFile
          ? URL.createObjectURL(matchedFile)
          : (t.flagUrl?.startsWith('http') ? t.flagUrl : (t.logoUrl?.startsWith('http') ? t.logoUrl : 'https://flagcdn.com/unknown.svg'));
        
        return { id, name, fileName: rawFile, previewUrl, matched, exists };
      });

      this.bulkPreview.set(preview);
    } catch (e) {
      console.error('Preview error:', e);
      this.bulkPreview.set([]);
    }
  }

  clearBulkPreview() {
    this.bulkPreview().forEach(p => { if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl); });
    this.bulkPreview.set([]);
  }

  // ────── BULK UPLOAD REAL ──────
  async handleBulkUpload(fileInput?: HTMLInputElement) {
    const jsonStr = this.bulkJson().trim();
    if (!jsonStr) return;

    const input = fileInput ?? this.activeFileInput ?? undefined;

    try {
      this.loading.set(true);
      const data = JSON.parse(this.sanitizeJson(jsonStr));
      let teamsToProcess: any[] = [];
      let matchesToProcess: any[] = [];

      if (Array.isArray(data)) {
        teamsToProcess = data;
      } else {
        teamsToProcess = data.teams || [];
        matchesToProcess = data.matches || [];
      }

      // Construir mapa de archivos si hay input
      const fileMap = input?.files?.length ? this.buildFileMap(input) : new Map<string, File>();
      console.log(`📂 FileMap construido con ${fileMap.size} entradas.`);

      // Procesar equipos → subir imagen → obtener URL permanente → guardar flagUrl
      let uploaded = 0;
      for (const t of teamsToProcess) {
        const id   = String(t.id || t.ID || '').toLowerCase().trim();
        const name = (t.nombre || t.name || t.Name || '').trim();
        if (!id || !name) continue;

        // Detectar el nombre de archivo local (logoUrl/flagUrl si no es http, o archivo_local)
        const rawFileName = t.archivo_local || t.archivo
          || (!String(t.logoUrl || '').startsWith('http') ? t.logoUrl : '')
          || (!String(t.flagUrl  || '').startsWith('http') ? t.flagUrl  : '')
          || '';

        // URL de destino: si ya hay una URL http en flagUrl/logoUrl la usamos, sino placeholder
        let flagUrl = (String(t.flagUrl  || '').startsWith('http') ? t.flagUrl  : '')
                   || (String(t.logoUrl  || '').startsWith('http') ? t.logoUrl  : '')
                   || 'https://flagcdn.com/unknown.svg';

        console.group(`⚽ Procesando: ${name} (${id})`);
        console.log('  archivo_local:', rawFileName);

        if (rawFileName) {
          const fileToUpload = this.lookupFile(rawFileName, fileMap);
          console.log('  Archivo encontrado:', fileToUpload ? `✅ ${fileToUpload.name}` : '❌ No encontrado');

          if (fileToUpload) {
            try {
              // ✅ Sube a Firebase Storage → obtiene URL permanente → se guarda como flagUrl
              flagUrl = await this.teamService.uploadLogo(fileToUpload, id);
              console.log('  Storage URL:', flagUrl);
              uploaded++;
            } catch (err) {
              console.error(`  ❌ Error subiendo ${rawFileName}:`, err);
            }
          }
        }

        console.log('  flagUrl final:', flagUrl);
        console.groupEnd();

        // Determinar tipo: prioritizar t.type, sino heurística simple
        const type = t.type || (t.flagUrl && !t.logoUrl ? 'national' : 'club');
        const country = t.country || t.pais || '';

        await this.teamService.addTeam({ 
          id, 
          name, 
          flagUrl, 
          type: type as 'national' | 'club',
          country: country 
        });
      }

      // Procesar partidos (si hay torneo activo)
      if (this.currentTournamentId() && matchesToProcess.length > 0) {
        const matchesRef = collection(db, `tournaments/${this.currentTournamentId()}/matches`);
        for (const m of matchesToProcess) {
          if (m.homeId && m.awayId) {
            await addDoc(matchesRef, {
              tournamentId: this.currentTournamentId(),
              homeTeamId: m.homeId,
              awayTeamId: m.awayId,
              matchDate: m.date ? new Date(m.date) : new Date(),
              predictionCloseMinutes: 15,
              homeScore: null,
              awayScore: null,
              status: m.status || 'scheduled',
              stadium: m.stadium || 'Estadio Mundialista',
              group: m.group || 'A',
              matchday: m.matchday || 1
            });
          }
        }
        await this.loadMatches();
      }

      this.bulkJson.set('');
      this.clearBulkPreview();
      if (input) input.value = '';
      this.alertService.success('Carga Masiva Exitosa', `Carga completada: ${teamsToProcess.length} equipos procesados, ${uploaded} imágenes subidas a Storage.`);
    } catch (e) {
      console.error('Error en carga masiva:', e);
      this.alertService.error('Error en Carga', 'Hubo un error en el proceso de carga. Revisa la consola para más detalles.');
    } finally {
      this.loading.set(false);
    }
  }

  async seedFullWorldCupFixture() {
    if (!this.currentTournamentId()) return;
    this.loading.set(true);
    try {
      const matchesRef = collection(db, `tournaments/${this.currentTournamentId()}/matches`);
      console.log('Sembrando fixture para:', this.currentTournamentId);
      this.loading.set(false);
    } catch (e) {
      console.error(e);
      this.loading.set(false);
    }
  }
}