'use client'
export default function PrintButton() {
  return <button type="button" onClick={() => window.print()} data-testid="poster-print" className="btn btn-primary">Print this poster</button>
}
