import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Save, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/auth'
import { useUpdateProfile, useChangePassword, useUploadAvatar, useEmergencyContacts, useDeleteEmergencyContact, useAddEmergencyContact, useDeleteAccount } from '@/api/user'
import { updateProfileSchema, changePasswordSchema, type UpdateProfileValues, type ChangePasswordValues } from '@/lib/schemas'
import { getImageUrl } from '@/lib/utils'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile()
  const { mutate: changePassword, isPending: isChangingPwd } = useChangePassword()
  const { mutate: uploadAvatar, isPending: isUploadingAvatar } = useUploadAvatar()
  
  const { data: contacts, isLoading: contactsLoading } = useEmergencyContacts()
  const { mutate: deleteContact } = useDeleteEmergencyContact()
  const { mutate: addContact } = useAddEmergencyContact()
  const { mutate: deleteAccount } = useDeleteAccount()

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

                <div className="flex justify-end pt-4">
                  <Button type="submit" loading={isUpdating}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Emergency Contacts</CardTitle>
              <CardDescription>People to notify during an SOS emergency (max 5).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contactsLoading ? (
                <p className="text-sm text-gray-500">Loading contacts...</p>
              ) : contacts?.length === 0 ? (
                <p className="text-sm text-gray-500">No emergency contacts added yet.</p>
              ) : (
                <div className="space-y-3">
                  {contacts?.map((contact: any) => (
                    <div key={contact.id} className="flex justify-between items-center p-3 border rounded-md">
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-sm text-gray-500">{contact.phone} • {contact.contact_relation}</p>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => deleteContact(contact.id)}>Remove</Button>
                    </div>
                  ))}
                </div>
              )}
              
              {(!contacts || contacts.length < 5) && (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    addContact({
                      name: fd.get('name') as string,
                      phone: fd.get('phone') as string,
                      contact_relation: fd.get('relation') as string,
                    }, {
                      onSuccess: () => {
                         // @ts-ignore
                         e.target.reset()
                      }
                    })
                  }} 
                  className="pt-4 border-t mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  <Input name="name" placeholder="Name" required />
                  <Input name="phone" placeholder="Phone" required />
                  <Input name="relation" placeholder="Relation (e.g. Brother)" required />
                  <Button type="submit" className="sm:col-span-3">Add Contact</Button>
                </form>
              )}
            </CardContent>
          </Card>
          
          <Card className="mt-6 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>Permanently delete your account and all associated data.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => {
                if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                   deleteAccount()
                }
              }}>
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
