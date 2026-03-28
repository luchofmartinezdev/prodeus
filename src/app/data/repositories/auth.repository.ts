import { Injectable } from '@angular/core';
import { z } from 'zod';
import { supabase } from '../supabase.client';

// ─── Schemas de validación Zod ────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  username: z
    .string()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(30, 'El usuario no puede superar los 30 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guión bajo'),
});

export const magicLinkSchema = z.object({
  email: z.string().email('Email inválido'),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AuthRepository {
  signInWithPassword(dto: LoginDto) {
    const validated = loginSchema.parse(dto);
    return supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });
  }

  signUp(dto: RegisterDto) {
    const validated = registerSchema.parse(dto);
    return supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: { data: { username: validated.username } },
    });
  }

  signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  signInWithMagicLink(email: string) {
    const validated = magicLinkSchema.parse({ email });
    return supabase.auth.signInWithOtp({
      email: validated.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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
}
