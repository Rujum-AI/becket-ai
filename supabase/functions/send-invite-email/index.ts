import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:5173'

const corsHeaders = {
  'Access-Control-Allow-Origin': SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, inviterName, token } = await req.json()

    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: 'Missing email or token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const inviteLink = `${SITE_URL}/invite/${token}`
    const senderName = inviterName || 'Your co-parent'

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:2rem 1rem;">
    <!-- Header -->
    <div style="background:#BD5B39;border-radius:1rem 1rem 0 0;padding:2rem;text-align:center;">
      <h1 style="color:white;font-size:1.75rem;margin:0;font-weight:800;">Becket AI</h1>
      <p style="color:rgba(255,255,255,0.8);margin:0.5rem 0 0;font-size:0.875rem;">Co-Parenting Made Simple</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:2rem;border-radius:0 0 1rem 1rem;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <h2 style="color:#1e293b;font-size:1.25rem;margin:0 0 1rem;">You've been invited!</h2>
      <p style="color:#64748b;line-height:1.6;margin:0 0 1.5rem;">
        <strong style="color:#1e293b;">${senderName}</strong> has invited you to co-parent together on Becket AI.
        Join to manage custody schedules, track expenses, and keep everything organized in one place.
      </p>
      <a href="${inviteLink}"
         style="display:block;background:#BD5B39;color:white;text-decoration:none;padding:1rem;border-radius:0.75rem;text-align:center;font-weight:700;font-size:1rem;">
        Accept Invitation
      </a>
      <p style="color:#94a3b8;font-size:0.75rem;margin:1.5rem 0 0;text-align:center;">
        This invitation expires in 7 days.<br>
        If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Becket AI <onboarding@resend.dev>',
        to: [email],
        subject: `${senderName} invited you to Becket AI`,
        html: htmlBody,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend API error:', data)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: data }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
