// Single source of truth for court pricing, used both for the booking UI's
// live preview (client) and for verifying/correcting what actually gets
// charged (server) -- the two must never drift or the server-verified price
// stops matching what the customer was shown.

export function isPeakTime(dateStr: string | null, timeStr: string | null): boolean {
  if (!dateStr || !timeStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const hour = parseInt(timeStr.slice(0, 2))
  const isWeekend = day === 0 || day === 6
  const isEvening = hour >= 17 && hour < 21
  return isWeekend || isEvening
}

export function computeCourtPrice(
  court: { price_per_hour: number; price_per_hour_peak: number | null },
  dateStr: string,
  timeStr: string,
  durationHours: number,
  discount: number,
): number {
  const peak = isPeakTime(dateStr, timeStr)
  const basePrice = peak && court.price_per_hour_peak ? court.price_per_hour_peak : court.price_per_hour
  return Math.round(basePrice * (1 - discount) * durationHours)
}
