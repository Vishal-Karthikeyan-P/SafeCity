import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  X,
  Minimize2,
  Maximize2,
  Send,
  Sparkles,
  ShieldAlert,
  RotateCcw,
  Phone,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { chatApi, useChatSuggestions, useChatStatus, type ChatMessage } from '@/api/chat'
import { MarkdownMessage } from './MarkdownMessage'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SafetyChatWidget() {
  const {
    isOpen,
    isMinimized,
    isMaximized,
    messages,
    prefilledPrompt,
    openChat,
    closeChat,
    toggleChat,
    setMinimized,
    toggleMaximized,
    addMessage,
    clearMessages,
    setPrefilledPrompt,
  } = useChatStore()

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Auto-grow textarea to match content (max ~6 lines)
  const growTextarea = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 144) + 'px'
  }, [])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { data: suggestionsData } = useChatSuggestions()
  const { data: statusData } = useChatStatus()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, isOpen, isMinimized])

  // Handle prefilled prompt when opened from other pages (e.g., Learning Hub)
  useEffect(() => {
    if (prefilledPrompt) {
      setInput(prefilledPrompt)
      setPrefilledPrompt(null)
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }, [prefilledPrompt, setPrefilledPrompt])

  const handleSend = useCallback(async (textToSend?: string) => {
    const query = (textToSend || input).trim()
    if (!query || isLoading) return

    setErrorMsg(null)
    setInput('')
    // Reset textarea height after clearing
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    addMessage(userMsg)
    setIsLoading(true)

    try {
      // Build lightweight bounded history for API
      const historyPayload = messages
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }))

      const response = await chatApi.sendMessage(query, historyPayload)

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEmergency: response.is_emergency,
        suggestedActions: response.suggested_actions,
        sources: response.sources,
      }

      addMessage(assistantMsg)
    } catch (err: any) {
      const errDetail =
        err?.response?.data?.detail ||
        'Unable to reach safety assistant. Please verify your connection or try again.'
      setErrorMsg(errDetail)
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, addMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value.slice(0, 600))
    growTextarea()
  }

  // ── Render 1: Floating Closed Trigger Button ─────────────────────────────
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 group">
        <button
          onClick={() => openChat()}
          className={cn(
            'flex items-center gap-2.5 px-4 py-3.5 rounded-full shadow-xl transition-all duration-300',
            'bg-gradient-to-r from-blue-600 via-indigo-600 to-primary text-white',
            'hover:shadow-2xl hover:scale-105 active:scale-95 ring-4 ring-primary/20',
            'focus:outline-none focus:ring-4 focus:ring-primary/40'
          )}
          aria-label="Open SafeCity AI Assistant"
          id="safecity-chat-trigger"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <span className="font-semibold text-sm tracking-wide">SafeCity AI</span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium hidden sm:inline-block">
            Safety Help
          </span>
        </button>
      </div>
    )
  }

  // ── Render 2: Minimized Bar ──────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
        <div
          onClick={() => setMinimized(false)}
          className={cn(
            'flex items-center justify-between gap-3 px-4 py-3 rounded-full cursor-pointer shadow-lg',
            'bg-card border border-border text-foreground hover:bg-accent transition-all',
            'ring-2 ring-primary/30'
          )}
          id="safecity-chat-minimized-bar"
        >
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-xs text-foreground">SafeCity AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMinimized(false)
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Expand"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeChat()
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render 3: Messenger-style Chat Window ────────────────────────────────
  return (
    <aside
      aria-label="SafeCity AI Assistant"
      className={cn(
        'fixed z-50 flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden transition-all duration-200',
        isMaximized
          ? 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[95vw] sm:w-[700px] md:w-[820px] h-[88vh] max-h-[850px]'
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[95vw] sm:w-[410px] h-[580px] max-h-[85vh]'
      )}
      id="safecity-chat-window"
    >
      {/* ── Chat Header ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3 border-b border-border/20 flex items-center justify-between select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-sm leading-tight truncate text-white">SafeCity AI</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200">
                Gemini
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              {statusData?.gemini_api_configured ? 'Online • Grounded Safety Hub' : 'Online • Verified Safety Hub'}
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-1 text-slate-300">
          {/* Quick 112 Call Link */}
          <a
            href="tel:112"
            className="flex items-center gap-1 text-[11px] font-bold bg-red-600/90 hover:bg-red-600 text-white px-2 py-1 rounded-md transition-colors mr-1"
            title="Call National Emergency Service (112)"
          >
            <Phone className="w-3 h-3" />
            <span>112</span>
          </a>

          {/* Minimize */}
          <button
            onClick={() => setMinimized(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
            title="Minimize"
            id="chat-btn-minimize"
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Maximize / Restore */}
          <button
            onClick={toggleMaximized}
            className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
            title={isMaximized ? 'Restore size' : 'Expand full-screen'}
            id="chat-btn-maximize"
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close */}
          <button
            onClick={closeChat}
            className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
            title="Close"
            id="chat-btn-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Emergency Quick Banner ─────────────────────────────── */}
      <div className="bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/20 px-3 py-1.5 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="line-clamp-1">Informational tool. Dial <strong>112</strong> for life-safety emergencies.</span>
        </div>
        <button
          onClick={clearMessages}
          className="text-[11px] flex items-center gap-1 text-muted-foreground hover:text-foreground ml-2 flex-shrink-0"
          title="Clear conversation history"
        >
          <RotateCcw className="w-3 h-3" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* ── Message Thread ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-muted/20">
        {messages.map((msg, idx) => (
          <div
            key={msg.id || idx}
            className={cn(
              'flex flex-col max-w-[90%] sm:max-w-[84%]',
              msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            )}
          >
            {/* Bubble */}
            <div
              className={cn(
                'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm overflow-hidden',
                msg.role === 'user'
                  ? 'whitespace-pre-wrap bg-primary text-primary-foreground rounded-br-sm'
                  : msg.isEmergency
                    ? 'bg-red-50 dark:bg-red-950/40 border-2 border-red-500 text-red-900 dark:text-red-100 rounded-bl-sm'
                    : 'bg-card border border-border text-foreground rounded-bl-sm'
              )}
            >
              {msg.isEmergency && (
                <div className="flex items-center gap-1.5 font-bold text-red-600 dark:text-red-400 mb-2 text-xs uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
                  Immediate Danger Protocol
                </div>
              )}
              {msg.role === 'assistant' ? <MarkdownMessage content={msg.content} /> : msg.content}
            </div>

            {/* Suggested actions pills */}
            {msg.suggestedActions && msg.suggestedActions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {msg.suggestedActions.map((action, actionIdx) => (
                  <button
                    key={actionIdx}
                    onClick={() => handleSend(action)}
                    className="text-[11px] font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-2.5 py-1 rounded-full transition-colors"
                  >
                    👉 {action}
                  </button>
                ))}
              </div>
            )}

            {/* Source citations */}
            {msg.sources && msg.sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                <span className="font-semibold">Sources:</span>
                {msg.sources.map((src, srcIdx) => (
                  <span
                    key={srcIdx}
                    className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-foreground/70"
                  >
                    {src}
                  </span>
                ))}
              </div>
            )}

            {/* Timestamp */}
            {msg.timestamp && (
              <span className="text-[10px] text-muted-foreground mt-1 px-1">
                {msg.timestamp}
              </span>
            )}
          </div>
        ))}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-card border border-border text-muted-foreground w-fit mr-auto">
            <Sparkles className="w-4 h-4 text-primary animate-spin" />
            <span className="text-xs font-medium">SafeCity AI is checking safety knowledge...</span>
            <div className="flex gap-1 items-center ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" />
            </div>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="font-bold underline hover:no-underline ml-2 flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Suggested Questions Chips ──────────────────────────── */}
      {suggestionsData?.suggestions && suggestionsData.suggestions.length > 0 && (
        <div className="border-t border-border/60 bg-muted/30 px-3 py-2 overflow-x-auto scrollbar-none flex gap-2">
          {suggestionsData.suggestions.slice(0, 5).map((sug) => (
            <button
              key={sug.id}
              onClick={() => handleSend(sug.question)}
              disabled={isLoading}
              className="text-xs flex items-center gap-1.5 whitespace-nowrap bg-background hover:bg-accent border border-border text-foreground px-3 py-1 rounded-full shadow-xs transition-all flex-shrink-0 disabled:opacity-50"
            >
              <span>{sug.icon}</span>
              <span className="truncate max-w-[200px]">{sug.question}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Input Box & Controls ───────────────────────────────── */}
      <div className="p-3 bg-card border-t border-border">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about SafeCity, SOS, safety laws, first aid..."
              rows={1}
              maxLength={600}
              className="w-full resize-none bg-transparent px-3 py-2.5 text-sm focus:outline-none leading-relaxed"
              style={{ minHeight: '42px', maxHeight: '144px' }}
              disabled={isLoading}
              id="safecity-chat-input"
            />
            {input.length > 400 && (
              <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground font-mono">
                {input.length}/600
              </span>
            )}
          </div>

          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[42px] w-[42px] rounded-xl flex-shrink-0 shadow-sm"
            id="safecity-chat-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-muted-foreground">
          <span>Enter to send • Shift+Enter for newline</span>
          <span>Jurisdiction: India (112)</span>
        </div>
      </div>
    </aside>
  )
}
