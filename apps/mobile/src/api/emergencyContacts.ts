import { apiClient } from './client';
import {
  EmergencyContact,
  EmergencyContactCreate,
  EmergencyContactUpdate,
} from '../types';

export const EmergencyContactsApi = {
  /**
   * List all registered emergency contacts for current user.
   */
  async listContacts(): Promise<EmergencyContact[]> {
    const res = await apiClient.get<EmergencyContact[]>('/users/me/contacts');
    return res.data;
  },

  /**
   * Add a new emergency contact (max 5 enforced by backend).
   */
  async addContact(data: EmergencyContactCreate): Promise<EmergencyContact> {
    const res = await apiClient.post<EmergencyContact>('/users/me/contacts', data);
    return res.data;
  },

  /**
   * Update an existing emergency contact.
   */
  async updateContact(
    contactId: string,
    data: EmergencyContactUpdate
  ): Promise<EmergencyContact> {
    const res = await apiClient.patch<EmergencyContact>(
      `/users/me/contacts/${contactId}`,
      data
    );
    return res.data;
  },

  /**
   * Delete an emergency contact.
   */
  async deleteContact(contactId: string): Promise<void> {
    await apiClient.delete(`/users/me/contacts/${contactId}`);
  },
};
