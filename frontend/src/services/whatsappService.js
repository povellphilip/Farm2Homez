import { apiClient } from '../api/client';

export const whatsappService = {
  async send(payload) {
    const { data } = await apiClient.post('/whatsapp/send/', payload);
    return data;
  },
};
