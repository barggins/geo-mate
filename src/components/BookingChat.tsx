import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Send, RotateCw, AlertTriangle, Loader2, Lock } from "lucide-react";
import { format } from "date-fns";

export type ChatBooking = {
  id: string;
  rider_id: string;
  status: string;
  profiles?: { name?: string | null } | null;
};

type Outgoing = {
  localId: string;
  body: string;
  state: "sending" | "failed";
  error?: string;
};

type Msg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  request_id: string | null;
};

/**
 * Chat scoped to a single booking (an accepted seat request).
 * Only that booking's rider, the ride's driver, and admins can read/write —
 * enforced by RLS on public.messages, this component just mirrors it.
 */
export function BookingChat({
  rideId,
  userId,
  isDriver,
  bookings,
}: {
  rideId: string;
  userId: string;
  isDriver: boolean;
  bookings: ChatBooking[];
}) {
  const accepted = bookings.filter((b) => b.status === "accepted");
  const [activeId, setActiveId] = useState<string | null>(accepted[0]?.id ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep a valid selection as bookings change.
  useEffect(() => {
    if (accepted.length === 0) {
      setActiveId(null);
    } else if (!activeId || !accepted.some((b) => b.id === activeId)) {
      setActiveId(accepted[0]!.id);
    }
  }, [accepted.map((b) => b.id).join(","), activeId]);

  const loadMessages = useCallback(async () => {
    if (!activeId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at, request_id")
      .eq("request_id", activeId)
      .order("created_at", { ascending: true });
    if (error) setLoadError(error.message);
    setMessages((data as Msg[]) ?? []);
    setLoading(false);
  }, [activeId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Realtime: only this booking's thread.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`booking-chat-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `request_id=eq.${activeId}` },
        (payload) => {
          const incoming = payload.new as Msg;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          // Clear any optimistic copy of our own message that just landed.
          if (incoming.sender_id === userId) {
            setOutgoing((prev) => prev.filter((o) => !(o.state === "sending" && o.body === incoming.body)));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, outgoing]);

  const deliver = useCallback(
    async (localId: string, body: string) => {
      if (!activeId) return;
      setOutgoing((prev) =>
        prev.map((o) => (o.localId === localId ? { ...o, state: "sending", error: undefined } : o)),
      );
      const { data, error } = await supabase
        .from("messages")
        .insert({ ride_id: rideId, request_id: activeId, sender_id: userId, body })
        .select("id, sender_id, body, created_at, request_id")
        .single();

      if (error) {
        setOutgoing((prev) =>
          prev.map((o) =>
            o.localId === localId ? { ...o, state: "failed", error: friendlyError(error.message) } : o,
          ),
        );
        return;
      }
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Msg]));
      setOutgoing((prev) => prev.filter((o) => o.localId !== localId));
    },
    [activeId, rideId, userId],
  );

  const send = (body: string) => {
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setOutgoing((prev) => [...prev, { localId, body, state: "sending" }]);
    void deliver(localId, body);
  };

  if (accepted.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4" />
          Booking chat
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {isDriver
            ? "Chat opens once you accept a seat request. Each rider gets their own private thread with you."
            : "Chat opens once the driver accepts your seat request."}
        </p>
      </Card>
    );
  }

  const activeBooking = accepted.find((b) => b.id === activeId);
  const failedCount = outgoing.filter((o) => o.state === "failed").length;

  return (
    <Card className="flex h-[460px] flex-col p-0">
      <div className="border-b p-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <MessageCircle className="h-4 w-4" />
          {isDriver ? "Rider chats" : "Chat with your driver"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Private to {isDriver ? "you and this rider" : "you and the driver"}.
        </p>

        {isDriver && accepted.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {accepted.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setActiveId(b.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  b.id === activeId
                    ? "border-transparent brand-gradient text-white"
                    : "border-border bg-background hover:bg-accent"
                }`}
              >
                {b.profiles?.name ?? "Rider"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto p-4">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {loadError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> Couldn't load messages
            </p>
            <p className="mt-1 text-muted-foreground">{loadError}</p>
            <Button size="sm" variant="outline" className="mt-2 h-7" onClick={() => void loadMessages()}>
              <RotateCw className="mr-1.5 h-3 w-3" /> Retry
            </Button>
          </div>
        )}

        {!loading && !loadError && messages.length === 0 && outgoing.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet — say hi to {isDriver ? activeBooking?.profiles?.name ?? "your rider" : "your driver"} 👋
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.sender_id === userId ? "brand-gradient text-white" : "bg-secondary"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-0.5 text-[10px] ${m.sender_id === userId ? "text-white/70" : "text-muted-foreground"}`}>
                {format(new Date(m.created_at), "HH:mm")}
              </p>
            </div>
          </div>
        ))}

        {outgoing.map((o) => (
          <div key={o.localId} className="flex justify-end">
            <div className="max-w-[80%]">
              <div
                className={`rounded-2xl px-3 py-2 text-sm ${
                  o.state === "failed"
                    ? "border border-destructive/40 bg-destructive/10 text-foreground"
                    : "brand-gradient text-white opacity-70"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{o.body}</p>
              </div>
              {o.state === "sending" ? (
                <p className="mt-0.5 text-right text-[10px] text-muted-foreground">Sending…</p>
              ) : (
                <div className="mt-1 flex items-center justify-end gap-2">
                  <span className="text-[10px] text-destructive">{o.error ?? "Not sent"}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => void deliver(o.localId, o.body)}
                  >
                    <RotateCw className="mr-1 h-3 w-3" /> Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setOutgoing((prev) => prev.filter((x) => x.localId !== o.localId))}
                  >
                    Discard
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {failedCount > 0 && (
        <div className="flex items-center justify-between gap-2 border-t bg-destructive/5 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            {failedCount} message{failedCount > 1 ? "s" : ""} didn't send
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => {
              outgoing.filter((o) => o.state === "failed").forEach((o) => void deliver(o.localId, o.body));
            }}
          >
            <RotateCw className="mr-1.5 h-3 w-3" /> Retry all
          </Button>
        </div>
      )}

      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          setText("");
          send(body);
        }}
      >
        <Input placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
        <Button type="submit" size="icon" className="brand-gradient text-white" disabled={!activeId}>
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {isDriver && activeBooking && (
        <div className="border-t px-3 py-1.5">
          <Badge variant="outline" className="text-[10px]">
            Thread: {activeBooking.profiles?.name ?? "Rider"}
          </Badge>
        </div>
      )}
    </Card>
  );
}

function friendlyError(message: string) {
  if (/row-level security|violates/i.test(message)) return "You're not a participant on this booking";
  if (/fetch|network|Failed to fetch/i.test(message)) return "Network problem";
  return message.length > 60 ? "Send failed" : message;
}
