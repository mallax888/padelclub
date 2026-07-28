import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatNzd(amount: number): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function getNextNDates(n: number): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

export function generateTimeSlots(
  openHour = 7,
  closeHour = 22,
  intervalMinutes = 60
): string[] {
  const slots: string[] = []
  for (let h = openHour; h < closeHour; h += intervalMinutes / 60) {
    const hh = Math.floor(h).toString().padStart(2, '0')
    const mm = ((h % 1) * 60).toString().padStart(2, '0')
    slots.push(`${hh}:${mm}`)
  }
  return slots
}

export function addHours(timeStr: string, hours: number): string {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h + hours
  return `${total.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
