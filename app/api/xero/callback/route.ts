import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAppUrl } from '@/lib/env'
import { getXeroConsentClient } from '@/lib/xero'

export async function GET(request: Request) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (!profile || !['staff', 'admin'].includes(profile.role)) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  const appUrl = getAppUrl(request)
  const client = await getXeroConsentClient(appUrl)
  if (!client) {
    return NextResponse.redirect(new URL('/admin?xero_error=not_configured', request.url))
  }

  try {
    const tokenSet = await client.apiCallback(request.url)
    await client.updateTenants(false)
    const tenant = client.tenants[0]
    if (!tenant || !tokenSet.access_token || !tokenSet.refresh_token) {
      return NextResponse.redirect(new URL('/admin?xero_error=no_organisation', request.url))
    }

    const admin = createAdminClient()
    // Single-connection model -- clear any previous connection before
    // storing the new one.
    await admin.from('xero_connections').delete().not('id', 'is', null)
    await admin.from('xero_connections').insert({
      tenant_id: tenant.tenantId,
      tenant_name: tenant.tenantName,
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
      expires_at: new Date(Date.now() + (tokenSet.expires_in ?? 1800) * 1000).toISOString(),
      connected_by: session.user.id,
    })

    return NextResponse.redirect(new URL('/admin?xero_connected=1', request.url))
  } catch (err) {
    console.error('Xero OAuth callback failed:', err)
    return NextResponse.redirect(new URL('/admin?xero_error=callback_failed', request.url))
  }
}
