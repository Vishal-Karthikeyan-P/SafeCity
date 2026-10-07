import { useState } from 'react'
import { Search, Shield, Ban, CheckCircle, UserCog, Eye, Phone, MapPin, Calendar, Mail, User as UserIcon, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useAdminUsers, useChangeUserRole } from '@/api/user'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { toast } from 'sonner'
import { formatDate, getImageUrl } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

export function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [detailUser, setDetailUser] = useState<any | null>(null)

  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const { mutate: changeRole } = useChangeUserRole()
  
  const { data, isLoading } = useAdminUsers(
    page,
    15,
    search,
    roleFilter === 'all' ? '' : roleFilter
  )

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await api.patch(`/admin/users/${userId}/deactivate`)
        toast.success('User account deactivated')
      } else {
        await api.patch(`/admin/users/${userId}/activate`)
        toast.success('User account activated')
      }
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      if (detailUser && detailUser.id === userId) {
        setDetailUser({ ...detailUser, is_active: !currentStatus })
      }
    } catch (err) {
      // handled by interceptor
    }
  }

  const users = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Users</h1>
          <p className="text-muted-foreground text-sm">View, search, filter, and manage user accounts.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search name or email..." 
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1) }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="citizen">Citizens</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Incidents</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No users found</td></tr>
                ) : (
                  users.map((user: any) => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setDetailUser(user)}>
                          <Avatar className="w-10 h-10 border">
                            <AvatarImage src={user.profile?.avatar_url ? getImageUrl(user.profile.avatar_url) : ''} />
                            <AvatarFallback>{user.full_name?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground hover:underline">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.role === 'admin' ? (
                          <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50 dark:bg-purple-900/20">
                            <Shield className="w-3 h-3 mr-1" /> Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Citizen</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 dark:bg-green-900/20">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50 dark:bg-red-900/20">Inactive</Badge>
                        )}
                      </td>
                      {/* Incidents Reported */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            (user.incidents_count ?? 0) === 0
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          {user.incidents_count ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Details Modal */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => setDetailUser(user)}
                            title="View User Details"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Details
                          </Button>

                          {currentUser?.id !== user.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={user.role === 'admin'
                                ? "text-purple-500 hover:text-purple-600 hover:bg-purple-50"
                                : "text-blue-500 hover:text-blue-600 hover:bg-blue-50"}
                              onClick={() => changeRole({ userId: user.id, role: user.role === 'admin' ? 'citizen' : 'admin' })}
                              title={user.role === 'admin' ? 'Demote to Citizen' : 'Promote to Admin'}
                            >
                              <UserCog className="w-4 h-4 mr-1" />
                              {user.role === 'admin' ? 'Demote' : 'Promote'}
                            </Button>
                          )}
                          {user.role !== 'admin' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className={user.is_active ? "text-red-500 hover:text-red-600 hover:bg-red-50" : "text-green-500 hover:text-green-600 hover:bg-green-50"}
                              onClick={() => toggleUserStatus(user.id, user.is_active)}
                            >
                              {user.is_active ? <Ban className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                              {user.is_active ? 'Suspend' : 'Activate'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <span className="text-sm text-muted-foreground">Showing page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Modal */}
      <Dialog open={!!detailUser} onOpenChange={(open) => !open && setDetailUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              User Profile Details
            </DialogTitle>
          </DialogHeader>
          {detailUser && (
            <div className="space-y-4 py-3">
              <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-xl border">
                <Avatar className="w-14 h-14 border-2 border-primary/20">
                  <AvatarImage src={detailUser.profile?.avatar_url ? getImageUrl(detailUser.profile.avatar_url) : ''} />
                  <AvatarFallback className="text-lg font-bold">{detailUser.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{detailUser.full_name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3" /> {detailUser.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {detailUser.role === 'admin' ? (
                      <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50 text-[10px]">
                        <Shield className="w-3 h-3 mr-1" /> Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Citizen</Badge>
                    )}
                    {detailUser.is_active ? (
                      <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 text-[10px]">Active Account</Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50 text-[10px]">Deactivated</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 p-3 rounded-lg border">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" /> Member Since
                  </p>
                  <p className="font-medium text-xs">{formatDate(detailUser.created_at)}</p>
                </div>
                <div className="bg-muted/20 p-3 rounded-lg border">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <Phone className="w-3.5 h-3.5 text-green-500" /> Phone
                  </p>
                  <p className="font-medium text-xs">{detailUser.profile?.phone || 'Not provided'}</p>
                </div>
                <div className="bg-muted/20 p-3 rounded-lg border">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <FileText className="w-3.5 h-3.5 text-primary" /> Incidents Reported
                  </p>
                  <p className="font-bold text-sm text-primary">{detailUser.incidents_count ?? 0}</p>
                </div>
                <div className="bg-muted/20 p-3 rounded-lg border">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" /> Location
                  </p>
                  <p className="font-medium text-xs">
                    {[detailUser.profile?.city, detailUser.profile?.country].filter(Boolean).join(', ') || 'Not specified'}
                  </p>
                </div>
              </div>

              {detailUser.profile?.bio && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Bio</p>
                  <p className="text-xs leading-relaxed bg-muted/30 p-2.5 rounded-lg border">{detailUser.profile.bio}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailUser(null)}>Close</Button>
            {detailUser && currentUser?.id !== detailUser.id && detailUser.role !== 'admin' && (
              <Button
                variant={detailUser.is_active ? 'danger' : 'safe'}
                onClick={() => toggleUserStatus(detailUser.id, detailUser.is_active)}
              >
                {detailUser.is_active ? 'Suspend Account' : 'Activate Account'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
