-- ============================================================
-- PRODEUS — Migración 009: Fix RLS para salir del grupo
-- ============================================================
-- La policy anterior solo permitía al líder actualizar membresías.
-- Un miembro regular necesita poder actualizar su propio registro
-- para poder abandonar el grupo (status -> 'removed').

create policy "group_members_update_self_leave"
  on public.group_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
