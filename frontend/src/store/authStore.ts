import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import { User, Subscription } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  subscription: Subscription | null;
  isSubscriptionActive: boolean;
  login: (email: string, password: string) => Promise<void>;
  athleteLogin: (email: string, accessCode: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  updateSubscription: (plan: string, status: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  subscription: null,
  isSubscriptionActive: false,

  login: async (email: string, password: string) => {
    try {
      const response = await authAPI.login({ email, password });
      const { access_token, user } = response.data;
      await AsyncStorage.setItem('token', access_token);
      const subscription = user.subscription || null;
      // Admin users are always active, or check subscription status
      const isSubscriptionActive = user.is_admin || subscription?.is_active || subscription?.status === 'active' || subscription?.plan === 'admin';
      set({ user, token: access_token, isAuthenticated: true, subscription, isSubscriptionActive });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  },

  athleteLogin: async (email: string, accessCode: string) => {
    try {
      const response = await authAPI.athleteLogin({ email, access_code: accessCode });
      const { access_token, user } = response.data;
      await AsyncStorage.setItem('token', access_token);
      set({ user, token: access_token, isAuthenticated: true, subscription: null, isSubscriptionActive: true });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Codice accesso non valido');
    }
  },

  register: async (name: string, email: string, password: string, role: string) => {
    try {
      const response = await authAPI.register({ name, email, password, role });
      const { access_token, user } = response.data;
      await AsyncStorage.setItem('token', access_token);
      const subscription = user.subscription || null;
      const isSubscriptionActive = subscription?.is_active || subscription?.status === 'active';
      set({ user, token: access_token, isAuthenticated: true, subscription, isSubscriptionActive });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, subscription: null, isSubscriptionActive: false });
  },

  loadUser: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const response = await authAPI.getMe();
        const user = response.data;
        const subscription = user.subscription || null;
        // Admin users are always active
        const isSubscriptionActive = user.is_admin || subscription?.is_active || subscription?.status === 'active' || subscription?.plan === 'admin';
        set({ user, token, isAuthenticated: true, isLoading: false, subscription, isSubscriptionActive });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      await AsyncStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, subscription: null, isSubscriptionActive: false });
    }
  },

  refreshSubscription: async () => {
    try {
      const response = await authAPI.getSubscription();
      const subscription = response.data;
      // Admin users are always active
      const isSubscriptionActive = subscription?.is_admin || subscription?.is_active || subscription?.status === 'active' || subscription?.plan === 'admin';
      set({ subscription, isSubscriptionActive });
    } catch (error) {
      console.error('Error refreshing subscription:', error);
    }
  },

  updateSubscription: async (plan: string, status: string) => {
    try {
      const response = await authAPI.updateSubscription({ plan, status });
      const subscription = response.data.subscription;
      const isSubscriptionActive = status === 'active';
      set({ subscription: { ...subscription, is_active: isSubscriptionActive }, isSubscriptionActive });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Aggiornamento abbonamento fallito');
    }
  },
}));
