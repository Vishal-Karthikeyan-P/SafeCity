import { apiClient } from './client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isEmergency?: boolean;
  suggestedActions?: string[];
  sources?: string[];
}

export interface ChatResponse {
  reply: string;
  is_emergency: boolean;
  suggested_actions: string[];
  sources: string[];
  grounded: boolean;
}

export interface ChatSuggestion {
  id: string;
  category: string;
  question: string;
  icon: string;
}

export interface ChatSuggestionsResponse {
  suggestions: ChatSuggestion[];
}

export interface ChatStatus {
  status: string;
  service: string;
  model: string;
  gemini_api_configured: boolean;
  rate_limit_per_minute: number;
  max_message_length: number;
  jurisdiction: string;
  emergency_number: string;
}

export const ChatApi = {
  async sendMessage(
    message: string,
    history: Array<{ role: string; content: string }> = []
  ): Promise<ChatResponse> {
    const res = await apiClient.post<ChatResponse>('/chat/message', {
      message,
      history,
    });
    return res.data;
  },

  async getSuggestions(): Promise<ChatSuggestionsResponse> {
    const res = await apiClient.get<ChatSuggestionsResponse>('/chat/suggestions');
    return res.data;
  },

  async getStatus(): Promise<ChatStatus> {
    const res = await apiClient.get<ChatStatus>('/chat/status');
    return res.data;
  },
};
