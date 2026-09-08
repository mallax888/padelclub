// Shared shell for every transactional email. Previously each email (booking
// confirmation vs. the four find-a-game notifications) hand-rolled its own
// HTML with a different accent color and background -- an emerald-green
// light-mode design, a cyan/teal dark-mode design, and neither matched the
// app's actual lime-green brand (--brand-primary: #D4FF3D in app/globals.css).
// One shell now, matching the real brand, used everywhere.
const BRAND = {
  bg: '#050C11',
  surface: '#0A1620',
  border: '#1c2a30',
  text: '#F5FAF8',
  textMuted: '#9BB0BC',
  textSubtle: '#6b7d87',
  primary: '#D4FF3D',
  primaryOn: '#10230A',
  crimson: '#FF4D6D',
}

export type EmailRow = { label: string; value: string }

export function renderEmailShell({
  accentColor = BRAND.primary,
  accentOn = BRAND.primaryOn,
  heading,
  intro,
  rows = [],
  extraHtml = '',
  ctaText,
  ctaUrl,
  footer,
}: {
  accentColor?: string
  accentOn?: string
  heading: string
  intro: string
  rows?: EmailRow[]
  extraHtml?: string
  ctaText?: string
  ctaUrl?: string
  footer: string
}): string {
  const rowsHtml = rows.map((r, i) => `
              <tr><td style="padding:8px 0;color:${BRAND.textMuted};font-size:14px;${i < rows.length - 1 ? `border-bottom:1px solid ${BRAND.border}` : ''}">${r.label}</td><td style="padding:8px 0;font-weight:500;font-size:14px;${i < rows.length - 1 ? `border-bottom:1px solid ${BRAND.border}` : ''}text-align:right;color:${BRAND.text}">${r.value}</td></tr>`).join('')

  const ctaHtml = ctaText && ctaUrl ? `
            <div style="margin-top:20px;text-align:center">
              <a href="${ctaUrl}" style="background:${accentColor};color:${accentOn};padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700">${ctaText}</a>
            </div>` : ''

  return `
      <div style="font-family:system-ui;max-width:500px;margin:0 auto;padding:24px;background:${BRAND.bg}">
        <div style="background:${BRAND.surface};padding:20px 24px;border-radius:10px 10px 0 0;border-bottom:2px solid ${accentColor}">
          <h1 style="color:${accentColor};margin:0;font-size:20px">${heading}</h1>
        </div>
        <div style="background:${BRAND.surface};padding:24px;border-radius:0 0 10px 10px;border:1px solid ${BRAND.border};border-top:none">
          <p style="color:${BRAND.text};margin:0 0 16px">${intro}</p>
          ${rows.length > 0 ? `<table style="width:100%;border-collapse:collapse">${rowsHtml}</table>` : ''}
          ${extraHtml}
          ${ctaHtml}
        </div>
        <p style="color:${BRAND.textSubtle};font-size:12px;text-align:center;margin-top:16px">${footer}</p>
      </div>
  `
}

export const EMAIL_BRAND = BRAND
