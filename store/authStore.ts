import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

type AuthState = {
  session:     Session | null;
  user:        User | null;
  loading:     boolean;
  initialized: boolean;

  initialize:          () => Promise<void>;
  signInWithOtp:       (email: string) => Promise<{ error: string | null }>;
  verifyOtp:           (email: string, token: string) => Promise<{ error: string | null }>;
  signOut:             () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  session:     null,
  user:        null,
  loading:     false,
  initialized: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, initialized: true });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signInWithOtp: async (email: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });
      return { error: error?.message ?? null };
    } catch (err: any) {
      return { error: err?.message || 'Unknown error' };
    } finally {
      set({ loading: false });
    }
  },

  verifyOtp: async (email: string, token: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type:  'email',
      });
      if (error) return { error: error.message };
      set({ session: data.session, user: data.user });
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Unknown error' };
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ session: null, user: null, loading: false });
  },
}));

export function getCurrentUserId(): string {
  const { user } = useAuthStore.getState();
  return user?.id || 'anonymous';
}