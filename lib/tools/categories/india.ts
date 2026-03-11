// categories/india.ts
import { lookup_pincode as _lp, get_rewa_info as _gri } from '../no-key/index'
export async function lookup_pincode(args: { pincode: string }) { return _lp(args) }
export async function get_rewa_info(args: { type: string; area?: string }) { return _gri(args) }

// PNR status via RailwayAPI / IndianRail (public data)
export async function get_pnr_status(args: { pnr: string }) {
  const pnr = args.pnr?.replace(/\D/g, '')
  if (!pnr || pnr.length !== 10) return { error: 'Invalid PNR. Must be 10 digits.' }
  try {
    const res = await fetch(`https://api.railwayapi.site/api/pnr-status?pnr=${pnr}`, { signal: AbortSignal.timeout(7000) })
    if (!res.ok) throw new Error('API unavailable')
    const d = await res.json()
    if (d.status === false) return { pnr, status: 'Not found', link: `https://www.irctc.co.in/nget/pnr-status` }
    return {
      pnr,
      train: d.train_name,
      from: d.from_station,
      to: d.to_station,
      date: d.doj,
      status: d.chart_status,
      passengers: d.passengers?.map((p: any) => ({ seat: p.current_status })) || [],
    }
  } catch {
    return { pnr, note: 'Live PNR unavailable', link: `https://www.irctc.co.in/nget/pnr-status`, check_at: 'IRCTC Website' }
  }
}

// Indian fuel prices (scraped from public sources)
export async function get_india_fuel_price(args: { city?: string }) {
  const city = args.city || 'Delhi'
  try {
    const res = await fetch(`https://api.fuelpriceindia.in/api/latest?city=${encodeURIComponent(city)}`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const d = await res.json()
      return { city, petrol: d.petrol, diesel: d.diesel, date: d.date, source: 'FuelPriceIndia' }
    }
  } catch {}
  // Static fallback with note
  return {
    city,
    note: 'Live fuel price unavailable. Check: https://www.iocl.com/petrol-diesel-price',
    link: 'https://www.iocl.com/petrol-diesel-price',
  }
}

// Government schemes — built-in knowledge base
export async function get_government_scheme(args: { query: string }) {
  const q = args.query.toLowerCase()
  const SCHEMES: Record<string, any> = {
    'pm kisan': { name: 'PM-KISAN', benefit: '₹6000/year in 3 installments', eligibility: 'Small/marginal farmers with land ≤2 hectares', link: 'https://pmkisan.gov.in' },
    'ayushman': { name: 'Ayushman Bharat PM-JAY', benefit: 'Health cover ₹5 lakh/year per family', eligibility: 'BPL families, SECC database', link: 'https://pmjay.gov.in' },
    'ujjwala': { name: 'PM Ujjwala Yojana', benefit: 'Free LPG connection to BPL households', eligibility: 'Women from BPL families', link: 'https://pmuy.gov.in' },
    'mudra': { name: 'PM Mudra Yojana', benefit: 'Loans ₹10,000–₹10 lakh for small businesses', eligibility: 'Non-farm enterprises, small businesses', link: 'https://mudra.org.in' },
    'jan dhan': { name: 'Pradhan Mantri Jan Dhan Yojana', benefit: 'Free zero-balance bank account, ₹2 lakh accident cover', eligibility: 'Any Indian citizen without bank account', link: 'https://pmjdy.gov.in' },
    'scholarship': { name: 'NSP National Scholarship Portal', benefit: 'Merit + means-based scholarships for students', eligibility: 'Students from SC/ST/OBC/minorities/EWS', link: 'https://scholarships.gov.in' },
  }
  const match = Object.keys(SCHEMES).find(k => q.includes(k))
  if (match) return SCHEMES[match]
  return { query: args.query, note: 'Visit myscheme.gov.in for all government schemes', link: 'https://myscheme.gov.in' }
}

// NEET info — built-in static data (updated yearly)
export async function get_neet_info(args: { query: string }) {
  const q = args.query.toLowerCase()
  const INFO: Record<string, string> = {
    dates: 'NEET 2025: Registration Jan-Mar 2025 | Exam: May 4, 2025 | Result: June 2025',
    syllabus: 'Physics (50Q), Chemistry (50Q), Biology/Botany+Zoology (100Q). Total: 200Q, 720 marks. NCERT Class 11+12.',
    cutoff: '2024 Cutoff — General: 720-137 | OBC: 136-107 | SC: 106-87 | ST: 106-87',
    colleges: 'AIIMS Delhi (rank 1-50), AIIMS Mumbai, Maulana Azad, Lady Hardinge, Grant Medical, KMC Manipal',
    'admit card': 'Download from neet.nta.nic.in. Need Application Number + DOB.',
    result: 'Check at neet.nta.nic.in. Need Roll Number + DOB.',
    fees: 'General: ₹1700 | OBC/EWS: ₹1600 | SC/ST/PwD: ₹1000',
  }
  const match = Object.keys(INFO).find(k => q.includes(k))
  return { query: args.query, info: match ? INFO[match] : INFO.dates, official_site: 'https://neet.nta.nic.in' }
}
