import { Platform } from 'react-native';
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

  async getNearby(
    lat: number,
    lng: number,
    radiusKm: number = 10.0,
    categoryId?: string | null,
    severity?: string | null
  ): Promise<Incident[]> {
    const params: Record<string, any> = {
      lat,
      lng,
      radius_km: radiusKm,
    };
    if (categoryId) params.category_id = categoryId;
    if (severity) params.severity = severity;

    const res = await apiClient.get<Incident[]>('/incidents/nearby', { params });
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

  async uploadImages(incidentId: string, imageUris: string[]): Promise<Incident> {
    const formData = new FormData();
    for (const uri of imageUris) {
      const filename = uri.split('/').pop() || 'upload.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

      formData.append('files', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: filename,
        type,
      } as any);
    }

    const res = await apiClient.post<Incident>(`/incidents/${incidentId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async getById(id: string): Promise<Incident> {
    const res = await apiClient.get<Incident>(`/incidents/${id}`);
    return res.data;
  },
};
