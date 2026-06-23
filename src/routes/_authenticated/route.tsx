import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { EmergencyButton } from "@/components/EmergencyButton";
import { PresenceTracker } from "@/components/PresenceTracker";
import { FirstLoginLocationPrompt } from "@/components/FirstLoginLocationPrompt";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <>
      <PresenceTracker />
      <FirstLoginLocationPrompt />
      <Outlet />
      <EmergencyButton />
    </>
  ),
});
