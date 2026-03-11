import { create } from 'zustand';
import { athleteAPI, programAPI, notificationAPI, analyticsAPI } from '../services/api';
import { AthleteProfile, TrainingProgram, Notification, ExpiryWarning } from '../types';

interface DataState {
  athletes: AthleteProfile[];
  programs: TrainingProgram[];
  notifications: Notification[];
  warnings: ExpiryWarning[];
  unreadCount: number;
  isLoading: boolean;
  
  // Athletes
  fetchAthletes: () => Promise<void>;
  createAthlete: (data: any) => Promise<AthleteProfile>;
  updateAthlete: (id: string, data: any) => Promise<void>;
  deleteAthlete: (id: string) => Promise<void>;
  
  // Programs
  fetchPrograms: (athleteId?: string) => Promise<void>;
  createProgram: (data: any) => Promise<TrainingProgram>;
  updateProgram: (id: string, data: any) => Promise<void>;
  deleteProgram: (id: string) => Promise<void>;
  
  // Notifications
  fetchNotifications: () => Promise<void>;
  createNotification: (data: any) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  
  // Warnings
  checkExpiries: () => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
  athletes: [],
  programs: [],
  notifications: [],
  warnings: [],
  unreadCount: 0,
  isLoading: false,

  // Athletes
  fetchAthletes: async () => {
    set({ isLoading: true });
    try {
      const response = await athleteAPI.getAll();
      set({ athletes: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  createAthlete: async (data: any) => {
    const response = await athleteAPI.create(data);
    const newAthlete = response.data;
    set((state) => ({ athletes: [...state.athletes, newAthlete] }));
    return newAthlete;
  },

  updateAthlete: async (id: string, data: any) => {
    await athleteAPI.update(id, data);
    const response = await athleteAPI.getOne(id);
    set((state) => ({
      athletes: state.athletes.map((a) => (a.id === id ? response.data : a)),
    }));
  },

  deleteAthlete: async (id: string) => {
    await athleteAPI.delete(id);
    set((state) => ({
      athletes: state.athletes.filter((a) => a.id !== id),
    }));
  },

  // Programs
  fetchPrograms: async (athleteId?: string) => {
    set({ isLoading: true });
    try {
      const response = await programAPI.getAll(athleteId);
      set({ programs: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  createProgram: async (data: any) => {
    const response = await programAPI.create(data);
    const newProgram = response.data;
    set((state) => ({ programs: [...state.programs, newProgram] }));
    return newProgram;
  },

  updateProgram: async (id: string, data: any) => {
    await programAPI.update(id, data);
    const response = await programAPI.getOne(id);
    set((state) => ({
      programs: state.programs.map((p) => (p.id === id ? response.data : p)),
    }));
  },

  deleteProgram: async (id: string) => {
    await programAPI.delete(id);
    set((state) => ({
      programs: state.programs.filter((p) => p.id !== id),
    }));
  },

  // Notifications
  fetchNotifications: async () => {
    try {
      const [notifResponse, countResponse] = await Promise.all([
        notificationAPI.getAll(),
        notificationAPI.getUnreadCount(),
      ]);
      set({
        notifications: notifResponse.data,
        unreadCount: countResponse.data.count,
      });
    } catch (error: any) {
      // Ignora errori 401/403 silenziosamente (utente non autorizzato)
      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        console.error('Error fetching notifications:', error);
      }
      set({ notifications: [], unreadCount: 0 });
    }
  },

  createNotification: async (data: any) => {
    await notificationAPI.create(data);
  },

  markNotificationRead: async (id: string) => {
    await notificationAPI.markRead(id);
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllNotificationsRead: async () => {
    // Elimina tutte le notifiche invece di solo marcarle come lette
    await notificationAPI.deleteAll();
    set({ notifications: [], unreadCount: 0 });
  },

  deleteNotification: async (id: string) => {
    await notificationAPI.delete(id);
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: Math.max(0, state.unreadCount - (state.notifications.find(n => n.id === id && !n.read) ? 1 : 0)),
    }));
  },

  deleteAllNotifications: async () => {
    await notificationAPI.deleteAll();
    set({ notifications: [], unreadCount: 0 });
  },

  // Warnings
  checkExpiries: async () => {
    try {
      const response = await analyticsAPI.checkExpiries();
      set({ warnings: response.data.warnings || [] });
    } catch (error: any) {
      // Ignora errori 401/403 silenziosamente
      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        console.error('Error checking expiries:', error);
      }
      set({ warnings: [] });
    }
  },
}));
