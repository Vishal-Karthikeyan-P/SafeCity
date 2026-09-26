import { apiClient } from './client';
import { SOSRequest, SOSStatus } from '../types';

export const SOSApi = {
  /**
   * Check if the authenticated user currently has an active SOS emergency.
   */
  async getActiveSOS(): Promise<SOSRequest | null> {
    try {
      const res = await apiClient.get<SOSRequest | null>('/sos/active');
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Trigger a new SOS emergency event with current GPS coordinates.
   */
  async triggerSOS(location_lat: number, location_lng: number): Promise<SOSRequest> {
    const res = await apiClient.post<SOSRequest>('/sos', {
      location_lat,
      location_lng,
    });
    return res.data;
  },

  /**
   * Periodically stream live foreground GPS updates while SOS is active.
   */
  async updateSOSLocation(location_lat: number, location_lng: number): Promise<SOSRequest> {
    const res = await apiClient.patch<SOSRequest>('/sos/location', {
      location_lat,
      location_lng,
    });
    return res.data;
  },

  /**
   * Resolve or cancel active SOS emergency.
   */
  async resolveSOS(status: SOSStatus = 'resolved'): Promise<SOSRequest> {
    const res = await apiClient.patch<SOSRequest>('/sos/resolve', {
      status,
    });
    return res.data;
  },
};
