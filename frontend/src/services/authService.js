import { apiClient } from '../api/client';

export const authService = {
  async register(payload) {
    const { data } = await apiClient.post('/auth/register/', payload);
    return data.data || data;
  },
  async login(payload) {
    const { data } = await apiClient.post('/auth/login/', payload);
    return data.data || data;
  },
  async refresh(refresh) {
    const { data } = await apiClient.post('/auth/refresh/', { refresh });
    return data.data || data;
  },
  async profile() {
    const { data } = await apiClient.get('/auth/profile/');
    return data.data || data;
  },
};
