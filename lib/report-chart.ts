// The "revenue by day" bars drawn as a picture, so the Excel file can show the same chart as the PDF.
// Browser only (it uses a canvas). Returns null if a canvas is not available.
export type ChartPicture = { content: ArrayBuffer; contentType: 'image/png'; width: number; height: number }

export async function drawRevenueChart(days: { date: string; revenue: number }[], bestDate: string, labels: { from: string; mid: string; to: string }): Promise<ChartPicture | null> {
  if (typeof document === 'undefined' || days.length === 0) return null
  const W = 1520, H = 340, scale = 2 // drawn at double size so it stays sharp
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
  const g = canvas.getContext('2d'); if (!g) return null
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H)
  const left = 8 * scale, right = W - 8 * scale, top = 10 * scale, base = H - 28 * scale
  const max = Math.max(1, ...days.map(d => d.revenue))
  const slot = (right - left) / days.length, bar = Math.max(2, slot - 3 * scale)
  g.strokeStyle = '#E3E8EF'; g.lineWidth = 1 * scale; for (let i = 1; i <= 3; i++) { const y = base - ((base - top) * i) / 3; g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.stroke() }
  days.forEach((d, i) => {
    const h = d.revenue > 0 ? Math.max(2 * scale, (d.revenue / max) * (base - top)) : 1 * scale
    g.fillStyle = d.date === bestDate ? '#FFD400' : '#2F6FD0'
    g.fillRect(left + i * slot + (slot - bar) / 2, base - h, bar, h)
  })
  g.strokeStyle = '#9AA5B1'; g.lineWidth = 1 * scale; g.beginPath(); g.moveTo(left, base); g.lineTo(right, base); g.stroke()
  g.fillStyle = '#5B6877'; g.font = `${11 * scale}px Arial, sans-serif`; g.textBaseline = 'top'
  g.textAlign = 'left'; g.fillText(labels.from, left, base + 6 * scale)
  g.textAlign = 'center'; if (days.length > 6) g.fillText(labels.mid, (left + right) / 2, base + 6 * scale)
  g.textAlign = 'right'; g.fillText(labels.to, right, base + 6 * scale)
  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'))
  if (!blob) return null
  return { content: await blob.arrayBuffer(), contentType: 'image/png', width: W / scale, height: H / scale }
}
