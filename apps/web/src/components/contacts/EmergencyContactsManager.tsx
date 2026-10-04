import { useState } from 'react'
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Trash2,
  Clock,
  ShieldAlert,
  Send,
  MessageSquare,
  AlertCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  useSearchUsers,
  useAcceptedContacts,
  useIncomingContactRequests,
  useOutgoingContactRequests,
  useSendContactRequest,
  useAcceptContactRequest,
  useRejectContactRequest,
  useDeleteContactRequest,
} from '@/api/contacts'
import { formatDate } from '@/lib/utils'

export function EmergencyContactsManager() {
  const [activeTab, setActiveTab] = useState<'contacts' | 'incoming' | 'outgoing' | 'search'>('contacts')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserToRequest, setSelectedUserToRequest] = useState<any | null>(null)
  const [requestMessage, setRequestMessage] = useState('')

  const { data: accepted = [], isLoading: loadingAccepted } = useAcceptedContacts()
  const { data: incoming = [], isLoading: loadingIncoming } = useIncomingContactRequests()
  const { data: outgoing = [], isLoading: loadingOutgoing } = useOutgoingContactRequests()
  const { data: searchResults = [], isFetching: isSearching } = useSearchUsers(searchQuery)

  const { mutate: sendRequest, isPending: isSending } = useSendContactRequest()
  const { mutate: acceptRequest, isPending: isAccepting } = useAcceptContactRequest()
  const { mutate: rejectRequest, isPending: isRejecting } = useRejectContactRequest()
  const { mutate: deleteContact, isPending: isDeleting } = useDeleteContactRequest()

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserToRequest) return
    sendRequest(
      {
        contact_id: selectedUserToRequest.id,
        message: requestMessage.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSelectedUserToRequest(null)
          setRequestMessage('')
          setActiveTab('outgoing')
        },
      }
    )
  }

  // Set of IDs already in accepted/outgoing/incoming to disable re-sending
  const connectedUserIds = new Set([
    ...accepted.map((r) => r.contact_id),
    ...accepted.map((r) => r.requester_id),
    ...outgoing.map((r) => r.contact_id),
    ...incoming.map((r) => r.requester_id),
  ])

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-safe-500 flex items-center justify-center text-white shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl">SafeCity User Emergency Contacts</CardTitle>
              <CardDescription>
                Reciprocal user-to-user contacts. Connected SafeCity citizens automatically receive your real-time GPS coordinates and SOS alerts.
              </CardDescription>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border mt-4 gap-2 overflow-x-auto text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('contacts')}
            className={`pb-2.5 px-3 font-medium transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'contacts'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Connected Contacts</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {accepted.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            className={`pb-2.5 px-3 font-medium transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'incoming'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Incoming Requests</span>
            {incoming.length > 0 ? (
              <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 animate-pulse">
                {incoming.length}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                0
              </Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('outgoing')}
            className={`pb-2.5 px-3 font-medium transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'outgoing'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Sent Requests</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {outgoing.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`pb-2.5 px-3 font-medium transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'search'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Find Citizens</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {/* 1. CONNECTED CONTACTS TAB */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            {loadingAccepted ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading contacts...</p>
            ) : accepted.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xl border border-dashed border-border bg-muted/20">
                <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-semibold text-foreground">No SafeCity emergency contacts yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Add verified SafeCity citizens so they instantly receive your GPS location and emergency notification whenever you trigger SOS.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => setActiveTab('search')}
                >
                  <UserPlus className="w-4 h-4" />
                  Find & Invite Citizens
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {accepted.map((req) => {
                  const other = req.contact || req.requester
                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-3 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {other?.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{other?.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{other?.email}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-safe-600 mt-1">
                            <Check className="w-3 h-3 text-safe-500" />
                            <span>SOS Alerts Enabled</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Remove ${other?.full_name} from your emergency contacts?`)) {
                            deleteContact(req.id)
                          }
                        }}
                        disabled={isDeleting}
                        className="text-destructive hover:bg-destructive/10 h-8 px-2 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. INCOMING REQUESTS TAB */}
        {activeTab === 'incoming' && (
          <div className="space-y-4">
            {loadingIncoming ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading requests...</p>
            ) : incoming.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Check className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p>No pending incoming emergency contact requests.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incoming.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{req.requester?.full_name}</span>
                        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                          Request to Connect
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{req.requester?.email}</p>
                      {req.message && (
                        <p className="text-sm text-foreground/90 italic bg-background/60 p-2 rounded-md mt-1 border border-border/50">
                          "{req.message}"
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground pt-1">
                        Received: {formatDate(req.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => acceptRequest(req.id)}
                        disabled={isAccepting}
                        className="gap-1 bg-safe-600 hover:bg-safe-700 text-white"
                      >
                        <Check className="w-4 h-4" />
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => rejectRequest(req.id)}
                        disabled={isRejecting}
                        className="gap-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. OUTGOING REQUESTS TAB */}
        {activeTab === 'outgoing' && (
          <div className="space-y-4">
            {loadingOutgoing ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading outgoing requests...</p>
            ) : outgoing.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p>No pending outgoing requests.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {outgoing.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{req.contact?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{req.contact?.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 gap-1">
                          <Clock className="w-3 h-3" />
                          Awaiting Approval
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          Sent {formatDate(req.created_at)}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteContact(req.id)}
                      disabled={isDeleting}
                      className="text-muted-foreground hover:text-destructive text-xs"
                    >
                      Cancel Request
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. SEARCH & INVITE TAB */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search SafeCity citizens by full name or email (min 2 characters)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Send Request Modal/Prompt if user selected */}
            {selectedUserToRequest && (
              <form
                onSubmit={handleSend}
                className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3 animate-in fade-in"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">
                      Send Emergency Request to {selectedUserToRequest.full_name}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setSelectedUserToRequest(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <Input
                  placeholder="Optional invitation message (e.g. Hi, please add me to your SafeCity emergency contacts)..."
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  className="text-sm"
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUserToRequest(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isSending} className="gap-1.5">
                    <Send className="w-3.5 h-3.5" />
                    {isSending ? 'Sending...' : 'Send Request'}
                  </Button>
                </div>
              </form>
            )}

            {/* Search Results */}
            {searchQuery.trim().length >= 2 ? (
              isSearching ? (
                <p className="text-sm text-muted-foreground text-center py-6">Searching citizens...</p>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No SafeCity citizens found matching "{searchQuery}".</p>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {searchResults.map((user) => {
                    const isAlreadyConnected = connectedUserIds.has(user.id)
                    return (
                      <div
                        key={user.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {user.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>

                        {isAlreadyConnected ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Connected / Pending
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUserToRequest(user)
                              setRequestMessage('')
                            }}
                            className="gap-1 text-xs h-8"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Request
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                Type at least 2 characters to search the city's registered citizens.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
