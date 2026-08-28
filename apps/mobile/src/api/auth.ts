import { apiClient } from './client';
import { AuthTokens, User } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export const AuthApi = {
  async login(payload: LoginPayload): Promise<AuthTokens> {
    const res = await apiClient.post<AuthTokens>('/auth/login', payload);
    return res.data;
  },

  async register(payload: RegisterPayload): Promise<AuthTokens> {
    const res = await apiClient.post<AuthTokens>('/auth/register', payload);
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },
};
