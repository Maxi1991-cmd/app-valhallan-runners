import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const authAPI = {
  register: (data: { email: string; password: string; name: string; role: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  getSubscription: () => api.get('/auth/subscription'),
  updateSubscription: (data: { plan: string; status: string }) => api.put('/auth/subscription', data),
};

// Athlete APIs
export const athleteAPI = {
  create: (data: any) => api.post('/athletes', data),
  getAll: () => api.get('/athletes'),
  getOne: (id: string) => api.get(`/athletes/${id}`),
  update: (id: string, data: any) => api.put(`/athletes/${id}`, data),
  delete: (id: string) => api.delete(`/athletes/${id}`),
  addPayment: (athleteId: string, data: any) => api.post(`/athletes/${athleteId}/payments`, data),
  updatePayment: (athleteId: string, paymentId: string, paid: boolean) =>
    api.put(`/athletes/${athleteId}/payments/${paymentId}?paid=${paid}`),
};

// Training Program APIs
export const programAPI = {
  create: (data: any) => api.post('/programs', data),
  getAll: (athleteId?: string) => api.get('/programs', { params: { athlete_id: athleteId } }),
  getOne: (id: string) => api.get(`/programs/${id}`),
  update: (id: string, data: any) => api.put(`/programs/${id}`, data),
  delete: (id: string) => api.delete(`/programs/${id}`),
  completeWorkout: (programId: string, workoutId: string, actualData?: any) =>
    api.put(`/programs/${programId}/workouts/${workoutId}/complete`, actualData),
};

// Notification APIs
export const notificationAPI = {
  create: (data: any) => api.post('/notifications', data),
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete('/notifications'),
};

// Activity APIs
export const activityAPI = {
  create: (data: any) => api.post('/activities', data),
  getAll: (athleteId: string, startDate?: string, endDate?: string) =>
    api.get('/activities', { params: { athlete_id: athleteId, start_date: startDate, end_date: endDate } }),
};

// Analytics APIs
export const analyticsAPI = {
  getAthleteAnalytics: (athleteId: string, period: string = 'month') =>
    api.get(`/analytics/athlete/${athleteId}`, { params: { period } }),
  checkExpiries: () => api.get('/check-expiries'),
};

export default api;
