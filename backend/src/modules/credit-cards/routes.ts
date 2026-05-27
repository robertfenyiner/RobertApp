import { Router, Response } from 'express'
import db from '../../database'
import { authRequired, type AuthRequest } from '../../middleware/auth'

const router = Router()
router.use(authRequired)

function toCOP(amount: number, currencyId: number) {
  const currency = db.prepare('SELECT exchange_rate FROM currencies WHERE id = ?').get(currencyId) as any
  const rate = currency?.exchange_rate || 1
  return { amount_cop: Math.round(amount * rate * 100) / 100, exchange_rate: rate }
}

function nextDueDate(purchaseDate: string, installmentNumber: number, card: any) {
  const d = new Date(`${purchaseDate}T12:00:00`)
  d.setMonth(d.getMonth() + installmentNumber - 1)
  const cutDay = Number(card.cut_day || 1)
  const dueDay = Number(card.payment_due_day || 15)
  const purchaseDay = d.getDate()
  if (purchaseDay > cutDay) d.setMonth(d.getMonth() + 1)
  d.setDate(Math.min(dueDay, 28))
  return d.toISOString().slice(0, 10)
}

function createInstallments(userId: number, chargeId: number, card: any, amount: number, installments: number, purchaseDate: string, monthlyRate: number) {
  const principal = amount / installments
  const monthlyInterest = monthlyRate > 0 ? principal * (monthlyRate / 100) : 0
  const total = principal + monthlyInterest
  const insert = db.prepare(`
    INSERT INTO credit_card_installments
      (user_id, charge_id, card_id, installment_number, due_date, principal_amount, interest_amount, total_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (let i = 1; i <= installments; i++) {
    insert.run(userId, chargeId, card.id, i, nextDueDate(purchaseDate, i, card), principal, monthlyInterest, total)
  }
}

function applyPaymentToInstallments(userId: number, cardId: number, amount: number, paymentDate: string) {
  let remaining = amount
  const installments = db.prepare(`
    SELECT * FROM credit_card_installments
    WHERE user_id = ? AND card_id = ? AND status = 'pending'
    ORDER BY due_date ASC, installment_number ASC, id ASC
  `).all(userId, cardId) as any[]

  const update = db.prepare(`
    UPDATE credit_card_installments
    SET paid_amount = ?, status = ?, paid_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `)

  for (const item of installments) {
    if (remaining <= 0) break
    const total = Number(item.total_amount || 0)
    const alreadyPaid = Number(item.paid_amount || 0)
    const due = Math.max(0, total - alreadyPaid)
    const applied = Math.min(remaining, due)
    const newPaid = alreadyPaid + applied
    const isPaid = newPaid >= total - 0.01
    update.run(newPaid, isPaid ? 'paid' : 'pending', isPaid ? paymentDate : null, item.id, userId)
    remaining -= applied
  }

  return { applied: amount - remaining, unapplied: remaining }
}

// GET /api/credit-cards/summary
router.get('/summary', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const cards = db.prepare(`
    SELECT cc.*, cur.code as currency_code, cur.symbol as currency_symbol,
      COALESCE((SELECT SUM(MAX(total_amount - COALESCE(paid_amount, 0), 0)) FROM credit_card_installments i WHERE i.card_id = cc.id AND i.status = 'pending'), 0) as pending_installments,
      COALESCE((SELECT SUM(amount) FROM credit_card_payments p WHERE p.card_id = cc.id), 0) as total_payments
    FROM credit_cards cc
    JOIN currencies cur ON cur.id = cc.currency_id
    WHERE cc.user_id = ? AND cc.is_active = 1
    ORDER BY cc.created_at DESC
  `).all(userId) as any[]

  const totalDebt = cards.reduce((sum, c) => sum + Number(c.pending_installments || 0), 0)
  const totalLimit = cards.reduce((sum, c) => sum + Number(c.credit_limit || 0), 0)
  const upcoming = db.prepare(`
    SELECT i.*, ch.description, cc.name as card_name, cc.bank_name,
      MAX(i.total_amount - COALESCE(i.paid_amount, 0), 0) as remaining_amount
    FROM credit_card_installments i
    JOIN credit_card_charges ch ON ch.id = i.charge_id
    JOIN credit_cards cc ON cc.id = i.card_id
    WHERE i.user_id = ? AND i.status = 'pending' AND i.due_date <= date('now', '+10 days')
    ORDER BY i.due_date ASC
    LIMIT 10
  `).all(userId)

  res.json({ cards, totalDebt, totalLimit, availableLimit: totalLimit - totalDebt, upcoming })
})

// GET /api/credit-cards/cards
router.get('/cards', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const cards = db.prepare(`
    SELECT cc.*, cur.code as currency_code, cur.symbol as currency_symbol,
      COALESCE((SELECT SUM(MAX(total_amount - COALESCE(paid_amount, 0), 0)) FROM credit_card_installments i WHERE i.card_id = cc.id AND i.status = 'pending'), 0) as pending_balance
    FROM credit_cards cc
    JOIN currencies cur ON cur.id = cc.currency_id
    WHERE cc.user_id = ?
    ORDER BY cc.is_active DESC, cc.created_at DESC
  `).all(userId)
  res.json(cards)
})

// POST /api/credit-cards/cards
router.post('/cards', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { name, bank_name, country, last_four, network, currency_id, credit_limit, interest_rate_monthly, interest_rate_annual, cut_day, payment_due_day, color } = req.body
  if (!name || !bank_name || !currency_id) {
    res.status(400).json({ error: 'Nombre, banco y moneda son obligatorios' })
    return
  }

  const result = db.prepare(`
    INSERT INTO credit_cards
      (user_id, name, bank_name, country, last_four, network, currency_id, credit_limit, interest_rate_monthly, interest_rate_annual, cut_day, payment_due_day, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, name, bank_name, country || 'Colombia', last_four || null, network || 'Otra', currency_id, credit_limit || 0, interest_rate_monthly || 0, interest_rate_annual || 0, cut_day || 1, payment_due_day || 15, color || '#6366f1')

  const card = db.prepare('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, userId)
  res.status(201).json(card)
})

// PUT /api/credit-cards/cards/:id
router.put('/cards/:id', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const id = Number(req.params.id)
  const { name, bank_name, country, last_four, network, currency_id, credit_limit, interest_rate_monthly, interest_rate_annual, cut_day, payment_due_day, color, is_active } = req.body

  db.prepare(`
    UPDATE credit_cards SET
      name = COALESCE(?, name), bank_name = COALESCE(?, bank_name), country = COALESCE(?, country),
      last_four = COALESCE(?, last_four), network = COALESCE(?, network), currency_id = COALESCE(?, currency_id),
      credit_limit = COALESCE(?, credit_limit), interest_rate_monthly = COALESCE(?, interest_rate_monthly),
      interest_rate_annual = COALESCE(?, interest_rate_annual), cut_day = COALESCE(?, cut_day),
      payment_due_day = COALESCE(?, payment_due_day), color = COALESCE(?, color),
      is_active = COALESCE(?, is_active), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(name, bank_name, country, last_four, network, currency_id, credit_limit, interest_rate_monthly, interest_rate_annual, cut_day, payment_due_day, color, is_active !== undefined ? (is_active ? 1 : 0) : null, id, userId)

  const card = db.prepare('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?').get(id, userId)
  res.json(card)
})

// GET /api/credit-cards/charges
router.get('/charges', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const charges = db.prepare(`
    SELECT ch.*, cc.name as card_name, cc.bank_name, cur.code as currency_code, cur.symbol as currency_symbol
    FROM credit_card_charges ch
    JOIN credit_cards cc ON cc.id = ch.card_id
    JOIN currencies cur ON cur.id = ch.currency_id
    WHERE ch.user_id = ?
    ORDER BY ch.purchase_date DESC, ch.created_at DESC
    LIMIT 100
  `).all(userId)
  res.json(charges)
})

// POST /api/credit-cards/charges
router.post('/charges', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { card_id, description, amount, currency_id, purchase_date, installments, interest_rate_monthly, category_id, company_id, notes } = req.body
  if (!card_id || !description || !amount || !currency_id) {
    res.status(400).json({ error: 'Tarjeta, descripción, monto y moneda son obligatorios' })
    return
  }

  const card = db.prepare('SELECT * FROM credit_cards WHERE id = ? AND user_id = ?').get(card_id, userId) as any
  if (!card) {
    res.status(404).json({ error: 'Tarjeta no encontrada' })
    return
  }

  const date = purchase_date || new Date().toISOString().slice(0, 10)
  const n = Math.max(1, Number(installments || 1))
  const monthlyRate = Number(interest_rate_monthly ?? card.interest_rate_monthly ?? 0)
  const conversion = toCOP(Number(amount), Number(currency_id))

  const tx = db.transaction(() => {
    const expenseResult = db.prepare(`
      INSERT INTO expenses
        (description, amount, currency_id, amount_cop, exchange_rate, category_id, company_id, user_id, date, notes, payment_method, credit_card_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'credit_card', ?)
    `).run(description, amount, currency_id, conversion.amount_cop, conversion.exchange_rate, category_id || null, company_id || null, userId, date, notes || null, card_id)

    const chargeResult = db.prepare(`
      INSERT INTO credit_card_charges
        (user_id, card_id, expense_id, description, amount, currency_id, amount_cop, exchange_rate, purchase_date, installments, interest_rate_monthly, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, card_id, expenseResult.lastInsertRowid, description, amount, currency_id, conversion.amount_cop, conversion.exchange_rate, date, n, monthlyRate, notes || null)

    createInstallments(userId, Number(chargeResult.lastInsertRowid), card, Number(amount), n, date, monthlyRate)
    return chargeResult.lastInsertRowid
  })

  const chargeId = tx()
  const charge = db.prepare('SELECT * FROM credit_card_charges WHERE id = ?').get(chargeId)
  res.status(201).json(charge)
})

