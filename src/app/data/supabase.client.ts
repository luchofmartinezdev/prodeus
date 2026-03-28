import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import type { Database } from './database.types';

export const supabase: SupabaseClient<Database> = createClient<Database>(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
);
