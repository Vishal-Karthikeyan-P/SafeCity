import { create } from 'zustand';
import { SOSRequest, SOSStatus } from '../types';
import { SOSApi } from '../api/sos';
import { Storage, StorageKeys } from '../utils/storage';

interface SOSState {
  activeSOS: SOSRequest | null;
  selectedContactIds: string[];
  isTriggering: boolean;
  isResolving: boolean;
  isLocating: boolean;
  error: string | null;
  lastLocation: { latitude: number; longitude: number; timestamp: string } | null;

  loadSelectedContactIds: () => Promise<void>;
  toggleContactSelection: (contactId: string) => Promise<void>;
  setSelectedContactIds: (ids: string[]) => Promise<void>;
  checkActiveSOS: () => Promise<SOSRequest | null>;
  triggerSOS: (lat: number, lng: number) => Promise<SOSRequest>;
  updateSOSLocation: (lat: number, lng: number) => Promise<SOSRequest | null>;
  resolveSOS: (status?: SOSStatus) => Promise<SOSRequest | null>;
  clearError: () => void;
  resetSOS: () => void;
}

export const useSOSStore = create<SOSState>((set, get) => ({
  activeSOS: null,
  selectedContactIds: [],
  isTriggering: false,
  isResolving: false,
  isLocating: false,
  error: null,
  lastLocation: null,

  clearError: () => set({ error: null }),
  resetSOS: () => set({ activeSOS: null, lastLocation: null, error: null }),

  loadSelectedContactIds: async () => {
    try {
      const stored = await Storage.getItem(StorageKeys.SELECTED_SOS_CONTACTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          set({ selectedContactIds: parsed });
        }
      }
    } catch {
      // ignore
    }
  },

  toggleContactSelection: async (contactId: string) => {
    const current = get().selectedContactIds;
    let updated: string[];
    if (current.includes(contactId)) {
      updated = current.filter((id) => id !== contactId);
    } else {
      updated = [...current, contactId];
    }
    set({ selectedContactIds: updated });
    try {
      await Storage.setItem(
        StorageKeys.SELECTED_SOS_CONTACTS,
        JSON.stringify(updated)
      );
    } catch {
      // ignore
    }
  },

  setSelectedContactIds: async (ids: string[]) => {
    set({ selectedContactIds: ids });
    try {
      await Storage.setItem(
        StorageKeys.SELECTED_SOS_CONTACTS,
        JSON.stringify(ids)
      );
    } catch {
      // ignore
    }
  },

  checkActiveSOS: async () => {
    try {
      const active = await SOSApi.getActiveSOS();
      if (active && active.status === 'active') {
        set({
          activeSOS: active,
          lastLocation: {
            latitude: active.location_lat,
            longitude: active.location_lng,
            timestamp: active.created_at,
          },
        });
        return active;
      } else {
        set({ activeSOS: null });
        return null;
      }
    } catch (err: any) {
      // ignore 404 or connection failures gracefully
      return null;
    }
  },

  triggerSOS: async (lat: number, lng: number) => {
    set({ isTriggering: true, error: null });
    try {
      const sos = await SOSApi.triggerSOS(lat, lng);
      set({
        activeSOS: sos,
        isTriggering: false,
        lastLocation: {
          latitude: lat,
          longitude: lng,
          timestamp: new Date().toISOString(),
        },
      });
      return sos;
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to trigger SOS emergency.';
      set({ isTriggering: false, error: msg });
      throw new Error(msg);
    }
  },

  updateSOSLocation: async (lat: number, lng: number) => {
    const active = get().activeSOS;
    if (!active) return null;

    set({ isLocating: true });
    try {
      const updated = await SOSApi.updateSOSLocation(lat, lng);
      set({
        activeSOS: updated,
        isLocating: false,
        lastLocation: {
          latitude: lat,
          longitude: lng,
          timestamp: new Date().toISOString(),
        },
      });
      return updated;
    } catch (err: any) {
      set({ isLocating: false });
      // Non-fatal, return null so caller can handle gracefully
      return null;
    }
  },

  resolveSOS: async (status: SOSStatus = 'resolved') => {
    set({ isResolving: true, error: null });
    try {
      const resolved = await SOSApi.resolveSOS(status);
      set({
        activeSOS: null,
        isResolving: false,
        lastLocation: null,
      });
      return resolved;
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to resolve SOS request.';
      set({ isResolving: false, error: msg });
      throw new Error(msg);
    }
  },
}));
