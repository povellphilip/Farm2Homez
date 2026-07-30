import { apiClient } from '../api/client';

export const contactService = {
  async submit(payload) {
    const { data } = await apiClient.post('/contact/', payload);
    return data;
  },
};
