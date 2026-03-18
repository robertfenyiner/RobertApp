import { Router, Response } from 'express'
import db from '../../database'
import { authRequired, type AuthRequest } from '../../middleware/auth'

const router = Router()
router.use(authRequired)

// ==================== BANKS ====================

// GET /api/ahorros/banks
router.get('/banks', (req: AuthRequest, res: Response) => {
  const banks = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM savings_boxes sb WHERE sb.bank_id = b.id AND sb.user_id = ?) as box_count,
      (SELECT COALESCE(SUM(sb.balance), 0) FROM savings_boxes sb WHERE sb.bank_id = b.id AND sb.user_id = ?) as total_balance
    FROM banks b
    WHERE b.user_id = ? OR b.user_id IS NULL
    ORDER BY b.rate_ea DESC
  `).all(req.user!.id, req.user!.id, req.user!.id)

  res.json(banks)
})

// POST /api/ahorros/banks
router.post('/banks', (req: AuthRequest, res: Response) => {
  const { name, rate_ea } = req.body
  if (!name || rate_ea === undefined) {
    res.status(400).json({ error: 'Nombre y tasa EA son requeridos' })
    return
  }

  const result = db.prepare(
    'INSERT INTO banks (name, rate_ea, user_id) VALUES (?, ?, ?)'
  ).run(name, rate_ea, req.user!.id)

  const bank = db.prepare('SELECT * FROM banks WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(bank)
})

// PUT /api/ahorros/banks/:id
router.put('/banks/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { name, rate_ea } = req.body

  const existing = db.prepare('SELECT id FROM banks WHERE id = ? AND user_id = ?').get(id, req.user!.id)
  if (!existing) {
    res.status(404).json({ error: 'Banco no encontrado' })
    return
  }

  db.prepare(`
    UPDATE banks SET name = COALESCE(?, name), rate_ea = COALESCE(?, rate_ea), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(name, rate_ea, id, req.user!.id)

  const updated = db.prepare('SELECT * FROM banks WHERE id = ?').get(id)
  res.json(updated)
})

// DELETE /api/ahorros/banks/:id
router.delete('/banks/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  // Check if bank has boxes
  const boxCount = db.prepare(
    'SELECT COUNT(*) as count FROM savings_boxes WHERE bank_id = ? AND user_id = ?'
  ).get(id, userId) as any

  if (boxCount.count > 0) {
    res.status(400).json({ error: `No se puede eliminar: tiene ${boxCount.count} cajita(s) asociada(s)` })
    return
  }

  const result = db.prepare('DELETE FROM banks WHERE id = ? AND user_id = ?').run(id, userId)
  if (result.changes === 0) {
    res.status(404).json({ error: 'Banco no encontrado' })
    return
  }

  res.json({ message: 'Banco eliminado' })
})

// ==================== SAVINGS BOXES ====================

// GET /api/ahorros/boxes
router.get('/boxes', (req: AuthRequest, res: Response) => {
  const boxes = db.prepare(`
    SELECT sb.*, b.name as bank_name, b.rate_ea as bank_rate
    FROM savings_boxes sb
    JOIN banks b ON sb.bank_id = b.id
    WHERE sb.user_id = ?
    ORDER BY sb.balance DESC
  `).all(req.user!.id) as any[]

  // Calculate daily earnings for each box
  const boxesWithDaily = boxes.map(box => {
    const dailyRate = Math.pow(1 + box.bank_rate / 100, 1 / 365) - 1
    const dailyEarnings = Math.round(box.balance * dailyRate * 100) / 100
    return { ...box, dailyEarnings, dailyRate: Math.round(dailyRate * 10000000) / 100000 }
  })

  res.json(boxesWithDaily)
})

