import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useCurrentUser } from '@/api/auth'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppLayout() {
  const { data: user } = useCurrentUser()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
