import axios from 'axios'
import db from '../database'

const API_URL = 'https://open.er-api.com/v6/latest/USD'

export async function updateExchangeRates(): Promise<number> {
  try {
    console.log('💱 Actualizando tasas de cambio...')

    const response = await axios.get(API_URL, { timeout: 10000 })

    if (response.data?.result !== 'success' || !response.data?.rates) {
      throw new Error('Respuesta inválida del servicio de tasas')
    }

    const rates: Record<string, number> = response.data.rates
    rates.USD = 1

    const updateStmt = db.prepare(
      'UPDATE currencies SET exchange_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?'
    )

    let updated = 0
    const updateAll = db.transaction(() => {
      for (const [code, rate] of Object.entries(rates)) {
        const result = updateStmt.run(rate, code)
        if (result.changes > 0) updated++
      }
    })

    updateAll()
    console.log(`✅ Tasas actualizadas: ${updated} monedas`)
    return updated
  } catch (error: any) {
    console.error('❌ Error actualizando tasas:', error.message)
    return 0
  }
}

export function convertToCOP(amount: number, fromCurrencyCode: string): {
  copAmount: number
  exchangeRate: number
} {
  if (fromCurrencyCode === 'COP') {
    return { copAmount: amount, exchangeRate: 1 }
  }

  const currencies = db.prepare(
    'SELECT code, exchange_rate FROM currencies WHERE code IN (?, ?)'
  ).all(fromCurrencyCode, 'COP') as { code: string; exchange_rate: number }[]

  if (currencies.length !== 2) {
    throw new Error(`Moneda no encontrada: ${fromCurrencyCode}`)
  }

  const fromRate = currencies.find(c => c.code === fromCurrencyCode)!.exchange_rate
  const copRate = currencies.find(c => c.code === 'COP')!.exchange_rate

  if (!fromRate || !copRate) {
    throw new Error('Tasa de cambio inválida')
  }

  // Convert: amount in fromCurrency → USD → COP
  const usdAmount = amount / fromRate
  const copAmount = Math.round(usdAmount * copRate * 100) / 100
  const exchangeRate = Math.round((copRate / fromRate) * 1000000) / 1000000

  return { copAmount, exchangeRate }
}

export function getAllCurrencies() {
  return db.prepare('SELECT * FROM currencies ORDER BY code ASC').all()
}
