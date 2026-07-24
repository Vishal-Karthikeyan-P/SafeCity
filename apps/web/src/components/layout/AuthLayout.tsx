import { Outlet } from 'react-router-dom'
import { Shield } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-safe-700 flex">
      {/* Left: Brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-safe-400 blur-3xl" />
        </div>

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">SafeCity</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <h1 className="text-5xl font-bold text-white leading-tight mb-4">
            Making Cities <br />
            <span className="text-safe-300">Safer Together</span>
          </h1>
          <p className="text-primary-200 text-lg max-w-md">
            Report incidents, track safety concerns, and collaborate with your community to build a safer city for everyone.
          </p>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-6">
            {[
              { value: '50K+', label: 'Reports Filed' },
              { value: '200+', label: 'Cities' },
              { value: '98%', label: 'Resolution Rate' },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-primary-300 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-primary-400 text-sm">
          © 2024 SafeCity. All rights reserved.
        </p>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Shield className="w-7 h-7 text-white" />
            <span className="text-2xl font-bold text-white">SafeCity</span>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
