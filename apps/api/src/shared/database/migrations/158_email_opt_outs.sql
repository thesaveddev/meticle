-- One-click unsubscribe for the email a recipient can stop receiving.
--
-- Everything this product sends divides in two. A password reset, a receipt, a
-- statutory DBS retention notice is a message the person is entitled to and the
-- provider cannot suppress — there is nothing to unsubscribe from. A digest, a
-- shift reminder, a survey invite, a winback note is not: under PECR (and
-- CAN-SPAM for US recipients) it needs a way out that does not require signing
-- in, and a bulk sender needs one that a mail client can follow with a single
-- POST.
--
-- The opt-out is keyed on the address rather than the user because email is the
-- only identity the recipient is guaranteed to still have: a leaver whose account
-- is gone, an address that was only ever a recipient, an old org admin. `user_id`
-- is recorded when it is known, for the audit trail, but it is not the key.
--
-- No organisation_id and no RLS: this is not tenant data. `email_queue` is the
-- same shape for the same reason — the row is about a mailbox, not a provider's
-- records, and the public endpoint that writes it runs before any tenant context
-- exists.

CREATE TABLE IF NOT EXISTS email_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  -- The two things a link can stop. 'marketing' is lifecycle and winback mail;
  -- 'notifications' is the operational digests, reminders and alerts. Security,
  -- billing receipts and statutory notices are neither, and are never suppressed.
  scope VARCHAR(32) NOT NULL CHECK (scope IN ('marketing', 'notifications')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Where it came from: 'link' (the page), 'one-click' (a mail client's
  -- List-Unsubscribe-Post), or 'admin' if a member of the team acts on a request.
  source VARCHAR(40) NOT NULL DEFAULT 'link',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Case-insensitive, because an address is not case-sensitive and a second
-- capitalised unsubscribe must not be recorded as a different person.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_opt_outs_email_scope
  ON email_opt_outs (lower(email), scope);

-- The headers a message needs to carry for a mail client's own unsubscribe
-- button (RFC 8058). Stored with the queued row rather than rebuilt at send
-- time, so what was queued is exactly what goes out.
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS headers JSONB;