// GET /api/ahorros/boxes/:id — detail with movements
router.get('/boxes/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const box = db.prepare(`
    SELECT sb.*, b.name as bank_name, b.rate_ea as bank_rate
    FROM savings_boxes sb
    JOIN banks b ON sb.bank_id = b.id
    WHERE sb.id = ? AND sb.user_id = ?
  `).get(id, req.user!.id) as any

  if (!box) {
    res.status(404).json({ error: 'Cajita no encontrada' })
    return
  }

  const movements = db.prepare(`
    SELECT * FROM savings_movements
    WHERE savings_box_id = ?
    ORDER BY date DESC, id DESC
    LIMIT 50
  `).all(id)

  const rateHistory = db.prepare(`
    SELECT * FROM rate_history
    WHERE savings_box_id = ?
    ORDER BY start_date DESC
  `).all(id)

  // Calculate daily earnings: daily_rate = (1 + EA/100)^(1/365) - 1
  const dailyRate = Math.pow(1 + box.bank_rate / 100, 1 / 365) - 1
  const dailyEarnings = Math.round(box.balance * dailyRate * 100) / 100

  res.json({ ...box, movements, rateHistory, dailyEarnings, dailyRate: Math.round(dailyRate * 10000000) / 100000 })
})

// PUT /api/ahorros/boxes/:id/rate — change rate for a cajita
router.put('/boxes/:id/rate', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { new_rate } = req.body

  if (new_rate === undefined || new_rate < 0) {
    res.status(400).json({ error: 'La nueva tasa EA es requerida y debe ser positiva' })
    return
  }

  const box = db.prepare(`
    SELECT sb.*, b.rate_ea as bank_rate, b.id as bank_id_ref
    FROM savings_boxes sb
    JOIN banks b ON sb.bank_id = b.id
    WHERE sb.id = ? AND sb.user_id = ?
  `).get(id, req.user!.id) as any

  if (!box) {
    res.status(404).json({ error: 'Cajita no encontrada' })
    return
  }

  const today = new Date().toISOString().split('T')[0]

  // Close the previous rate entry
  db.prepare(`
    UPDATE rate_history SET end_date = ? WHERE savings_box_id = ? AND end_date IS NULL
  `).run(today, id)

  // Insert new rate entry
  db.prepare(`
    INSERT INTO rate_history (savings_box_id, rate_ea, start_date) VALUES (?, ?, ?)
  `).run(id, new_rate, today)

  // Update the bank's rate too (since each box is linked to a bank)
  db.prepare('UPDATE banks SET rate_ea = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(new_rate, box.bank_id_ref)

  const updated = db.prepare(`
    SELECT sb.*, b.name as bank_name, b.rate_ea as bank_rate
    FROM savings_boxes sb JOIN banks b ON sb.bank_id = b.id WHERE sb.id = ?
  `).get(id)

  res.json(updated)
})

// GET /api/ahorros/boxes/:id/projection — compound interest projection
router.get('/boxes/:id/projection', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const months = Number(req.query.months) || 12
  const monthlyDeposit = Number(req.query.monthly_deposit) || 0

  const box = db.prepare(`
    SELECT sb.*, b.rate_ea as bank_rate
    FROM savings_boxes sb
    JOIN banks b ON sb.bank_id = b.id
    WHERE sb.id = ? AND sb.user_id = ?
  `).get(id, req.user!.id) as any

  if (!box) {
    res.status(404).json({ error: 'Cajita no encontrada' })
    return
  }

  // Convert EA (effective annual) to monthly rate
  // Formula: monthly_rate = (1 + EA/100)^(1/12) - 1
  const rateEA = box.bank_rate / 100
  const monthlyRate = Math.pow(1 + rateEA, 1 / 12) - 1

  const projection: Array<{
    month: number
    balance: number
    interest: number
    deposit: number
    cumulativeInterest: number
    cumulativeDeposits: number
  }> = []

  let balance = box.balance
  let cumulativeInterest = 0
  let cumulativeDeposits = 0

  for (let m = 1; m <= months; m++) {
    // Interest for this month
    const interest = balance * monthlyRate
    balance += interest
    cumulativeInterest += interest

    // Monthly deposit (if any)
    balance += monthlyDeposit
    cumulativeDeposits += monthlyDeposit

    projection.push({
      month: m,
      balance: Math.round(balance),
      interest: Math.round(interest),
      deposit: monthlyDeposit,
      cumulativeInterest: Math.round(cumulativeInterest),
      cumulativeDeposits: Math.round(cumulativeDeposits),
    })
  }

  res.json({
    currentBalance: box.balance,
    rateEA: box.bank_rate,
    monthlyRate: Math.round(monthlyRate * 10000) / 100, // as percentage with 2 decimals
    monthlyDeposit,
    projection,
    finalBalance: Math.round(balance),
    totalInterest: Math.round(cumulativeInterest),
    totalDeposits: Math.round(cumulativeDeposits),
  })
})

// POST /api/ahorros/boxes
router.post('/boxes', (req: AuthRequest, res: Response) => {
  const { name, bank_id, goal = 0, balance = 0 } = req.body
  if (!name || !bank_id) {
    res.status(400).json({ error: 'Nombre y banco son requeridos' })
    return
  }

  const result = db.prepare(`
    INSERT INTO savings_boxes (name, bank_id, balance, goal, user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, bank_id, balance, goal, req.user!.id)

  const box = db.prepare(`
    SELECT sb.*, b.name as bank_name, b.rate_ea as bank_rate
    FROM savings_boxes sb
    JOIN banks b ON sb.bank_id = b.id
    WHERE sb.id = ?
  `).get(result.lastInsertRowid)

  res.status(201).json(box)
})

