import { apiClient } from './client';
import { Incident, IncidentCategory, PaginatedList, SeverityLevel } from '../types';

export interface CreateIncidentPayload {
  title: string;
  description: string;
  category_id: string;
  severity: SeverityLevel;
  location_lat: number;
  location_lng: number;
  location_address?: string;
  is_anonymous?: boolean;
}

export const IncidentsApi = {
  async getCategories(): Promise<IncidentCategory[]> {
    const res = await apiClient.get<IncidentCategory[]>('/incidents/categories');
    return res.data;
  },

  async getNearby(lat: number, lng: number, radiusKm: number = 5.0): Promise<Incident[]> {
    const res = await apiClient.get<Incident[]>('/incidents/nearby', {
      params: {
        lat,
        lng,
        radius_km: radiusKm,
      },
    });
    return res.data;
  },

  async list(page: number = 1, limit: number = 20, status: string = 'approved'): Promise<PaginatedList<Incident>> {
    const res = await apiClient.get<PaginatedList<Incident>>('/incidents', {
      params: {
        page,
        limit,
        status,
      },
    });
    return res.data;
  },

  async create(payload: CreateIncidentPayload): Promise<Incident> {
    const res = await apiClient.post<Incident>('/incidents', payload);
    return res.data;
  },

  async getById(id: string): Promise<Incident> {
    const res = await apiClient.get<Incident>(`/incidents/${id}`);
    return res.data;
  },
};
