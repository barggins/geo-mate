DROP TABLE IF EXISTS public.device_tokens CASCADE;

ALTER TABLE public.notification_prefs
  DROP COLUMN IF EXISTS push_enabled,
  DROP COLUMN IF EXISTS sms_enabled,
  DROP COLUMN IF EXISTS whatsapp_enabled,
  DROP COLUMN IF EXISTS phone_e164;

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS browser_enabled boolean NOT NULL DEFAULT true;