// GET /api/credit-cards/installments
router.get('/installments', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const installments = db.prepare(`
    SELECT i.*, ch.description, cc.name as card_name, cc.bank_name,
      MAX(i.total_amount - COALESCE(i.paid_amount, 0), 0) as remaining_amount
    FROM credit_card_installments i
    JOIN credit_card_charges ch ON ch.id = i.charge_id
    JOIN credit_cards cc ON cc.id = i.card_id
    WHERE i.user_id = ?
    ORDER BY i.due_date ASC
    LIMIT 150
  `).all(userId)
  res.json(installments)
})

// GET /api/credit-cards/payments
router.get('/payments', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const payments = db.prepare(`
    SELECT p.*, cc.name as card_name, cur.code as currency_code, cur.symbol as currency_symbol
    FROM credit_card_payments p
    JOIN credit_cards cc ON cc.id = p.card_id
    JOIN currencies cur ON cur.id = p.currency_id
    WHERE p.user_id = ?
    ORDER BY p.payment_date DESC, p.created_at DESC
    LIMIT 100
  `).all(userId)
  res.json(payments)
})

// POST /api/credit-cards/payments
router.post('/payments', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { card_id, amount, currency_id, payment_date, payment_type, notes } = req.body
  if (!card_id || !amount || !currency_id) {
    res.status(400).json({ error: 'Tarjeta, monto y moneda son obligatorios' })
    return
  }

  const date = payment_date || new Date().toISOString().slice(0, 10)
  const conversion = toCOP(Number(amount), Number(currency_id))
  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO credit_card_payments (user_id, card_id, amount, currency_id, amount_cop, payment_date, payment_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, card_id, amount, currency_id, conversion.amount_cop, date, payment_type || 'partial', notes || null)
    const allocation = applyPaymentToInstallments(userId, Number(card_id), Number(amount), date)
    return { paymentId: result.lastInsertRowid, allocation }
  })

  const { paymentId, allocation } = tx()
  const payment = db.prepare('SELECT * FROM credit_card_payments WHERE id = ? AND user_id = ?').get(paymentId, userId)
  res.status(201).json({ payment, allocation })
})

export default router
