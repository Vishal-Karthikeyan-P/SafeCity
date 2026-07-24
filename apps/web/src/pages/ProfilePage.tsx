import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Save, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/auth'
import { useUpdateProfile, useChangePassword, useUploadAvatar } from '@/api/user'
import { updateProfileSchema, changePasswordSchema, type UpdateProfileValues, type ChangePasswordValues } from '@/lib/schemas'
import { getImageUrl } from '@/lib/utils'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile()
  const { mutate: changePassword, isPending: isChangingPwd } = useChangePassword()
  const { mutate: uploadAvatar, isPending: isUploadingAvatar } = useUploadAvatar()

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      phone: user?.profile?.phone || '',
      bio: user?.profile?.bio || '',
      city: user?.profile?.city || '',
      country: user?.profile?.country || '',
      emergency_contact_name: user?.profile?.emergency_contact_name || '',
      emergency_contact_phone: user?.profile?.emergency_contact_phone || '',
    },
  })

  const {
    register: registerPwd,
    handleSubmit: handlePwdSubmit,
    reset: resetPwd,
    formState: { errors: pwdErrors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onProfileSubmit = (data: UpdateProfileValues) => updateProfile(data)
  const onPwdSubmit = (data: ChangePasswordValues) => changePassword(data, { onSuccess: () => resetPwd() })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      uploadAvatar(e.target.files[0])
    }
  }

  if (!user) return null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="relative inline-block group">
                <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-background shadow-lg">
                  <AvatarImage src={user.profile?.avatar_url ? getImageUrl(user.profile.avatar_url) : ''} />
                  <AvatarFallback className="text-3xl">{user.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <label className="absolute bottom-4 right-0 bg-primary text-white p-2 rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
                  <Camera className="w-4 h-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={isUploadingAvatar} />
                </label>
              </div>
              <h2 className="text-xl font-bold">{user.full_name}</h2>
              <p className="text-muted-foreground text-sm">{user.email}</p>
              <div className="mt-4 inline-flex items-center justify-center px-3 py-1 rounded-full bg-accent text-xs font-semibold uppercase tracking-wider">
                {user.role}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4" /> Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePwdSubmit(onPwdSubmit)} className="space-y-4">
                <div>
                  <Input type="password" placeholder="Current Password" error={pwdErrors.current_password?.message} {...registerPwd('current_password')} />
                </div>
                <div>
                  <Input type="password" placeholder="New Password" error={pwdErrors.new_password?.message} {...registerPwd('new_password')} />
                </div>
                <div>
                  <Input type="password" placeholder="Confirm New Password" error={pwdErrors.confirm_password?.message} {...registerPwd('confirm_password')} />
                </div>
                <Button type="submit" className="w-full" loading={isChangingPwd}>Update Password</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
              <CardDescription>Update your personal information and contact details.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="full_name">Full Name</label>
                    <Input id="full_name" error={profileErrors.full_name?.message} {...registerProfile('full_name')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="phone">Phone Number</label>
                    <Input id="phone" {...registerProfile('phone')} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="bio">Bio</label>
                  <Textarea id="bio" placeholder="Tell us about yourself..." className="h-24" {...registerProfile('bio')} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="city">City</label>
                    <Input id="city" {...registerProfile('city')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="country">Country</label>
                    <Input id="country" {...registerProfile('country')} />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-semibold text-sm mb-4">Emergency Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" htmlFor="em_name">Name</label>
                      <Input id="em_name" {...registerProfile('emergency_contact_name')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" htmlFor="em_phone">Phone</label>
                      <Input id="em_phone" {...registerProfile('emergency_contact_phone')} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" loading={isUpdating}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
