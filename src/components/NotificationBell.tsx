import { Bell, Check, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useNotifications } from "@/lib/notifications";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import { showBrowserNotification } from "@/lib/browser-notify";

export function NotificationBell() {
  const { items, unread, markRead, markAllRead, refresh } = useNotifications();
  const navigate = useNavigate();
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Initialize seen set on first load so we don't notify for backlog.
    if (seenIds.current.size === 0 && items.length > 0) {
      items.forEach((i) => seenIds.current.add(i.id));
      return;
    }
    const hidden = typeof document !== "undefined" && document.visibilityState !== "visible";
    for (const n of items) {
      if (seenIds.current.has(n.id)) continue;
      seenIds.current.add(n.id);
      if (hidden && !n.read_at) {
        showBrowserNotification(n.title, {
          body: n.body ?? undefined,
          link: n.link ?? undefined,
          tag: n.id,
        });
      }
    }
  }, [items]);


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full bg-red-600 px-1 text-[10px] text-white">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <Check className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
          )}
          {items.map((n) => (
            <div
              key={n.id}
              className={`group flex cursor-pointer items-start gap-2 border-b p-3 text-sm hover:bg-muted/50 ${!n.read_at ? "bg-primary/5" : ""}`}
              onClick={async () => {
                await markRead(n.id);
                if (n.link) navigate({ to: n.link as any });
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={async (e) => {
                  e.stopPropagation();
                  await supabase.from("notifications").delete().eq("id", n.id);
                  refresh();
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate({ to: "/settings" })}>
            Notification settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
