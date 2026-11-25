# Migración a Firebase — 05. Limpieza estructural de Supabase

Con las Fases 2-5 ya migradas y verificadas (sin regresiones nuevas en tests/compile), se retiró toda la infraestructura de Supabase que quedaba en el repo.

## Eliminado

- **`supabase/`** completo: 12 migraciones SQL, 2 seeds, 4 Edge Functions + `deno.json`. Todo sigue en el historial de git (`git log -- supabase/`) si hace falta consultarlo — el último commit que tocó la carpeta fue `5a5ef54`.
- **`.vscode/settings.json`**: solo tenía config de Deno apuntando a `supabase/functions`, quedó vacío de contenido útil.
- **`@supabase/supabase-js`**: dependencia de npm (ya se había dejado de importar en la Fase 5).
- **Script `db:types`** de `package.json` (invocaba `supabase gen types`).
- **Variables `NG_APP_SUPABASE_URL` / `NG_APP_SUPABASE_ANON_KEY`**: removidas de `.env`, `.env.example`, `src/env.d.ts`, `environment.ts`, `environment.prod.ts`, `vitest.config.ts`.
- **`tsconfig.json`**: sacado el `"exclude": ["supabase"]`, ya no aplica.
- **`.gitignore`**: se sacó la entrada `supabase/.temp/`; se agregaron en su lugar entradas para el estado del emulador de Firebase (`.firebase/`, `firebase-debug.log`, `firestore-debug.log`) y para `functions/node_modules` / `functions/lib` (no estaban cubiertas por el `/node_modules` con barra inicial, que solo ignora la raíz).

## Se mantuvo a propósito

- **`src/app/data/database.types.ts`**: sigue siendo la fuente de los tipos (`Group`, `Tournament`, `Team`, `Match`, `Prediction`, `Profile`, etc.) que usan los 9 repositorios nuevos de Firestore. Ya no se regenera desde Supabase — le agregué un comentario arriba explicando que es un snapshot congelado, mantenido a mano de acá en más.

## Dado de baja (decisión 2026-08-04)

**`verify-skeleton.mjs`** (script Playwright en la raíz, corrida manual, no formaba parte de la suite de tests automatizada) mockeaba llamadas REST a Supabase para verificar un bug puntual de skeletons de carga colgados, ya resuelto hace tiempo. Con Firestore (WebChannel/gRPC, no REST) el mockeo dejó de tener sentido tal cual estaba escrito — se eliminó junto con la entrada `/verify-screenshots` de `.gitignore`. No había dependencia de `playwright` en `package.json` que limpiar (se invocaba con una instalación ad hoc).

## Verificación posterior a la limpieza

- `npx tsc -p tsconfig.app.json --noEmit` → sin errores.
- `npx tsc` en `functions/` → sin errores.
- `npx vitest run` → 131 passed, 11 failed (mismos 11 pre-existentes de la Fase 5, cero regresiones nuevas).
- `grep -rli supabase` sobre todo el repo (excluyendo `node_modules`, `.git`, `docs/`, `dist/`) → solo quedan menciones textuales en comentarios que documentan qué reemplazó a qué (esperado y útil).
