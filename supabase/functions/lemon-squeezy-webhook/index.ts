import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Verify Lemon Squeezy webhook signature (HMAC SHA-256)
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const expectedSignature = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return expectedSignature === signature
}

// Map Lemon Squeezy subscription status to our status enum
function mapStatus(lsStatus: string): string {
  const statusMap: Record<string, string> = {
    'active': 'active',
    'cancelled': 'cancelled',
    'paused': 'paused',
    'past_due': 'past_due',
    'expired': 'expired',
    'on_trial': 'trialing',
    'unpaid': 'unpaid',
  }
  return statusMap[lsStatus] || 'active'
}

// Map Lemon Squeezy event names to our event_type enum
function mapEventType(eventName: string): string | null {
  const eventMap: Record<string, string> = {
    'subscription_created': 'subscription_created',
    'subscription_updated': 'subscription_updated',
    'subscription_cancelled': 'subscription_cancelled',
    'subscription_resumed': 'subscription_resumed',
    'subscription_expired': 'subscription_expired',
    'subscription_paused': 'subscription_paused',
    'subscription_unpaused': 'subscription_unpaused',
    'subscription_payment_success': 'subscription_payment_success',
    'subscription_payment_failed': 'subscription_payment_failed',
    'subscription_payment_recovered': 'subscription_payment_recovered',
    'order_created': 'order_created',
    'order_refunded': 'order_refunded',
  }
  return eventMap[eventName] || null
}

// Resolve variant_id → plan tier
// Configure these in Lemon Squeezy dashboard and set as env vars
function resolvePlan(variantId: string): string {
  const VARIANT_AI_ASSISTANT = Deno.env.get('LS_VARIANT_AI_ASSISTANT')
  const VARIANT_AI_MEDIATOR = Deno.env.get('LS_VARIANT_AI_MEDIATOR')
  const VARIANT_FULL = Deno.env.get('LS_VARIANT_FULL')

  if (variantId === VARIANT_FULL) return 'full'
  if (variantId === VARIANT_AI_MEDIATOR) return 'ai-mediator'
  if (variantId === VARIANT_AI_ASSISTANT) return 'ai-assistant'
  return 'ai-assistant' // Default paid tier
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-signature') || ''

    // Verify webhook signature
    if (!await verifySignature(rawBody, signature)) {
      console.error('Invalid webhook signature')
      return new Response('Invalid signature', { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const eventName = body.meta?.event_name
    const eventType = mapEventType(eventName)

    if (!eventType) {
      console.log(`Ignoring unhandled event: ${eventName}`)
      return new Response('OK', { status: 200 })
    }

    // Extract subscription data from webhook payload
    const attrs = body.data?.attributes || {}
    const relationships = body.data?.relationships || {}
    const customData = body.meta?.custom_data || {}

    // family_id must be passed as custom_data when creating checkout
    const familyId = customData.family_id
    const billingUserId = customData.user_id

    if (!familyId || !billingUserId) {
      console.error('Missing family_id or user_id in custom_data', customData)
      return new Response('Missing custom_data', { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Build subscription record
    const subscriptionId = body.data?.id?.toString()
    const customerId = attrs.customer_id?.toString() ||
      relationships?.customer?.data?.id?.toString()
    const orderId = attrs.order_id?.toString() ||
      relationships?.order?.data?.id?.toString()
    const productId = attrs.product_id?.toString() ||
      relationships?.product?.data?.id?.toString()
    const variantId = attrs.variant_id?.toString() ||
      relationships?.variant?.data?.id?.toString()

    const plan = resolvePlan(variantId || '')
    const status = mapStatus(attrs.status || 'active')

    // Upsert subscription
    const subscriptionData = {
      family_id: familyId,
      billing_user_id: billingUserId,
      ls_customer_id: customerId,
      ls_subscription_id: subscriptionId,
      ls_order_id: orderId,
      ls_product_id: productId,
      ls_variant_id: variantId,
      plan,
      status,
      current_period_start: attrs.current_period_start || null,
      current_period_end: attrs.renews_at || attrs.ends_at || null,
      trial_ends_at: attrs.trial_ends_at || null,
      cancel_at: attrs.cancelled ? (attrs.ends_at || null) : null,
      renews_at: attrs.renews_at || null,
      card_brand: attrs.card_brand || null,
      card_last_four: attrs.card_last_four || null,
    }

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'family_id',
      })
      .select('id')
      .single()

    if (subError) {
      console.error('Error upserting subscription:', subError)
      return new Response('DB error', { status: 500 })
    }

    // Log payment event (idempotent via ls_event_id unique constraint)
    const lsEventId = body.meta?.webhook_id || `${eventName}_${subscriptionId}_${Date.now()}`

    const eventData = {
      family_id: familyId,
      subscription_id: sub.id,
      ls_event_id: lsEventId,
      event_type: eventType,
      amount_cents: attrs.first_subscription_item?.price || attrs.total || 0,
      currency: attrs.currency || 'USD',
      status: eventType.includes('failed') ? 'failed' :
              eventType.includes('refund') ? 'refunded' : 'success',
      payload: body,
    }

    const { error: eventError } = await supabase
      .from('payment_events')
      .upsert(eventData, { onConflict: 'ls_event_id' })

    if (eventError) {
      console.error('Error inserting payment event:', eventError)
      // Don't fail the whole request — subscription was already updated
    }

    console.log(`Processed ${eventType} for family ${familyId}`)
    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Internal error', { status: 500 })
  }
})
