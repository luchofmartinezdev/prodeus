# Migración a Firebase — 04. Repositorios del frontend (Angular)

Los 9 repositorios de `src/app/data/repositories/*.ts` + `AuthStore`/`RankingStore` fueron reescritos para usar Firestore/Firebase Auth en vez de Supabase. `src/app/data/supabase.client.ts` y la dependencia `@supabase/supabase-js` fueron eliminados.

## Estrategia: adaptador en la capa de datos

Cada repositorio sigue devolviendo los mismos tipos y formas que antes (`{data, error}`, DTOs en snake_case tomados de `database.types.ts`), traduciendo puertas adentro hacia/desde el esquema camelCase de Firestore. Esto significa que **los stores, servicios y componentes de arriba casi no se tocaron** — el diff quedó contenido casi en su totalidad a `src/app/data/`.

Excepciones donde sí hubo que tocar una capa arriba (justificadas caso por caso):

- `group.service.ts`: `approveMember/rejectMember/removeMember` ahora reciben `groupId` además de `memberId`, porque en Firestore un miembro se direcciona por `(groupId, userId)`, no por un ID de fila sintético como en Postgres. `group.store.ts` ya tenía `groupId` disponible en cada call site, así que fue un cambio de 3 líneas.
- `group.service.ts`: se eliminó el paso `addMember()` posterior al `create()` — la Cloud Function `onGroupCreate` (Fase 4) ya agrega al líder como miembro activo, así que el paso extra del cliente era redundante.
- `tournament.store.ts`: se eliminó la llamada muerta a `createDefaultRules()` (RPC ya confirmado como no migrado en la Fase 2/4).
- `profile.component.ts`: `isGoogleUser` ya no lee `app_metadata.provider` (no existe en Firebase Auth) — como el único método de login es Google, ahora es simplemente `user() !== null`.
- `auth.store.ts` / `auth.repository.ts`: reescritos por completo (ver abajo).

## Autenticación

- `AuthUser` (nuevo, en `auth.store.ts`) reemplaza el tipo `User` de `@supabase/supabase-js`, con `id` (no `uid`, para no tocar los ~10 call sites que ya leían `user()?.id`), `email`, `displayName`, `photoURL`.
- Login: `signInWithRedirect` + `getRedirectResult()` en `initialize()` — mismo flujo de redirect que Supabase OAuth, la ruta `/auth/callback` existente no necesitó cambios (solo depende de `authStore.isAuthenticated()`).
- `onAuthStateChanged` reemplaza `supabase.auth.onAuthStateChange`.
- Ya no hace falta el paso `syncGoogleNames` (client-side) — la Cloud Function `onUserCreate` completa `firstName`/`lastName` en un solo paso al crear el usuario.
- El listener de `visibilitychange` se simplificó: ya no hay que re-disparar `getSession()` por throttling de timers (mitigación específica de Supabase) — solo resincroniza el signal si hace falta.

## Cambios de modelo que requirieron ajustes retroactivos en Fases 2-4

Durante la reescritura aparecieron dos huecos en el diseño de Firestore que ya estaba desplegado, corregidos y redesplegados en esta misma fase:

1. **`groups/{id}/members` necesitaba un campo `userId`** además del doc ID — Firestore no permite `collectionGroup` queries filtrando por el último segmento de un path, y `GroupRepository.findByUser()` (¿en qué grupos soy miembro activo?) lo necesita. Se agregó el campo, se validó en `firestore.rules` (no se puede falsear), y se agregó el índice compuesto `(userId, status)` sobre el collection group `members`.
2. **Índice de campo único para `members.status`** (usado por `countActiveMembers()`) no puede declararse como entrada normal en `indexes` — Firestore lo rechaza pidiendo que se declare en `fieldOverrides`. Ya corregido en `firestore.indexes.json`.

## Hallazgo: `database.types.ts` está más desactualizado de lo que parecía

Además de `first_name`/`last_name` en `profiles` (encontrado en la Fase 4), `scoring_rules` en el archivo de tipos todavía muestra `tournament_id` como columna requerida — pero la migración 006 ya la eliminó. Los repositorios nuevos usan el esquema real (post-migraciones), no el archivo de tipos generado, para `ScoringRule` (ahora definido localmente en `scoring-rules.repository.ts` en vez de importado). Recomiendo correr `npm run db:types` contra la base de Supabase real para confirmar qué tan desincronizado está este archivo antes de dar de baja Supabase — puede haber más columnas agregadas a mano en el dashboard que no están en ninguna migración versionada.

## Gaps conocidos, resueltos en esta fase

- **Cascade delete de grupos**: Postgres borraba en cascada `group_members`, `predictions`, `scores`, `prodes` al borrar un `group` (`on delete cascade`). Firestore no tiene equivalente — `GroupRepository.remove()` ahora borra a mano (batch) la subcolección `members` + `predictions`/`scores` que referencian ese `groupId` antes de borrar el doc del grupo. No borra los docs de `groups/{id}/members` con lecturas gigantes si un grupo tuviera miles de miembros (no es el caso real de esta app), pero es una operación no atómica (batch de borrado + delete del padre) — una falla a mitad de camino dejaría el grupo borrado con restos huérfanos; aceptable dado el volumen esperado.
- **Conteos agregados** (`StatsRepository`): usa `getCountFromServer` (aggregation queries), equivalente directo a `count: 'exact', head: true` de Supabase. `countActiveMembers()` es un `collectionGroup` query — ver hallazgo de índice arriba.
- **AbortSignal en `findByUser`**: se preservó el timeout de 10s de `GroupStore.loadMyGroups()` con un helper `raceWithAbort()` nuevo en `firestore-helpers.ts`, ya que Firestore no soporta cancelación nativa vía `AbortSignal` en `getDocs()`.

## Verificación

- `npx tsc -p tsconfig.app.json --noEmit` → sin errores.
- `npx tsc -p tsconfig.spec.json --noEmit` → mismos 8 errores preexistentes (verificados con `git stash`, no relacionados a esta migración — tests ya rotos antes de tocar nada).
- `npx vitest run` → 131 passed, 11 failed. Los 11 son exactamente los mismos tests que ya fallaban antes de esta fase (confirmado con `git stash` + re-run), **cero regresiones nuevas**, salvo 3 tests que actualicé porque testeaban comportamiento que cambió a propósito (limpieza de `localStorage` con prefijo `sb-` en `signOut()`, ya no aplica con Firebase Auth; la llamada muerta a `createDefaultRules`).
- No se corrigieron los 8 tests pre-existentes rotos (`scoring-rules.service.spec.ts`, `rules.component.spec.ts`, `predictions.component.spec.ts`, `tournament-list.component.spec.ts`, `tournament.store.spec.ts` por el campo `status` faltante) — quedan fuera del alcance de esta migración, pero señalados acá para que los tengas en el radar.

## Pendiente para una fase posterior (no bloqueante)

No probé la app corriendo contra el proyecto Firebase real en el navegador (login con Google todavía no está habilitado como proveedor — ver Fase 5 anterior, es un toggle manual en la consola). Antes de dar por cerrada la migración del frontend conviene:

1. Habilitar Google en Firebase Auth (consola).
2. Levantar la app apuntando a `prodeus-app` y probar el flujo completo: login → crear torneo/equipos/partidos (admin) → crear grupo → invitar/unirse → cargar predicción → cargar resultado → ver que `scoreMatch` puntúe → ver ranking en vivo.
3. Migrar los datos existentes de Supabase a Firestore (no se hizo en esta fase — hay cero datos reales en `prodeus-app` todavía).
