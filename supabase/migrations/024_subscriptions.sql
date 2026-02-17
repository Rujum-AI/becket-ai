-- =====================================================
-- 024: SUBSCRIPTIONS & PAYMENT EVENTS
-- Lemon Squeezy billing infrastructure
-- =====================================================

-- =====================================================
-- 1. SUBSCRIPTIONS
-- One row per family. Tracks active Lemon Squeezy subscription.
-- =====================================================
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  billing_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Lemon Squeezy identifiers
  ls_customer_id text,
  ls_subscription_id text UNIQUE,
  ls_order_id text,
  ls_product_id text,
  ls_variant_id text,

  -- Plan & status
  plan text NOT NULL DEFAULT 'essential'
    CHECK (plan IN ('essential', 'ai-assistant', 'ai-mediator', 'full')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'paused', 'past_due', 'expired', 'trialing', 'unpaid')),

  -- Billing period
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at timestamptz,
  renews_at timestamptz,

  -- Payment method (last known)
  card_brand text,
  card_last_four text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT subscriptions_one_per_family UNIQUE (family_id)
);

CREATE INDEX idx_subscriptions_family ON subscriptions(family_id);
CREATE INDEX idx_subscriptions_ls_customer ON subscriptions(ls_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- 2. PAYMENT_EVENTS
-- Webhook event log — full billing history + audit trail.
-- =====================================================
CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Lemon Squeezy event tracking
  ls_event_id text UNIQUE,
  event_type text NOT NULL CHECK (event_type IN (
    'subscription_created',
    'subscription_updated',
    'subscription_cancelled',
    'subscription_resumed',
    'subscription_expired',
    'subscription_paused',
    'subscription_unpaused',
    'subscription_payment_success',
    'subscription_payment_failed',
    'subscription_payment_recovered',
    'order_created',
    'order_refunded'
  )),

  -- Payment details
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'failed', 'refunded', 'pending')),

  -- Full webhook payload for audit
  payload jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_events_family ON payment_events(family_id);
CREATE INDEX idx_payment_events_subscription ON payment_events(subscription_id);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_created ON payment_events(created_at DESC);

-- =====================================================
-- RLS POLICIES
-- Family members can read. Only service_role (webhooks) can write.
-- =====================================================

-- SUBSCRIPTIONS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_read" ON subscriptions
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- Writes happen via service_role in the webhook edge function.

-- PAYMENT_EVENTS
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_events_read" ON payment_events
  FOR SELECT USING (family_id IN (SELECT user_family_ids()));

-- No INSERT policy for authenticated users.
-- Writes happen via service_role in the webhook edge function.

-- =====================================================
-- AUTO-UPDATE TIMESTAMPS
-- =====================================================
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- SYNC TRIGGER: subscriptions.plan → families.plan
-- Keeps families.plan in sync whenever subscription changes.
-- =====================================================
CREATE OR REPLACE FUNCTION sync_family_plan()
RETURNS trigger AS $$
BEGIN
  UPDATE families
  SET plan = NEW.plan
  WHERE id = NEW.family_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER subscription_sync_plan
  AFTER INSERT OR UPDATE OF plan, status ON subscriptions
  FOR EACH ROW
  WHEN (NEW.status IN ('active', 'trialing'))
  EXECUTE FUNCTION sync_family_plan();

-- When subscription expires/cancels, revert family to 'essential'
CREATE OR REPLACE FUNCTION revert_family_plan()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('expired', 'cancelled', 'unpaid') AND
     OLD.status IN ('active', 'trialing', 'paused', 'past_due') THEN
    UPDATE families
    SET plan = 'essential'
    WHERE id = NEW.family_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER subscription_revert_plan
  AFTER UPDATE OF status ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION revert_family_plan();
