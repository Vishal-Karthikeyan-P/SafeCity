import { Platform } from 'react-native';
import { apiClient } from './client';
import { Incident, IncidentCategory, PaginatedList, SeverityLevel, ResolutionRequest, IncidentStatusHistory } from '../types';

export interface CreateIncidentPayload {
  title: string;
  description: string;
  category_id: string;
  severity?: SeverityLevel;   // optional — backend auto-determines this
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

  async getMyIncidents(page: number = 1, limit: number = 15): Promise<PaginatedList<Incident>> {
    const res = await apiClient.get<PaginatedList<Incident>>('/incidents/my', {
      params: { page, limit },
    });
    return res.data;
  },

  async previewSeverity(
    categoryId: string,
    title: string,
    description: string,
  ): Promise<{ severity: string; score: number }> {
    const res = await apiClient.get<{ severity: string; score: number }>(
      '/incidents/preview-severity',
      { params: { category_id: categoryId, title, description } }
    );
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

  async uploadEvidence(uri: string): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'evidence.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

    formData.append('file', {
      uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      name: filename,
      type,
    } as any);

    const res = await apiClient.post<{ url: string; filename: string }>('/incidents/upload-evidence', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async createResolutionRequest(
    incidentId: string,
    explanation: string,
    evidenceUrl?: string
  ): Promise<ResolutionRequest> {
    const res = await apiClient.post<ResolutionRequest>(
      `/incidents/${incidentId}/resolution-requests`,
      {
        explanation,
        evidence_url: evidenceUrl,
      }
    );
    return res.data;
  },

  async getResolutionRequests(incidentId: string): Promise<ResolutionRequest[]> {
    const res = await apiClient.get<ResolutionRequest[]>(
      `/incidents/${incidentId}/resolution-requests`
    );
    return res.data;
  },

  async reviewResolutionRequest(
    incidentId: string,
    requestId: string,
    action: 'approve' | 'reject',
    rejectionReason?: string
  ): Promise<ResolutionRequest> {
    const res = await apiClient.post<ResolutionRequest>(
      `/incidents/${incidentId}/resolution-requests/${requestId}/review`,
      {
        action,
        rejection_reason: rejectionReason,
      }
    );
    return res.data;
  },

  async getStatusHistory(incidentId: string): Promise<IncidentStatusHistory[]> {
    const res = await apiClient.get<IncidentStatusHistory[]>(
      `/incidents/${incidentId}/status-history`
    );
    return res.data;
  },
};
