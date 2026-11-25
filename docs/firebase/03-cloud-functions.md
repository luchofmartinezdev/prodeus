# Migración a Firebase — 03. Cloud Functions

Código en `functions/` (TypeScript, Firebase Functions v2 + Admin SDK). Compila limpio (`npx tsc --noEmit` sin errores). **No desplegado todavía** — ver bloqueo abajo.

## Mapeo Edge Function / trigger Postgres → Cloud Function

| Origen                                                                                       | Cloud Function            | Tipo                                                             | Archivo                                             |
| -------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Trigger `handle_new_user` (003) + `syncGoogleNames` (client-side, `auth.store.ts`)           | `onUserCreate`            | Auth trigger (`v1.auth.user().onCreate`)                         | `functions/src/auth/onUserCreate.ts`                |
| Trigger `handle_group_created` (003) + índice único `groups_one_leader_per_tournament` (003) | `onGroupCreate`           | Firestore trigger (`onDocumentCreated`)                          | `functions/src/firestore/onGroupCreate.ts`          |
| Trigger `handle_member_approved` (003)                                                       | `onMemberStatusChange`    | Firestore trigger (`onDocumentWritten`)                          | `functions/src/firestore/onMemberStatusChange.ts`   |
| Trigger `handle_prediction_edited` (003)                                                     | _(sin Cloud Function)_    | Validado en `firestore.rules` (`lastEditedAt == request.time`)   | ver nota abajo                                      |
| Edge Function `score-match`                                                                  | `scoreMatch`              | HTTPS Callable                                                   | `functions/src/callable/scoreMatch.ts`              |
| Edge Function `calculate-group-standings`                                                    | `calculateGroupStandings` | HTTPS Callable                                                   | `functions/src/callable/calculateGroupStandings.ts` |
| Edge Function `generate-next-phase`                                                          | `generateNextPhase`       | HTTPS Callable                                                   | `functions/src/callable/generateNextPhase.ts`       |
| Edge Function `start-matches` + cron Supabase                                                | `startMatches`            | Scheduled (`onSchedule('every 1 minutes')`, usa Cloud Scheduler) | `functions/src/scheduled/startMatches.ts`           |

## Hallazgo crítico: `score-match` está probablemente rota en producción ahora mismo

La Edge Function actual carga las reglas de puntuación con:

```ts
supabase
  .from('scoring_rules')
  .select('rule_key, points_value')
  .eq('tournament_id', match.tournament_id);
```

Pero la migración **006** (`scoring_rules_global.sql`) **eliminó la columna `tournament_id`** de `scoring_rules` — las reglas son globales desde entonces. El último commit que tocó `score-match/index.ts` (`5a5ef54`) es _posterior_ a esa migración, así que el filtro por `tournament_id` quedó desactualizado: esa query contra una columna inexistente debería fallar (`42703 undefined column`), lo que hace que la función devuelva error 500 y **ningún partido se esté puntuando** desde que se aplicó la migración 006. Te recomiendo verificarlo directo en Supabase (loguear una llamada real a la función, o revisar si hay `predictions.points_earned` cargados después de esa fecha).

En el puerto a `scoreMatch` (Cloud Function) ya corregí esto: lee `scoringRules` sin filtro de torneo, como corresponde al modelo actual.

## `handle_prediction_edited`: sin Cloud Function, resuelto en las reglas

El trigger original sobrescribía `last_edited_at = now()` en cada `UPDATE`, sin que el cliente pudiera controlarlo. En Firestore, un trigger `onUpdate` que escribe sobre el mismo documento que lo disparó requiere cuidado para no generar un loop. En vez de eso, actualicé `firestore.rules` (Fase 3) para exigir que el propio cliente mande `lastEditedAt: serverTimestamp()` en el `update`, validado con `request.resource.data.lastEditedAt == request.time` — mismo resultado, sin Cloud Function ni riesgo de loop. Ya redesplegado.

## `groups_one_leader_per_tournament`: garantía más débil que en Postgres

En Postgres era un índice único (atómico, a nivel de base). En Firestore no hay constraints únicos multi-campo declarativos, así que `onGroupCreate` lo valida _después_ de crear el grupo: si detecta que el líder ya tenía otro grupo en el mismo torneo, borra el grupo recién creado. Esto es una garantía **eventual**, no preventiva — hay una ventana breve (mientras corre el trigger) donde el grupo duplicado existe y un cliente optimista podría llegar a mostrarlo antes de que desaparezca.

Alternativa más fuerte, si te importa cerrar esa ventana: mover la creación de grupos a una Cloud Function callable (`createGroup`) que haga la validación + el `create` dentro de una transacción de Firestore, en vez de que el cliente escriba `groups` directamente. Implica cambiar `group.repository.ts` para llamar a la función en lugar de insertar directo. No lo implementé todavía — quedó como decisión abierta (ver abajo).

## Autorización dentro de las Callable Functions

Cada callable (`scoreMatch`, `calculateGroupStandings`, `generateNextPhase`) valida que quien llama sea `superadmin` leyendo `users/{uid}`, igual que hoy exige la RLS de las tablas que tocan (`matches_all_superadmin`, `standings_write`, etc.). Las Edge Functions originales no tenían este chequeo porque Supabase las invocaba con la sesión del usuario pero confiaba en que solo la UI de superadmin las llamara — acá quedó explícito y verificado server-side.

## Bloqueo: plan Blaze requerido

Intenté desplegar (`firebase deploy --only functions --project prodeus-app`) y Firebase lo rechazó:

> Your project prodeus-app must be on the Blaze (pay-as-you-go) plan to complete this command.

Cloud Functions v2 corre sobre Cloud Run + Cloud Build + Artifact Registry, que no están disponibles en el plan Spark (gratuito) aunque el uso quede dentro de la franja gratuita. **No lo puedo resolver yo** — requiere asociar una forma de pago a la cuenta `kernelstudio.solutions@gmail.com`, eso te corresponde a vos.

### Lo que necesito que hagas

1. Entrar a https://console.firebase.google.com/project/prodeus-app/usage/details y hacer el upgrade a Blaze (podés poner un presupuesto/alerta de gasto ahí mismo, el tráfico actual del proyecto es cero así que el costo esperado es ~$0 hasta que migren datos reales).
2. Avisarme cuando esté hecho y corro `firebase deploy --only functions --project prodeus-app` para publicar las 7 funciones.

## Decisión abierta (no bloqueante, puede esperar a después del deploy)

¿Reforzamos `groups_one_leader_per_tournament` con una Cloud Function transaccional (`createGroup`), o dejamos la validación eventual del trigger tal como está? Afecta a `group.repository.ts` en la Fase 5 (capa de datos Angular), así que conviene decidirlo antes de esa fase.
