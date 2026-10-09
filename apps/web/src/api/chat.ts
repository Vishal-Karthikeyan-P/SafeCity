import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  isEmergency?: boolean
  suggestedActions?: string[]
  sources?: string[]
}

export interface ChatResponse {
  reply: string
  is_emergency: boolean
  suggested_actions: string[]
  sources: string[]
  grounded: boolean
}

export interface ChatSuggestion {
  id: string
  category: string
  question: string
  icon: string
}

export interface ChatSuggestionsResponse {
  suggestions: ChatSuggestion[]
}

export interface ChatStatus {
  status: string
  service: string
  model: string
  max_output_tokens: number
  gemini_api_configured: boolean
  rate_limit_per_minute: number
  max_message_length: number
  jurisdiction: string
  emergency_number: string
}

export const chatApi = {
  sendMessage: async (message: string, history: { role: string; content: string }[]): Promise<ChatResponse> => {
    const res = await api.post<ChatResponse>('/chat/message', {
      message,
      history,
    })
    return res.data
  },

  getSuggestions: async (): Promise<ChatSuggestionsResponse> => {
    const res = await api.get<ChatSuggestionsResponse>('/chat/suggestions')
    return res.data
  },

  getStatus: async (): Promise<ChatStatus> => {
    const res = await api.get<ChatStatus>('/chat/status')
    return res.data
  },
}

export function useChatSuggestions() {
  return useQuery({
    queryKey: ['chat-suggestions'],
    queryFn: chatApi.getSuggestions,
    staleTime: 1000 * 60 * 30, // 30 minutes
  })
}

export function useChatStatus() {
  return useQuery({
    queryKey: ['chat-status'],
    queryFn: chatApi.getStatus,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
