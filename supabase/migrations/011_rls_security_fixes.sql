-- ============================================================
-- PRODEUS — Migración 011: RLS security fixes
-- ============================================================
-- Resultado del security audit 2026-05-03.
--
-- Brecha encontrada:
--   groups_delete_superadmin (002) bloquea a los líderes de eliminar
--   sus propios grupos. La UI sí expone esta acción a los líderes,
--   lo que causaba un error silencioso al intentar borrar.
--
-- Fix: agregar policy que permite al líder eliminar su propio grupo.
-- ============================================================

CREATE POLICY "groups_delete_leader"
  ON public.groups FOR DELETE
  TO authenticated
  USING (leader_id = auth.uid());
