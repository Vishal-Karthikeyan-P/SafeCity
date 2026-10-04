import { useNavigate } from "react-router-dom"
import {
  Bell,
  CheckCheck,
  Check,
  AlertTriangle,
  ShieldCheck,
  UserPlus,
  Users,
  MapPin,
  Megaphone,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/api/user"
import { timeAgo, cn } from "@/lib/utils"

export function NotificationsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useNotifications()
  const { mutate: markRead } = useMarkNotificationRead()
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllRead()

  const rawNotifs: any[] = data?.items ?? data?.notifications ?? []
  const notifications = Array.from(
    new Map(rawNotifs.map((n: any) => [n.id || `${n.title}-${n.created_at}`, n])).values()
  )
  const unread = data?.unread_count ?? 0

  const getNotificationVisuals = (type: string) => {
    switch (type) {
      case "emergency_contact_request":
        return {
          icon: <UserPlus className="w-5 h-5 text-primary" />,
          badge: <Badge variant="outline" className="text-primary border-primary/30">Contact Request</Badge>,
          bg: "bg-primary/10",
        }
      case "emergency_contact_accepted":
        return {
          icon: <Users className="w-5 h-5 text-safe-500" />,
          badge: <Badge variant="outline" className="text-safe-600 border-safe-500/30">Contact Accepted</Badge>,
          bg: "bg-safe-50",
        }
      case "sos_alert":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />,
          badge: <Badge variant="destructive">SOS Alert</Badge>,
          bg: "bg-destructive/10",
        }
      case "sos_resolved":
        return {
          icon: <ShieldCheck className="w-5 h-5 text-safe-500" />,
          badge: <Badge variant="outline" className="text-safe-600 border-safe-500/30">SOS Resolved</Badge>,
          bg: "bg-safe-50",
        }
      case "nearby_incident":
      case "unsafe_area":
        return {
          icon: <MapPin className="w-5 h-5 text-amber-500" />,
          badge: <Badge variant="outline" className="text-amber-600 border-amber-500/30">Safety Alert</Badge>,
          bg: "bg-amber-50",
        }
      case "community_alert":
        return {
          icon: <Megaphone className="w-5 h-5 text-blue-500" />,
          badge: <Badge variant="outline" className="text-blue-600 border-blue-500/30">Community</Badge>,
          bg: "bg-blue-50",
        }
      default:
        return {
          icon: <Bell className="w-5 h-5 text-primary" />,
          badge: null,
          bg: "bg-muted",
        }
    }
  }

  const handleNotificationClick = (notif: any) => {
    if (!notif.is_read) {
      markRead(notif.id)
    }

    if (notif.incident_id) {
      navigate(`/incidents/${notif.incident_id}`)
    } else if (notif.type === "emergency_contact_request" || notif.type === "emergency_contact_accepted") {
      navigate("/profile")
    } else if (notif.type === "nearby_incident" || notif.type === "unsafe_area") {
      navigate("/map")
    } else if (notif.type === "community_alert") {
      navigate("/alerts")
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {unread > 0 ? `${unread} unread notification${unread !== 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead()} disabled={isMarkingAll} id="mark-all-read-btn">
            <CheckCheck className="w-4 h-4 mr-1.5" />
            Mark all as read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
          <p className="text-muted-foreground">You will be notified about SOS alerts, emergency contact updates, and nearby hazards here.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {notifications.map((notif: any) => {
              const { icon, badge, bg } = getNotificationVisuals(notif.type)
              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "flex items-start gap-4 p-4 transition-colors cursor-pointer group",
                    !notif.is_read && "bg-primary/5 hover:bg-primary/10",
                    notif.is_read && "hover:bg-muted/40"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", bg)}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className={cn("text-sm", !notif.is_read && "font-semibold")}>{notif.title}</p>
                      {badge}
                    </div>
                    {notif.message && <p className="text-sm text-muted-foreground line-clamp-2">{notif.message}</p>}
                    <p className="text-xs text-muted-foreground mt-1.5">{timeAgo(notif.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!notif.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        title="Mark as read"
                        onClick={(e) => {
                          e.stopPropagation()
                          markRead(notif.id)
                        }}
                        id={`mark-read-${notif.id}`}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
