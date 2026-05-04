import { Injectable } from '@angular/core';
import { z } from 'zod';
import type { Group, GroupMember, Profile, Tournament } from '../database.types';
import type { TablesInsert, TablesUpdate } from '../database.types';
import { supabase } from '../supabase.client';

// ─── Types ────────────────────────────────────────────────────

export type GroupWithTournament = Group & {
  tournament: Pick<Tournament, 'id' | 'name' | 'status'>;
};

export type MemberWithProfile = GroupMember & {
  profile: Pick<Profile, 'id' | 'username' | 'avatar_url'>;
};

// ─── Schema ───────────────────────────────────────────────────

export const groupSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(60, 'Máximo 60 caracteres'),
  tournament_id: z.string().min(1, 'El torneo es requerido'),
  join_mode: z.enum(['open', 'closed']),
});

export type GroupDto = z.infer<typeof groupSchema>;

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GroupRepository {
  findByUser(userId: string) {
    return supabase
      .from('group_members')
      .select('groups(*, tournament:tournaments(id,name,status))')
      .eq('user_id', userId)
      .eq('status', 'active');
  }

  findOne(id: string) {
    return supabase
      .from('groups')
      .select('*, tournament:tournaments(id,name,status)')
      .eq('id', id)
      .single();
  }

  findMembers(groupId: string) {
    return supabase
      .from('group_members')
      .select('*, profile:profiles(id,username,avatar_url)')
      .eq('group_id', groupId)
      .neq('status', 'removed')
      .order('joined_at', { ascending: true, nullsFirst: false });
  }

  findByInviteCode(code: string) {
    return supabase
      .from('groups')
      .select('*, tournament:tournaments(id,name,status)')
      .eq('invite_code', code.trim().toUpperCase())
      .single();
  }

  create(dto: GroupDto, leaderId: string) {
    const validated = groupSchema.parse(dto);
    const invite_code = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
    const insert: TablesInsert<'groups'> = {
      ...validated,
      leader_id: leaderId,
      invite_code,
    };
    // Only select id back — avoids RLS issues on the full join before the leader is a member
    return supabase.from('groups').insert(insert).select('id').single();
  }

  addMember(groupId: string, userId: string, status: 'pending' | 'active') {
    const insert: TablesInsert<'group_members'> = {
      group_id: groupId,
      user_id: userId,
      status,
      joined_at: status === 'active' ? new Date().toISOString() : null,
    };
    // No .select() to avoid RLS SELECT issues
    return supabase.from('group_members').insert(insert);
  }

  update(id: string, dto: Partial<Pick<GroupDto, 'name' | 'join_mode'>>) {
    const update: TablesUpdate<'groups'> = dto;
    return supabase
      .from('groups')
      .update(update)
      .eq('id', id)
      .select('*, tournament:tournaments(id,name,status)')
      .single();
  }

  remove(id: string) {
    return supabase.from('groups').delete().eq('id', id);
  }

  async joinGroup(
    groupId: string,
    userId: string,
    status: 'pending' | 'active',
  ): Promise<{ error: { code: string; message: string } | null }> {
    const joinedAt = status === 'active' ? new Date().toISOString() : null;

    // Check if the user has a previous (removed) record to avoid a 409 on INSERT
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('group_members')
        .update({ status, joined_at: joinedAt })
        .eq('group_id', groupId)
        .eq('user_id', userId);
      return { error: error ? { code: error.code, message: error.message } : null };
    }

    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: userId,
      status,
      joined_at: joinedAt,
    });
    return { error: error ? { code: error.code, message: error.message } : null };
  }

  updateMemberStatus(memberId: string, status: 'active' | 'removed') {
    const update: TablesUpdate<'group_members'> = {
      status,
      ...(status === 'active' ? { joined_at: new Date().toISOString() } : {}),
    };
    // No .select() — the updated row may belong to another user,
    // which would trigger RLS recursion on group_members
    return supabase.from('group_members').update(update).eq('id', memberId);
  }

  // Get first the memberId for the current user and group, then update its status to 'removed'
  leave(groupId: string, userId: string) {
    try {
      if (!groupId || !userId) {
        return Promise.reject(new Error('Group ID and User ID are required to leave a group'));
      }

      return supabase
        .from('group_members')
        .update({ status: 'removed' })
        .eq('group_id', groupId)
        .eq('user_id', userId);
    } catch {
      return Promise.reject(new Error('No se pudo salir del grupo'));
    }
  }
}
