// Script de una sola corrida: importa logos de torneos y equipos (+ escudos)
// desde API-Football, sube las imágenes a Firebase Storage y actualiza
// Firestore. No forma parte del build ni de ningún flujo recurrente —
// se ejecuta manualmente y se borra/archiva después de usarlo.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getGlobalDefaultAccount, getAccessToken } = require('firebase-tools/lib/auth');

const PROJECT_ID = 'prodeus-app';
const BUCKET = 'prodeus-app.firebasestorage.app';
const API_BASE = 'https://v3.football.api-sports.io';

const envPath =
  process.env.API_FOOTBALL_ENV_FILE ??
  path.join(
    process.env.LOCALAPPDATA ?? '',
    'Temp/claude/D--angularProjects-prodeus-prodeus/cd66e837-bf9c-4c05-910b-67c533f5aaa0/scratchpad/.api-football.env',
  );
const envContent = readFileSync(envPath, 'utf8');
const API_FOOTBALL_KEY = envContent.match(/API_FOOTBALL_KEY=(.+)/)[1].trim();

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

// ─── Mapeo torneo local → liga API-Football (confirmado por el usuario) ──
const TOURNAMENTS = [
  { firestoreId: '0ZG9dbv7l6jk0qas9aCK', name: 'Premier League', leagueId: 39 },
  { firestoreId: '3SQMlG2ZzFpIoSdoARsj', name: 'La Liga', leagueId: 140 },
  { firestoreId: '0KAqtYxiareU6sEP77tN', name: 'Serie A', leagueId: 135 },
  { firestoreId: 'Y6JgGRep9R1sNHds0aFN', name: 'Bundesliga', leagueId: 78 },
  { firestoreId: '7OUqkMLLylTCx93KfFcZ', name: 'Ligue 1', leagueId: 61 },
  { firestoreId: 'MTLx8Uw92iHoTkA0UK7B', name: 'Champions League', leagueId: 2 },
  { firestoreId: 'LAfS2H5eIW7rMBpDgZRm', name: 'Europa League', leagueId: 3 },
  { firestoreId: 'qpxogd26ISqfOuWFN5za', name: 'Copa Libertadores', leagueId: 13 },
  { firestoreId: 'ZuFOUdWLpe3tYpvOeWA4', name: 'Copa Sudamericana', leagueId: 11 },
  { firestoreId: 'QOMPypK2nflDaOObncR3', name: 'Recopa Sudamericana', leagueId: 541 },
  { firestoreId: 'zhjqb6VcUL1OcynHrPVU', name: 'Brasileirao', leagueId: 71 },
  { firestoreId: 'aJbdao59RDUuFHFgBvHv', name: 'LigaMX Apertura', leagueId: 262 },
  { firestoreId: 'UrZA7CKV2EqNqVPUJNdM', name: 'MLS', leagueId: 253 },
  { firestoreId: 'LUFwauNdQl1iUqhNpUdx', name: 'Primera Nacional', leagueId: 129 },
  { firestoreId: 'YWKdiR4Y0yM4oqPK96fW', name: 'Copa Argentina', leagueId: 130 },
  { firestoreId: 'ph7qZlHUqEhpss5f0bim', name: 'Liga Profesional Clausura', leagueId: 128 },
  { firestoreId: 'chvYmAz3aghaiZOcjZk1', name: 'Supercopa', leagueId: 810 },
];

// ─── Auth ──────────────────────────────────────────────────────
async function getFirebaseToken() {
  const account = getGlobalDefaultAccount();
  const { access_token } = await getAccessToken(account.tokens.refresh_token, [
    'https://www.googleapis.com/auth/cloud-platform',
  ]);
  return access_token;
}

// ─── API-Football ──────────────────────────────────────────────
async function apiFootball(endpoint, params) {
  const url = new URL(`${API_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }
  return json.response;
}

// El plan Free de API-Football solo permite consultar /teams para las
// temporadas 2022-2024 — no importa qué temporadas figuren en /leagues.
const FREE_PLAN_MAX_SEASON = 2024;

function pickBestSeason(seasons) {
  const eligible = seasons.filter((s) => s.year <= FREE_PLAN_MAX_SEASON);
  const withCoverage = eligible.filter((s) => s.coverage?.fixtures?.events);
  const pool = withCoverage.length > 0 ? withCoverage : eligible;
  if (pool.length === 0) return FREE_PLAN_MAX_SEASON;
  return pool.reduce((best, s) => (s.year > best.year ? s : best), pool[0]).year;
}

// ─── Storage + Firestore (REST, Admin token) ───────────────────
async function uploadImage(token, objectPath, buffer, contentType) {
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${await res.text()}`);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const contentType = res.headers.get('content-type') ?? 'image/png';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

async function patchFirestoreField(token, docPath, field, value) {
  const url = `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=${field}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [field]: { stringValue: value } } }),
  });
  if (!res.ok) throw new Error(`Firestore patch failed (${res.status}): ${await res.text()}`);
}

async function listExistingTeamNames(token, tournamentId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'teams' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'tournamentId' },
          op: 'EQUAL',
          value: { stringValue: tournamentId },
        },
      },
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const rows = await res.json();
  return new Set(
    rows.filter((r) => r.document).map((r) => r.document.fields.name.stringValue),
  );
}

async function createTeamDoc(token, { tournamentId, name, shortName, logoUrl }) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/teams`;
  const fields = {
    tournamentId: { stringValue: tournamentId },
    name: { stringValue: name },
    logoUrl: { stringValue: logoUrl },
  };
  if (shortName) fields.shortName = { stringValue: shortName };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Team create failed (${res.status}): ${await res.text()}`);
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  const token = await getFirebaseToken();
  const list = ONLY ? TOURNAMENTS.filter((t) => t.name === ONLY) : TOURNAMENTS;

  for (const t of list) {
    console.log(`\n=== ${t.name} (league ${t.leagueId}) ===`);

    const [league] = await apiFootball('/leagues', { id: t.leagueId });
    const season = pickBestSeason(league.seasons);
    console.log(`  season elegida: ${season}`);
    console.log(`  logo liga: ${league.league.logo}`);

    if (!DRY_RUN) {
      const { buffer, contentType } = await downloadImage(league.league.logo);
      const objectPath = `tournaments/${t.firestoreId}/logo.png`;
      const publicUrl = await uploadImage(token, objectPath, buffer, contentType);
      await patchFirestoreField(
        token,
        `projects/${PROJECT_ID}/databases/(default)/documents/tournaments/${t.firestoreId}`,
        'logoUrl',
        publicUrl,
      );
      console.log(`  ✔ logo torneo subido: ${publicUrl}`);
    }

    const teams = await apiFootball('/teams', { league: t.leagueId, season });
    console.log(`  equipos encontrados: ${teams.length}`);

    if (teams.length === 0) continue;

    const existingNames = DRY_RUN ? new Set() : await listExistingTeamNames(token, t.firestoreId);

    for (const { team } of teams) {
      if (existingNames.has(team.name)) {
        console.log(`  ⏭  ${team.name} (ya existe)`);
        continue;
      }
      console.log(`  + ${team.name}`);
      if (DRY_RUN) continue;

      const { buffer, contentType } = await downloadImage(team.logo);
      const objectPath = `teams/${t.leagueId}-${team.id}.png`;
      const publicUrl = await uploadImage(token, objectPath, buffer, contentType);
      await createTeamDoc(token, {
        tournamentId: t.firestoreId,
        name: team.name,
        shortName: team.code ?? null,
        logoUrl: publicUrl,
      });
    }
  }

  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
