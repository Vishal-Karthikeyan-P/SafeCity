import { apiClient } from './client';

export interface UserSearchResult {
  id: string;
  full_name: string;
  email: string;
}

export interface ContactRequest {
  id: string;
  requester_id: string;
  contact_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  message?: string | null;
  requester?: UserSearchResult | null;
  contact?: UserSearchResult | null;
  created_at: string;
  updated_at: string;
}

export const ContactRequestsApi = {
  /** Search SafeCity users by name or email */
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    const res = await apiClient.get<UserSearchResult[]>('/contacts/search', {
      params: { q: query },
    });
    return res.data;
  },

  /** Send an emergency contact request */
  async sendRequest(contact_id: string, message?: string): Promise<ContactRequest> {
    const res = await apiClient.post<ContactRequest>('/contacts/requests', {
      contact_id,
      message: message || undefined,
    });
    return res.data;
  },

  /** List incoming (pending) requests sent to me */
  async listIncoming(): Promise<ContactRequest[]> {
    const res = await apiClient.get<ContactRequest[]>('/contacts/requests/incoming');
    return res.data;
  },

  /** List outgoing requests I sent */
  async listOutgoing(): Promise<ContactRequest[]> {
    const res = await apiClient.get<ContactRequest[]>('/contacts/requests/outgoing');
    return res.data;
  },

  /** Accept an incoming request */
  async acceptRequest(requestId: string): Promise<ContactRequest> {
    const res = await apiClient.patch<ContactRequest>(`/contacts/requests/${requestId}/accept`);
    return res.data;
  },

  /** Reject an incoming request */
  async rejectRequest(requestId: string): Promise<ContactRequest> {
    const res = await apiClient.patch<ContactRequest>(`/contacts/requests/${requestId}/reject`);
    return res.data;
  },

  /** Revoke a pending request or remove an accepted contact */
  async deleteRequest(requestId: string): Promise<void> {
    await apiClient.delete(`/contacts/requests/${requestId}`);
  },

  /** List all accepted emergency contacts */
  async listAccepted(): Promise<ContactRequest[]> {
    const res = await apiClient.get<ContactRequest[]>('/contacts');
    return res.data;
  },

  /** Register push token with backend */
  async registerPushToken(push_token: string): Promise<void> {
    await apiClient.post('/contacts/push-token', { push_token });
  },

  /** Notify backend of current location for proximity-based notifications */
  async checkLocation(lat: number, lng: number): Promise<void> {
    await apiClient.post('/contacts/location-check', { lat, lng });
  },

  /** Aliases for convenience */
  getAcceptedContacts: async (): Promise<ContactRequest[]> => ContactRequestsApi.listAccepted(),
  getIncomingRequests: async (): Promise<ContactRequest[]> => ContactRequestsApi.listIncoming(),
};

export const contactRequestsApi = ContactRequestsApi;
