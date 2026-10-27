import { Outlet } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { SafetyChatWidget } from '@/components/chat/SafetyChatWidget'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), [])

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: always visible on lg+, slide-in drawer on mobile */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Sidebar onClose={closeSidebar} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating AI Safety Chat Widget */}
      <SafetyChatWidget />
    </div>
  )
}
