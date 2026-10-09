import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage } from '@/api/chat'

interface ChatState {
  isOpen: boolean
  isMinimized: boolean
  isMaximized: boolean
  messages: ChatMessage[]
  prefilledPrompt: string | null

  // Actions
  openChat: (prefilled?: string) => void
  closeChat: () => void
  toggleChat: () => void
  setMinimized: (minimized: boolean) => void
  setMaximized: (maximized: boolean) => void
  toggleMaximized: () => void
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  setPrefilledPrompt: (prompt: string | null) => void
}

const INITIAL_GREETING: ChatMessage = {
  id: 'welcome_1',
  role: 'assistant',
  content:
    "Hello! I am your **SafeCity AI Assistant** powered by Gemini.\n\nI can help you with:\n• Using SafeCity features (SOS, Safe Route, Live Map, Incident Reporting)\n• Emergency do's and don'ts, procedures & first aid\n• Official Indian emergency helplines (112, 1091, 1098, 1930)\n• Verified legal rights (POSH Act, POCSO Act, IT Act, BNS/IPC)\n• Learning Hub safety guides\n\nHow can I help keep you safe today?",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  sources: ['SafeCity Verified Safety Knowledge'],
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      messages: [INITIAL_GREETING],
      prefilledPrompt: null,

      openChat: (prefilled?: string) =>
        set((state) => ({
          isOpen: true,
          isMinimized: false,
          prefilledPrompt: prefilled || state.prefilledPrompt,
        })),

      closeChat: () => set({ isOpen: false, isMinimized: false, isMaximized: false }),

      toggleChat: () =>
        set((state) => ({
          isOpen: !state.isOpen,
          isMinimized: false,
        })),

      setMinimized: (minimized) => set({ isMinimized: minimized }),

      setMaximized: (maximized) => set({ isMaximized: maximized }),

      toggleMaximized: () => set((state) => ({ isMaximized: !state.isMaximized })),

      addMessage: (msg) =>
        set((state) => ({
          messages: [...state.messages, msg],
        })),

      clearMessages: () =>
        set({
          messages: [
            {
              ...INITIAL_GREETING,
              id: `welcome_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ],
        }),

      setPrefilledPrompt: (prompt) => set({ prefilledPrompt: prompt }),
    }),
    {
      name: 'safecity_chat_session',
      partialize: (state) => ({
        messages: state.messages.slice(-20), // Persist last 20 messages in session
      }),
    }
  )
)
