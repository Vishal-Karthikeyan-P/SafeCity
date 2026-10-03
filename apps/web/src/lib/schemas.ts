import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export const reportIncidentSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category_id: z.string().min(1, 'Select a category'),
  is_anonymous: z.boolean().default(false),
  location_address: z.string().optional(),
  location_lat: z.number({ required_error: 'Location is required' }).min(-90).max(90),
  location_lng: z.number({ required_error: 'Location is required' }).min(-180).max(180),
})

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().optional(),
  bio: z.string().max(500).optional(),
  city: z.string().optional(),
  country: z.string().optional(),
})

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

export const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d+$/, 'OTP must contain only numbers'),
})

export const resetPasswordSchema = z.object({
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type ReportIncidentValues = z.infer<typeof reportIncidentSchema>
export type UpdateProfileValues = z.infer<typeof updateProfileSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type OTPValues = z.infer<typeof otpSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

