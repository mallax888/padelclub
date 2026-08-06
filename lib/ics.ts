// Builds a downloadable .ics calendar file as a data: URI -- works with
// Apple Calendar, Outlook, and Google Calendar's "import" without needing a
// server round trip. Times are written as "floating" local time (no Z suffix,
// no TZID) since the booking's local time and the device opening the file are
// both assumed to be at/near the venue.
export function buildBookingIcsDataUri({
  uid,
  title,
  description,
  location,
  date,
  startTime,
  endTime,
}: {
  uid: string
  title: string
  description: string
  location: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM or HH:MM:SS
  endTime: string
}): string {
  const toIcsLocal = (d: string, t: string) => `${d.replace(/-/g, '')}T${t.slice(0, 8).replace(/:/g, '')}`
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PadelClub//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${uid}@padelclub`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsLocal(date, startTime)}`,
    `DTEND:${toIcsLocal(date, endTime)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'))
}
