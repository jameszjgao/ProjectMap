import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://giuacjbfsyrristkigmz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdWFjamJmc3lycmlzdGtpZ216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTIyMTQsImV4cCI6MjA4MjkyODIxNH0.siB_aa_Q-XGdg2dMDDzMu1yjsXJtIcEm2-SDNsRomNk';

// 验证环境变量是否配置（与移动端接口保持一致）
export function validateSupabaseConfig(): { valid: boolean; error?: string } {
  if (!supabaseUrl || supabaseUrl === '' || supabaseUrl.includes('placeholder')) {
    return { valid: false, error: 'Supabase URL is not configured. Please set VITE_SUPABASE_URL.' };
  }
  if (!supabaseAnonKey || supabaseAnonKey === '' || supabaseAnonKey === 'placeholder-key') {
    return { valid: false, error: 'Supabase Anon Key is not configured. Please set VITE_SUPABASE_ANON_KEY.' };
  }
  return { valid: true };
}

// Web端使用默认的localStorage作为auth存储
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Web端需要检测URL中的session
  },
});
