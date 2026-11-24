'use client'
import { useEffect } from 'react'
import { rememberClub } from '@/lib/club-link'

// Remembers which club's link someone opened, so that if they sign up it is that club they join.
export default function RememberClub({ slug }: { slug: string }) {
  useEffect(() => { rememberClub(slug) }, [slug])
  return null
}
