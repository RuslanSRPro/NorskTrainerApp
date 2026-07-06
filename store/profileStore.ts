import { create } from 'zustand';

import {
  getUserById,
  updateUserProfile,
  UserRecord,
} from '@/services/settings';

import { getCurrentUserId } from '@/store/authStore';

type ProfileState = {
  loading: boolean;
  profile: UserRecord | null;
  displayName: string;

  loadProfile: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  loading: false,
  profile: null,
  displayName: '',

  async loadProfile() {
    try {
      set({ loading: true });

      const userId = getCurrentUserId();

      if (!userId || userId === 'anonymous') {
        set({
          profile: null,
          displayName: '',
          loading: false,
        });
        return;
      }

      const profile = await getUserById(userId);

      set({
        profile,
        displayName: profile?.display_name || '',
        loading: false,
      });
    } catch (error) {
      console.log('Profile load error:', error);
      set({ loading: false });
    }
  },

  async updateDisplayName(name: string) {
    const trimmed = name.trim();
    const userId = getCurrentUserId();

    if (!userId || userId === 'anonymous') return;

    set({
      displayName: trimmed,
      profile: get().profile
        ? { ...get().profile!, display_name: trimmed }
        : null,
    });

    await updateUserProfile({
      userId,
      displayName: trimmed,
    });
  },
}));