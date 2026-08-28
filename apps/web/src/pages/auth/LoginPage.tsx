import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogin } from '@/api/auth'
import { loginSchema, type LoginValues } from '@/lib/schemas'

export function LoginPage() {
  const { mutate: login, isPending } = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = (data: LoginValues) => login(data)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Sign in to your SafeCity account
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="login-email">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              className="pl-9"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="login-password">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs text-primary font-medium hover:underline">
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••"
              className="pl-9"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>
        </div>


        <Button
          id="login-submit"
          type="submit"
          className="w-full"
          size="lg"
          loading={isPending}
        >
          Sign In
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Create one now
          </Link>
        </p>
      </div>
    </div>
  )
}
