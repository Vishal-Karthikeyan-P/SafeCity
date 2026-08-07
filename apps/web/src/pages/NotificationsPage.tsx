import { Bell, CheckCheck, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/api/user"
import { timeAgo } from "@/lib/utils"
import { cn } from "@/lib/utils"

export function NotificationsPage() {
  const { data, isLoading } = useNotifications()
  const { mutate: markRead } = useMarkNotificationRead()
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllRead()

  const notifications: any[] = data?.notifications ?? []
  const unread = data?.unread_count ?? 0

  return (
    <div className="space-y-6 max-w-2xl">
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
          <p className="text-muted-foreground">You will be notified about incident updates and community alerts here.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {notifications.map((notif: any) => (
              <div
                key={notif.id}
                className={cn(
                  "flex items-start gap-4 p-4 transition-colors",
                  !notif.is_read && "bg-primary/5 hover:bg-primary/10",
                  notif.is_read && "hover:bg-muted/40"
                )}
              >
                <div className="mt-1.5 shrink-0">
                  {!notif.is_read
                    ? <span className="w-2 h-2 rounded-full bg-primary block" />
                    : <span className="w-2 h-2 rounded-full bg-transparent block" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", !notif.is_read && "font-semibold")}>{notif.title}</p>
                  {notif.message && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(notif.created_at)}</p>
                </div>
                {!notif.is_read && (
                  <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-muted-foreground hover:text-primary" title="Mark as read" onClick={() => markRead(notif.id)} id={`mark-read-${notif.id}`}>
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
