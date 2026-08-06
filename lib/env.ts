// If NEXT_PUBLIC_APP_URL is ever left unset on one of the two Vercel
// deployments, Stripe redirect URLs and email links would silently become
// "undefined/mybookings?..." with no error anywhere. Falling back to the
// incoming request's own Host header means a forgotten env var degrades to
// "still works" instead of "silently broken" -- Vercel deployments are
// always served over https.
export function getAppUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  const host = request.headers.get('host')
  if (host) return `https://${host}`
  console.error('NEXT_PUBLIC_APP_URL is not set and no request host is available — using an empty base URL')
  return ''
}
