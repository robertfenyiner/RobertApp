import { Router, Response } from 'express'
import { authRequired, type AuthRequest } from '../../middleware/auth'
import { getAllCurrencies, updateExchangeRates, convertToCOP } from '../../services/currencyService'

const router = Router()
router.use(authRequired)

// GET /api/currencies — list all currencies with rates
router.get('/', (_req: AuthRequest, res: Response) => {
  const currencies = getAllCurrencies()
  res.json(currencies)
})

// POST /api/currencies/update-rates — trigger manual rate update
router.post('/update-rates', async (_req: AuthRequest, res: Response) => {
  try {
    const updated = await updateExchangeRates()
    res.json({
      message: 'Tasas actualizadas correctamente',
      updatedCount: updated,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar tasas de cambio' })
  }
})

// POST /api/currencies/convert — convert amount between currencies
router.post('/convert', (req: AuthRequest, res: Response) => {
  const { amount, fromCurrency } = req.body

  if (!amount || !fromCurrency) {
    res.status(400).json({ error: 'Se requieren monto y moneda origen' })
    return
  }

  try {
    const result = convertToCOP(amount, fromCurrency)
    res.json({
      originalAmount: amount,
      fromCurrency,
      toCurrency: 'COP',
      ...result,
    })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
