# Migración a Firebase — 01. Esquema Firestore

Proyecto Firebase: **prodeus-app** (cuenta `kernelstudio.solutions@gmail.com`, consola: https://console.firebase.google.com/project/prodeus-app/overview).

Este documento traduce el esquema relacional de Supabase (`supabase/migrations/001-012`) a colecciones de Firestore. Sirve de base para la Fase 3 (Security Rules) y Fase 4 (Cloud Functions).

## Criterios de diseño

1. **Colecciones top-level en lugar de subcolecciones**, salvo un caso (`groups/{id}/members`). La mayoría de las queries actuales filtran por campos que no son siempre el mismo padre (`status`, `group_id`, `match_id`), y las subcolecciones complican collection-group queries sin aportar ventaja real aquí. Esto también minimiza el reescritura de los repositorios: `.eq('tournament_id', id)` → `.where('tournamentId', '==', id)` es casi 1:1.
2. **IDs de documento compuestos** donde Postgres tenía un `unique constraint` de varias columnas (`predictions`, `scores`, `group_standings`, `third_place_lookup`). Esto reemplaza el upsert `onConflict` de Supabase por un `.set()` directo sobre un ID determinístico, y permite validar ownership en Security Rules leyendo el ID del documento sin lecturas extra (más barato que las políticas RLS con `EXISTS`).
3. **Desnormalización selectiva** en `matches` (datos de equipo) para eliminar los joins anidados que hoy hace `match.repository.ts` y `ranking.repository.ts`. El costo es mantenerla sincronizada vía Cloud Function cuando un equipo cambia (poco frecuente).
4. **Sin vista `group_ranking`**: en Postgres era una vista con `rank() over (...)`. En Firestore se reemplaza por una query simple (`scores` filtrado por `groupId`, ordenado por `totalPoints desc`) resuelta en el cliente o en la Cloud Function que la necesite — no se materializa aparte.

## Colecciones

### `users/{uid}`

Reemplaza `profiles`. `uid` = Firebase Auth UID (hoy `auth.users.id`).

```
username        string
firstName       string | null
lastName        string | null
avatarUrl       string | null
role            'user' | 'superadmin'
createdAt       Timestamp
```

> **Hallazgo (Fase 4)**: `firstName`/`lastName` existen en la `profiles` de producción (confirmado en `database.types.ts`) pero **no están en ninguna migración SQL versionada** — se agregaron directo en el dashboard de Supabase, fuera del control de versiones. Los incorporo acá porque el frontend los usa (`auth.store.ts: syncGoogleNames`), pero marco el hallazgo para que lo audites del lado de Supabase también (puede haber más columnas o cambios no versionados que no se ven en `supabase/migrations/`).
>
> El trigger `handle_new_user` se reemplaza por la Cloud Function `onUserCreate` (Auth trigger `functions/src/auth/onUserCreate.ts`), que crea este doc con `username` derivado del email y completa `firstName`/`lastName` desde el perfil de Google en el mismo alta — a diferencia de hoy, que lo hace en un segundo paso desde `auth.store.ts` (`syncGoogleNames`) en el primer login. Se simplifica a un solo paso porque Firebase Auth ya expone `displayName`/`photoURL` poblados por el provider de Google al momento de crear el usuario.

### `tournaments/{tournamentId}`

```
name            string
description     string | null
logoUrl         string | null
startDate       Timestamp
endDate         Timestamp
status          'draft' | 'active' | 'closed'
createdAt       Timestamp
```

### `teams/{teamId}`

```
tournamentId    string   (ref → tournaments)
name            string
shortName       string | null
logoUrl         string | null
```

Índice: `tournamentId`.

### `matches/{matchId}`

```
tournamentId          string
homeTeamId            string | null   (null permitido en playoffs no resueltos)
awayTeamId            string | null
homeTeam              { id, name, shortName, logoUrl } | null   -- snapshot desnormalizado
awayTeam              { id, name, shortName, logoUrl } | null   -- snapshot desnormalizado
matchDate             Timestamp
predictionDeadline    Timestamp
status                'scheduled' | 'in_progress' | 'finished'
homeScore             number | null
awayScore             number | null
round                 string | null

-- Soporte playoff (migración 007)
homeSourceMatchId     string | null
awaySourceMatchId     string | null
homeSourceResult      'winner' | 'loser' | null
awaySourceResult      'winner' | 'loser' | null
requiresTiebreak      boolean
tiebreakMethod        'extra_time' | 'penalties' | null
qualifierTeamId       string | null

-- Soporte bracket dinámico (migración 008)
bracketId             string | null   (único cuando existe)
homeSourcePosition    '1st' | '2nd' | '3rd' | null
awaySourcePosition    '1st' | '2nd' | '3rd' | null
homeSourceGroups      string | null
awaySourceGroups      string | null
```

Índices compuestos: `(tournamentId, status)`, `(tournamentId, matchDate)`, `bracketId` (single-field, autoindexado).

> Cloud Function `onTeamUpdated` (trigger en `teams/{teamId}`) propaga cambios de `name/shortName/logoUrl` a los `homeTeam`/`awayTeam` de los `matches` que referencian ese equipo (`where('homeTeamId','==',id)` / `where('awayTeamId','==',id)`).

### `scoringRules/{ruleKey}`

Doc ID = el propio `rule_key` (ya es global y único desde la migración 006, no hace falta UUID).

```
pointsValue     number
description     string | null
```

Valores esperados: `exact_score`, `correct_winner`, `correct_goals_only`, `no_match`, `correct_qualifier`.

### `groups/{groupId}`

```
tournamentId    string
name            string
leaderId        string   (ref → users)
joinMode        'open' | 'closed'
inviteCode      string   (único; generar con crypto random al crear, igual que hoy)
createdAt       Timestamp
```

Índices: `tournamentId`, `leaderId`, `inviteCode`.

> **Decisión (2026-08-04)**: se da de baja la regla `groups_one_leader_per_tournament` (índice único en Postgres, migración 003) — un usuario puede liderar más de un grupo en el mismo torneo. No se migra ninguna validación equivalente en Firestore ni en `onGroupCreate`.

#### `groups/{groupId}/members/{userId}` (subcolección)

Único caso de subcolección: se consulta casi siempre en el contexto de un grupo, y usar `userId` como doc ID permite `exists(/databases/$(db)/documents/groups/$(groupId)/members/$(request.auth.uid))` en Security Rules — reemplazo directo y O(1) de la función Postgres `is_group_member()`.

```
userId          string   -- redundante con el doc ID, ver nota (Fase 5)
status          'pending' | 'active' | 'removed'
joinedAt        Timestamp | null
```

> **Ajuste (Fase 5)**: se agregó el campo `userId` (duplicado del doc ID) porque Firestore no permite hacer `collectionGroup` queries filtrando por el último segmento de un path — para resolver "todos los grupos donde el usuario X es miembro activo" (`GroupRepository.findByUser`) hace falta un campo real sobre el que filtrar. Validado en `firestore.rules` para que no se pueda falsear.
>
> El trigger `handle_group_created` (agrega al líder como miembro activo) y `handle_member_approved` (crea `scores` al aprobar) se reemplazan por Cloud Functions `onGroupCreate` y `onMemberStatusChange`.

### `predictions/{predictionId}`

Doc ID compuesto: **`${userId}_${matchId}_${groupId}`** (reemplaza el unique constraint + el upsert `onConflict: 'group_id,user_id,match_id'` que usa `prediction.repository.ts`).

```
userId                      string
matchId                     string
groupId                     string
predictedHome               number
predictedAway               number
predictedQualifierTeamId    string | null
pointsEarned                number | null
submittedAt                 Timestamp
lastEditedAt                Timestamp | null
```

Índices compuestos: `(userId, groupId)`, `(matchId, groupId)`.

> `handle_prediction_edited` (actualiza `lastEditedAt`) se resuelve en la propia Cloud Function `score-match` o con un trigger `onPredictionUpdate` liviano.

### `scores/{scoreId}`

Doc ID compuesto: **`${userId}_${groupId}`** (reemplaza unique constraint `scores_unique_user_group`).

**Decisión confirmada**: `prodes` (participación usuario+grupo+torneo) se fusiona en esta colección — `prodes.total_points` era redundante con `scores.total_points`, y `prodes.final_position` pasa a ser `finalPosition` acá. `prodes` **no** existe como colección separada en Firestore.

```
userId              string
groupId             string
tournamentId        string
totalPoints         number
finalPosition       number | null   -- ex prodes.final_position
lastCalculatedAt    Timestamp
```

Índice compuesto: `(groupId, totalPoints desc)` — para el ranking en vivo (reemplaza el `order by total_points desc` + `partition by group_id` de la vista `group_ranking`).

> Lo escribe la Cloud Function `scoreMatch` (Admin SDK) — igual que hoy, donde `scores` solo lo toca el `service_role`. `finalPosition` se completa al cerrar el torneo (mismo punto donde antes se actualizaba `prodes.final_position`).

### `groupStandings/{standingId}`

Doc ID compuesto: **`${tournamentId}_${groupName}_${teamId}`** (reemplaza unique constraint de migración 008). Cache de solo-lectura calculado por la Cloud Function `calculateGroupStandings`.

```
tournamentId        string
groupName           string
teamId              string
position            number
played              number
won                 number
drawn               number
lost                number
goalsFor            number
goalsAgainst        number
goalDifference      number   -- Firestore no tiene columnas generadas; la Cloud Function la calcula (goalsFor - goalsAgainst) al escribir
points              number
calculatedAt        Timestamp
```

Índice compuesto: `(tournamentId, groupName)`.

### `thirdPlaceLookup/{lookupId}`

Datos de referencia estáticos (tabla FIFA, hasta 3.960 filas). Doc ID compuesto: **`${groupsKey}_${sourceGroup}`**.

```
groupsKey       string   -- ej. 'A,B,D,E,F,G,I,J'
sourceGroup     string   -- ej. 'A'
bracketSlot     string   -- ej. 'R16_H'
sourceSide      'home' | 'away'
```

Índice: `groupsKey` (single-field). Se importa una sola vez con un script batch (`firestore.bulkWriter`), igual que el seed SQL actual.

## Resumen de índices compuestos a crear

| Colección        | Índice                        |
| ---------------- | ----------------------------- |
| `matches`        | `(tournamentId, status)`      |
| `matches`        | `(tournamentId, matchDate)`   |
| `predictions`    | `(userId, groupId)`           |
| `predictions`    | `(matchId, groupId)`          |
| `scores`         | `(groupId, totalPoints desc)` |
| `groupStandings` | `(tournamentId, groupName)`   |

(Se definen en `firestore.indexes.json` en la Fase 4, junto con las Cloud Functions.)

## Mapeo rápido tabla → colección

| Postgres              | Firestore                                        | Notas                                                   |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `profiles`            | `users`                                          | doc ID = uid                                            |
| `tournaments`         | `tournaments`                                    | 1:1                                                     |
| `teams`               | `teams`                                          | 1:1                                                     |
| `matches`             | `matches`                                        | + snapshot desnormalizado de equipos                    |
| `scoring_rules`       | `scoringRules`                                   | doc ID = rule_key                                       |
| `groups`              | `groups`                                         | 1:1                                                     |
| `group_members`       | `groups/{id}/members`                            | subcolección, doc ID = userId                           |
| `prodes`              | _(fusionada en `scores`)_                        | confirmado                                              |
| `predictions`         | `predictions`                                    | doc ID compuesto                                        |
| `scores`              | `scores`                                         | doc ID compuesto, incluye `finalPosition` (ex `prodes`) |
| `group_standings`     | `groupStandings`                                 | doc ID compuesto                                        |
| `third_place_lookup`  | `thirdPlaceLookup`                               | doc ID compuesto                                        |
| vista `group_ranking` | _(sin colección — query directa sobre `scores`)_ |                                                         |

## Decisiones confirmadas (2026-08-04)

1. **`prodes` se fusiona en `scores`** (campo `finalPosition`) — implementado en este documento.
2. **RPC `create_default_scoring_rules` no se migra** — confirmado como código muerto.
3. **Project ID `prodeus-app` queda como está** — confirmado, no se recrea el proyecto.
