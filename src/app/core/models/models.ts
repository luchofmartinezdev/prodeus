// src/app/core/models/models.ts

// =========================
// 1. Team
// =========================
export interface Team {
  id: string;            // teamId
  name: string;          // Nombre del equipo
  country?: string;      // País si es selección nacional
  type: 'national' | 'club';
  flagUrl?: string;      // URL bandera (selecciones)
  logoUrl?: string;      // Logo del club
  fifaCode?: string;     // Código FIFA
}

// =========================
// 2. Company
// =========================
export interface Company {
  id: string;              // companyId
  name: string;            // Nombre de la compañía
  country?: string;        // País principal
  city?: string;           // Ciudad sede
  createdAt: Date | any;   // Fecha de registro
  adminUserId?: string;    // Usuario administrador
  adminEmail?: string;     // Email del administrador para comunicaciones
  logoUrl?: string;        // Logo de la empresa
  description?: string;    // Descripción breve
  active: boolean;         // Estado activo/inactivo (siempre true por ahora)
  activeTournamentId?: string; // Torneo actual seleccionado (legacy/default)
  subscribedTournaments?: string[]; // Listado de todos los torneos en los que participa
  joinCode?: string;       // Código para que empleados se unan
  websiteUrl?: string;     // Página web
  phone: string;            // Formato internacional: 54911... 
}

// =========================
// 3. User
// =========================
export interface User {
  id: string;              // userId
  name: string;            // Nombre completo
  email: string;           // Correo electrónico
  companyId?: string;      // Empresa a la que pertenece
  avatarUrl?: string;      // Foto o avatar
  role: 'user' | 'admin' | 'superadmin';
  pointsTotal?: number;    // Puntos acumulados
  joinedAt: Date | any;    // Fecha de registro
  lastLogin?: Date | any;  // Última sesión
  active: boolean;         // Estado activo/inactivo
  notificationsEnabled?: boolean; // Recibir notificaciones
}

// =========================
// 4. Prediction
// =========================
export interface Prediction {
  id: string;            // predictionId
  matchId: string;
  tournamentId: string;
  userId: string;
  companyId: string;
  homeScore: number;
  awayScore: number;
  points?: number;       // Calculados después del partido
}

// =========================
// 5. LeaderboardEntry
// =========================
export interface LeaderboardEntry {
  id: string;             // userId o companyId
  totalPoints: number;
  rank: number;
  lastUpdated: Date | any;
  // UI helper fields (denormalized or joined)
  name?: string;
  email?: string;
  photoURL?: string;
}

// =========================
// 6. Match
// =========================
export interface Match {
  id: string;               // matchId
  tournamentId: string;
  homeTeamId: string;       // Referencia a Team
  awayTeamId: string;       // Referencia a Team
  matchDate: Date | any;
  predictionCloseMinutes: number;
  homeScore?: number;       // null si no se ha jugado
  awayScore?: number;
  status: 'scheduled' | 'live' | 'finished';
  group?: string;           // Ej: 'A', 'B', 'Octavos'
  predictions?: Prediction[];
  // UI helper fields
  userHomePrediction?: number | null;
  userAwayPrediction?: number | null;
}

// =========================
// 7. Tournament
// =========================
export interface Tournament {
  id: string;            // tournamentId
  name: string;
  startDate: Date | any;
  endDate: Date | any;
  status: 'upcoming' | 'ongoing' | 'finished';

  // Multi-tenant fields
  type: 'public' | 'private';
  companyId?: string;    // ID of the company if private
  isTemplate?: boolean;  // If Super Admin marks it as template

  matches?: Match[];
  leaderboards?: LeaderboardEntry[];
}
