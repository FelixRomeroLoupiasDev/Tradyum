import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (import.meta.env?.VITE_SUPABASE_URL as string) || 
  (import.meta.env?.NEXT_PUBLIC_SUPABASE_URL as string) ||
  'https://placeholder-url.supabase.co';

const supabaseAnonKey = 
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || 
  (import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
  'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
