// categories/finance.ts
export { get_crypto_price, get_exchange_rate } from '../free-key/index'

// Binance backup — no key, 100% free
export async function get_crypto_price_backup(args: { coin: string }) {
  const sym = (args.coin || 'BTC').toUpperCase().replace('BITCOIN','BTC').replace('ETHEREUM','ETH').replace('SOLANA','SOL') + 'USDT'
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error('Binance failed')
  const d = await res.json()
  return { coin: args.coin, price_usdt: parseFloat(d.price).toFixed(2), symbol: sym }
}

// Frankfurter.app — free forex, no key
export async function get_exchange_rate_backup(args: { from?: string; to?: string }) {
  const from = (args.from || 'USD').toUpperCase()
  const to   = (args.to   || 'INR').toUpperCase()
  const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error('Frankfurter failed')
  const d = await res.json()
  return { from, to, rate: d.rates?.[to], date: d.date }
}

// Yahoo Finance for Indian stocks (free, no key required)
export async function get_india_stock(args: { symbol: string; exchange?: string }) {
  const sym = args.symbol.toUpperCase()
  const exchange = args.exchange?.toUpperCase() === 'BSE' ? 'BO' : 'NS'
  const yahooSym = `${sym}.${exchange}`
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) throw new Error('Yahoo failed')
    const d = await res.json()
    const meta = d.chart?.result?.[0]?.meta
    if (!meta) throw new Error('No data')
    return {
      symbol: sym,
      exchange: args.exchange || 'NSE',
      price: meta.regularMarketPrice,
      prev_close: meta.previousClose,
      change: (meta.regularMarketPrice - meta.previousClose).toFixed(2),
      change_pct: (((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2) + '%',
      currency: meta.currency,
      market_state: meta.marketState,
    }
  } catch {
    // Fallback: return search link
    return { symbol: sym, note: 'Live price unavailable', link: `https://finance.yahoo.com/quote/${yahooSym}` }
  }
}
