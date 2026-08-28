import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, KeyRound, Lock, ArrowRight, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useForgotPassword, useVerifyResetOTP, useResetPassword } from '@/api/auth'
import {
  forgotPasswordSchema, otpSchema, resetPasswordSchema,
  type ForgotPasswordValues, type OTPValues, type ResetPasswordValues
} from '@/lib/schemas'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [userEmail, setUserEmail] = useState('')
  const [resetToken, setResetToken] = useState('')

  // Step 1: Request OTP
  const { mutate: requestOTP, isPending: isRequestingOTP } = useForgotPassword()
  const step1Form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  // Step 2: Verify OTP
  const { mutate: verifyOTP, isPending: isVerifyingOTP } = useVerifyResetOTP()
  const step2Form = useForm<OTPValues>({
    resolver: zodResolver(otpSchema),
  })

  // Step 3: Reset Password
  const { mutate: resetPass, isPending: isResetting } = useResetPassword()
  const step3Form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const handleStep1Submit = (data: ForgotPasswordValues) => {
    setUserEmail(data.email)
    requestOTP(data, {
      onSuccess: (res) => {
        toast.success(res.message || 'OTP sent to your email if registered.')
        setStep(2)
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.detail || 'Failed to request OTP. Please try again.')
      },
    })
  }

  const handleStep2Submit = (data: OTPValues) => {
    verifyOTP(
      { email: userEmail, otp: data.otp },
      {
        onSuccess: (res) => {
          setResetToken(res.reset_token)
          toast.success('OTP verified successfully!')
          setStep(3)
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.detail || 'Invalid or expired OTP.')
        },
      }
    )
  }

  const handleStep3Submit = (data: ResetPasswordValues) => {
    resetPass(
      {
        reset_token: resetToken,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      },
      {
        onSuccess: () => {
          toast.success('Password reset successfully!')
          setStep(4)
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.detail || 'Failed to reset password. Please try again.')
        },
      }
    )
  }

  const handleResendOTP = () => {
    if (!userEmail) return
    requestOTP(
      { email: userEmail },
      {
        onSuccess: () => {
          toast.success('A new OTP has been sent to your email.')
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.detail || 'Please wait before requesting a new OTP.')
        },
      }
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Progress Stepper Header */}
      <div className="mb-6 flex items-center justify-between px-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-colors ${
                step === s
                  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                  : step > s
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`h-0.5 w-8 md:w-12 transition-colors ${
                  step > s ? 'bg-green-500' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Email Form */}
      {step === 1 && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Forgot Password
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Enter your registered email address and we'll send you a 6-digit OTP code.
            </p>
          </div>

          <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="forgot-email">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  error={step1Form.formState.errors.email?.message}
                  {...step1Form.register('email')}
                />
              </div>
            </div>

            <Button
              id="forgot-submit"
              type="submit"
              className="w-full"
              size="lg"
              loading={isRequestingOTP}
            >
              Send OTP Code
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Sign In
            </Link>
          </div>
        </div>
      )}

      {/* Step 2: OTP Verification Form */}
      {step === 2 && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Enter Verification OTP
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              We've sent a 6-digit code to <strong className="text-foreground">{userEmail}</strong>.
              Enter it below to verify.
            </p>
          </div>

          <form onSubmit={step2Form.handleSubmit(handleStep2Submit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="otp-code">
                6-Digit OTP Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="otp-code"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  className="pl-9 letter-spacing-2 font-mono text-lg tracking-widest"
                  error={step2Form.formState.errors.otp?.message}
                  {...step2Form.register('otp')}
                />
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 border border-amber-200 dark:border-amber-800">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>The OTP is valid for 10 minutes and can only be used once. Never share this code.</span>
            </div>

            <Button
              id="verify-otp-submit"
              type="submit"
              className="w-full"
              size="lg"
              loading={isVerifyingOTP}
            >
              Verify OTP
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Change Email
            </button>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={isRequestingOTP}
              className="text-primary font-medium hover:underline disabled:opacity-50"
            >
              Resend OTP
            </button>
          </div>
        </div>
      )}

      {/* Step 3: New Password Form */}
      {step === 3 && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Set New Password
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Your identity has been verified. Create a strong new password for your account.
            </p>
          </div>

          <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="new-password">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  error={step3Form.formState.errors.new_password?.message}
                  {...step3Form.register('new_password')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  error={step3Form.formState.errors.confirm_password?.message}
                  {...step3Form.register('confirm_password')}
                />
              </div>
            </div>

            <Button
              id="reset-password-submit"
              type="submit"
              className="w-full"
              size="lg"
              loading={isResetting}
            >
              Reset Password
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </div>
      )}

      {/* Step 4: Success Screen */}
      {step === 4 && (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Password Reset Complete!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-sm mx-auto">
            Your password has been securely updated. You can now sign in with your new credentials.
          </p>

          <Button
            id="back-to-login"
            onClick={() => navigate('/login')}
            className="w-full"
            size="lg"
          >
            Sign In Now
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
