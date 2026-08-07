import { useState } from 'react'
import { Search, Shield, Ban, CheckCircle, UserCog } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAdminUsers, useChangeUserRole } from '@/api/user'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { toast } from 'sonner'
import { formatDate, getImageUrl } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

export function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const { mutate: changeRole } = useChangeUserRole()
  
  const { data, isLoading } = useAdminUsers(page, 15, search)

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await api.patch(`/admin/users/${userId}/deactivate`)
        toast.success('User deactivated')
      } else {
        await api.patch(`/admin/users/${userId}/activate`)
        toast.success('User activated')
      }
      qc.invalidateQueries({ queryKey: ['admin-users'] })
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
          <p className="text-muted-foreground text-sm">View and manage citizen accounts.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search name or email..." 
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
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
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={5} className="p-6 text-center">Loading...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center">No users found</td></tr>
                ) : (
                  users.map((user: any) => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border">
                            <AvatarImage src={user.profile?.avatar_url ? getImageUrl(user.profile.avatar_url) : ''} />
                            <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{user.full_name}</p>
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
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
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
    </div>
  )
}
