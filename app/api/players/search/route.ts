import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 8

export async function GET(req: NextRequest) {
  // The caller's own client, so the "Members can view all profiles" policy
  // applies exactly as it does everywhere else -- this route returns a short
  // list of matches instead of the whole directory, but it never reads
  // anything the caller could not already read.
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  // PostgREST parses `or=(a.ilike.%x%,b.ilike.%y%)` by splitting on commas and
  // parens, so anything outside name characters is dropped rather than escaped
  // -- a search term can't be allowed to rewrite the filter. Allow-listed
  // rather than blocked, and the accented ranges are there so names like
  // "André" and "Taljaard" survive. (tsconfig targets es5, so no \p{L}.)
  const term = (req.nextUrl.searchParams.get('q') ?? '')
    .replace(/[^A-Za-z0-9À-ɏΆ-ώЀ-ӿ '.-]/g, '')
    .trim()
    .slice(0, 40)
  if (term.length < MIN_QUERY_LENGTH) return NextResponse.json({ players: [] })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, nickname')
    .or(`full_name.ilike.%${term}%,nickname.ilike.%${term}%`)
    .not('role', 'eq', 'staff')
    .neq('id', session.user.id)
    .order('full_name')
    .limit(MAX_RESULTS)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ players: data ?? [] })
}
