import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthRepository {
  signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  signOut() {
    return supabase.auth.signOut();
  }

  getSession() {
    return supabase.auth.getSession();
  }

  onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
    return supabase.auth.onAuthStateChange(callback);
  }

  getProfile(userId: string) {
    return supabase.from('profiles').select('*').eq('id', userId).single();
  }

  updateProfile(
    userId: string,
    updates: { username?: string; first_name?: string | null; last_name?: string | null },
  ) {
    return supabase.from('profiles').update(updates).eq('id', userId).select().single();
  }
}