// PUT /api/ahorros/boxes/:id
router.put('/boxes/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { name, bank_id, goal } = req.body

  const existing = db.prepare('SELECT id FROM savings_boxes WHERE id = ? AND user_id = ?').get(id, req.user!.id)
  if (!existing) {
    res.status(404).json({ error: 'Cajita no encontrada' })
    return
  }

  db.prepare(`
    UPDATE savings_boxes
    SET name = COALESCE(?, name), bank_id = COALESCE(?, bank_id), goal = COALESCE(?, goal), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(name, bank_id, goal, id, req.user!.id)

  const updated = db.prepare(`
    SELECT sb.*, b.name as bank_name, b.rate_ea as bank_rate
    FROM savings_boxes sb JOIN banks b ON sb.bank_id = b.id
    WHERE sb.id = ?
  `).get(id)

  res.json(updated)
})

// DELETE /api/ahorros/boxes/:id
router.delete('/boxes/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  // Delete related data first
  db.prepare('DELETE FROM savings_movements WHERE savings_box_id = ?').run(id)
  db.prepare('DELETE FROM rate_history WHERE savings_box_id = ?').run(id)
  const result = db.prepare('DELETE FROM savings_boxes WHERE id = ? AND user_id = ?').run(id, userId)

  if (result.changes === 0) {
    res.status(404).json({ error: 'Cajita no encontrada' })
    return
  }

  res.json({ message: 'Cajita eliminada' })
})

// ==================== MOVEMENTS ====================

// POST /api/ahorros/boxes/:id/movements
router.post('/boxes/:id/movements', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { type, amount, description, date } = req.body

  if (!type || !amount) {
    res.status(400).json({ error: 'Tipo y monto son requeridos' })
    return
  }

  if (!['deposit', 'withdrawal', 'interest'].includes(type)) {
    res.status(400).json({ error: 'Tipo debe ser deposit, withdrawal o interest' })
    return
  }

  // Verify box ownership
  const box = db.prepare('SELECT id, balance FROM savings_boxes WHERE id = ? AND user_id = ?').get(id, req.user!.id) as any
  if (!box) {
    res.status(404).json({ error: 'Cajita no encontrada' })
    return
  }

  // Insert movement
  const result = db.prepare(`
    INSERT INTO savings_movements (savings_box_id, type, amount, description, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, type, amount, description || null, date || new Date().toISOString().split('T')[0])

  // Update balance
  const balanceChange = type === 'withdrawal' ? -amount : amount
  db.prepare('UPDATE savings_boxes SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(balanceChange, id)

  const movement = db.prepare('SELECT * FROM savings_movements WHERE id = ?').get(result.lastInsertRowid)
  const updatedBox = db.prepare('SELECT balance FROM savings_boxes WHERE id = ?').get(id) as any

  res.status(201).json({ movement, newBalance: updatedBox.balance })
})

// ==================== SUMMARY ====================

// GET /api/ahorros/summary
router.get('/summary', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(balance), 0) as total_savings,
      COALESCE(SUM(goal), 0) as total_goals,
      COUNT(*) as box_count
    FROM savings_boxes
    WHERE user_id = ?
  `).get(userId) as any

  const interestThisMonth = db.prepare(`
    SELECT COALESCE(SUM(sm.amount), 0) as total
    FROM savings_movements sm
    JOIN savings_boxes sb ON sm.savings_box_id = sb.id
    WHERE sb.user_id = ? AND sm.type = 'interest' AND sm.date >= date('now', 'start of month')
  `).get(userId) as any

  res.json({
    totalSavings: totals.total_savings,
    totalGoals: totals.total_goals,
    boxCount: totals.box_count,
    interestThisMonth: interestThisMonth.total,
    progressPercent: totals.total_goals > 0
      ? Math.round((totals.total_savings / totals.total_goals) * 100)
      : 0,
  })
})

export default router
