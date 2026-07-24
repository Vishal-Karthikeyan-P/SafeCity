import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
        <ShieldAlert className="w-12 h-12 text-red-500" />
      </div>
      <h1 className="text-4xl font-bold mb-3">404</h1>
      <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        The page you are looking for doesn't exist or has been moved. Let's get you back to safety.
      </p>
      <Button asChild size="lg">
        <Link to="/dashboard">Return to Dashboard</Link>
      </Button>
    </div>
  )
}
