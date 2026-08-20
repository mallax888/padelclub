import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
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

  const consentUrl = await client.buildConsentUrl()
  return NextResponse.redirect(consentUrl)
}
