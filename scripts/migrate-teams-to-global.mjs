// Script de una sola corrida: migra `teams` del modelo viejo (un doc por
// combinación equipo+torneo, con duplicados para clubes que juegan en más
// de una competencia) al modelo nuevo (equipo global + join `tournamentTeams`
// para el roster de cada torneo). No forma parte del build.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FF_TOOLS = process.env.FF_TOOLS_PATH;
const { getGlobalDefaultAccount, getAccessToken } = require(`${FF_TOOLS}/node_modules/firebase-tools/lib/auth`);

const PROJECT_ID = 'prodeus-app';
const DRY_RUN = process.argv.includes('--dry-run');

async function getToken() {
  const account = getGlobalDefaultAccount();
  const { access_token } = await getAccessToken(account.tokens.refresh_token, [
    'https://www.googleapis.com/auth/cloud-platform',
  ]);
  return access_token;
}

async function listAllTeams(token) {
  const teams = [];
  let pageToken;
  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/teams`,
    );
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    for (const doc of json.documents ?? []) {
      const id = doc.name.split('/').pop();
      teams.push({
        id,
        name: doc.fields.name.stringValue,
        tournamentId: doc.fields.tournamentId?.stringValue ?? null,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return teams;
}

async function upsertJoin(token, tournamentId, teamId) {
  const joinId = `${tournamentId}_${teamId}`;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tournamentTeams/${joinId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        tournamentId: { stringValue: tournamentId },
        teamId: { stringValue: teamId },
        createdAt: { stringValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) throw new Error(`Join upsert failed (${res.status}): ${await res.text()}`);
}

async function deleteTeam(token, id) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/teams/${id}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Delete failed (${res.status}): ${await res.text()}`);
}

async function stripTournamentId(token, id) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/teams/${id}?updateMask.fieldPaths=tournamentId`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {} }),
  });
  if (!res.ok) throw new Error(`Strip field failed (${res.status}): ${await res.text()}`);
}

async function main() {
  const token = await getToken();
  const teams = await listAllTeams(token);
  console.log(`Total equipos: ${teams.length}`);

  const byName = new Map();
  for (const t of teams) {
    if (!byName.has(t.name)) byName.set(t.name, []);
    byName.get(t.name).push(t);
  }

  console.log(`Clubes únicos (por nombre): ${byName.size}`);
  const dupGroups = [...byName.values()].filter((g) => g.length > 1);
  console.log(`Grupos con duplicados: ${dupGroups.length}`);

  let joinsCreated = 0;
  let docsDeleted = 0;

  for (const [name, docs] of byName) {
    const canonical = docs[0];
    const tournamentIds = [...new Set(docs.map((d) => d.tournamentId).filter(Boolean))];

    if (docs.length > 1) {
      console.log(`  ${name}: ${docs.length} docs → canónico ${canonical.id}, torneos: ${tournamentIds.join(', ')}`);
    }

    if (DRY_RUN) continue;

    for (const tournamentId of tournamentIds) {
      await upsertJoin(token, tournamentId, canonical.id);
      joinsCreated++;
    }

    await stripTournamentId(token, canonical.id);

    for (const dup of docs.slice(1)) {
      await deleteTeam(token, dup.id);
      docsDeleted++;
    }
  }

  console.log(`\nJoins creados: ${joinsCreated}`);
  console.log(`Docs duplicados borrados: ${docsDeleted}`);
  console.log('Listo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
