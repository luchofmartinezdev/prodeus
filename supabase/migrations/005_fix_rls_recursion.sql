-- ============================================================
-- PRODEUS — Migración 005: Fix infinite recursion in group_members RLS
-- ============================================================
-- Problem: group_members_select policy queries group_members inside itself.
-- This causes infinite recursion whenever group_members is accessed from
-- another policy (e.g. groups_select_authenticated queries group_members,
-- which triggers group_members_select, which queries group_members again).
--
-- Fix: replace the self-referential subquery with a security definer
-- function that bypasses RLS, breaking the recursion.

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN HELPER: is_group_member(group_id)
-- security definer = runs as owner, bypasses RLS on group_members
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- FIX: group_members_select — remove self-referential subquery
-- ─────────────────────────────────────────────────────────────
drop policy if exists "group_members_select" on public.group_members;

create policy "group_members_select"
  on public.group_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_group_member(group_id)
    or public.is_superadmin()
  );

-- ─────────────────────────────────────────────────────────────
-- FIX: groups_select_authenticated
-- The original policy queried group_members, which triggered
-- the recursive policy. Also, non-members couldn't look up
-- closed groups by invite code (blocked the join-by-code flow).
-- Solution: allow any authenticated user to see all groups.
-- Sensitive data (members, predictions, scores) remains protected
-- by their own policies.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "groups_select_authenticated" on public.groups;

create policy "groups_select_authenticated"
  on public.groups for select
  to authenticated
  using (true);
