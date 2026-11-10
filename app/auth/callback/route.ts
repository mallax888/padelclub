import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { INVITE_COOKIE, joinPathFor, safeNext } from '@/lib/return-to'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Back to wherever they were going: an explicit ?next=, or the invite they
  // had open when they signed up (the confirmation email lands here with
  // neither a ?next= nor any memory of the page, but the cookie is still in the
  // browser), or the booking page as before.
  const destination =
    safeNext(requestUrl.searchParams.get('next'))
    ?? joinPathFor(request.cookies.get(INVITE_COOKIE)?.value)
    ?? '/book'
  return NextResponse.redirect(new URL(destination, request.url))
}