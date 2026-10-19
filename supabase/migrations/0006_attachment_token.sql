-- ===========================================================================
-- 0006 - keep Brevo's attachment DownloadToken
--
-- Brevo hands over a token instead of the bytes, and the file is only pulled
-- across the first time somebody opens it. Without somewhere to keep the token
-- that fetch is impossible, so inbound attachments were unreachable.
-- ===========================================================================

alter table public.mail_attachments
  add column if not exists download_token text;

comment on column public.mail_attachments.download_token is
  'Brevo inbound token. Cleared once storage_path is set.';
