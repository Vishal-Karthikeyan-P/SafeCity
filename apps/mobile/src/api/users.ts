import { apiClient } from './client';
import { User } from '../types';

export interface UpdateProfilePayload {
  full_name?: string;
  phone?: string;
  bio?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  city?: string;
  country?: string;
}

export const UsersApi = {
  async getMyProfile(): Promise<User> {
    const res = await apiClient.get<User>('/users/me');
    return res.data;
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<User> {
    const res = await apiClient.put<User>('/users/me', payload);
    return res.data;
  },
};
