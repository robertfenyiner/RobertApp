import { Router, Response } from 'express'
import db from '../../database'
import { authRequired, type AuthRequest } from '../../middleware/auth'
import { convertToCOP } from '../../services/currencyService'

const router = Router()

// All routes require auth
router.use(authRequired)

// GET /api/gastos — list expenses
router.get('/', (req: AuthRequest, res: Response) => {
  const { category, from, to, search, limit = '50', offset = '0' } = req.query
  const userId = req.user!.id

  let query = `
    SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           cur.code as currency_code, cur.symbol as currency_symbol
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.user_id = ?
  `
  const params: any[] = [userId]

  if (category) {
    query += ' AND c.name = ?'
    params.push(category)
  }
  if (from) {
    query += ' AND e.date >= ?'
    params.push(from)
  }
  if (to) {
    query += ' AND e.date <= ?'
    params.push(to)
  }
  if (search) {
    query += ' AND e.description LIKE ?'
    params.push(`%${search}%`)
  }

  query += ' ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const expenses = db.prepare(query).all(...params)

  // Total for the current filters (use amount_cop for consistent totals)
  let countQuery = `
    SELECT COUNT(*) as total, 
           SUM(COALESCE(amount_cop, amount)) as total_amount_cop,
           SUM(amount) as total_amount
    FROM expenses WHERE user_id = ?
  `
  const countParams: any[] = [userId]

  if (from) {
    countQuery += ' AND date >= ?'
    countParams.push(from)
  }
  if (to) {
    countQuery += ' AND date <= ?'
    countParams.push(to)
  }

  const summary = db.prepare(countQuery).get(...countParams) as any

  res.json({
    expenses,
    total: summary.total,
    totalAmount: summary.total_amount || 0,
    totalAmountCOP: summary.total_amount_cop || 0,
  })
})

// GET /api/gastos/summary — monthly summary
router.get('/summary', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { months = '6' } = req.query

  const monthlySummary = db.prepare(`
    SELECT
      strftime('%Y-%m', date) as month,
      SUM(COALESCE(amount_cop, amount)) as total,
      COUNT(*) as count
    FROM expenses
    WHERE user_id = ? AND date >= date('now', '-' || ? || ' months')
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month DESC
  `).all(userId, Number(months))

  const byCategory = db.prepare(`
    SELECT
      c.name, c.icon, c.color,
      SUM(COALESCE(e.amount_cop, e.amount)) as total,
      COUNT(*) as count
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = ? AND e.date >= date('now', 'start of month')
    GROUP BY c.id
    ORDER BY total DESC
  `).all(userId)

  // Currency breakdown
  const byCurrency = db.prepare(`
    SELECT
      cur.code, cur.name, cur.symbol,
      SUM(e.amount) as total_original,
      SUM(COALESCE(e.amount_cop, e.amount)) as total_cop,
      COUNT(*) as count
    FROM expenses e
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.user_id = ? AND e.date >= date('now', 'start of month')
    GROUP BY cur.id
    ORDER BY total_cop DESC
  `).all(userId)

  res.json({ monthlySummary, byCategory, byCurrency })
})

// POST /api/gastos — create expense
router.post('/', (req: AuthRequest, res: Response) => {
  const {
    description, amount, currency_id = 1, category_id, date,
    is_recurring, recurring_frequency, notes,
  } = req.body
  const userId = req.user!.id

  if (!description || !amount) {
    res.status(400).json({ error: 'Descripción y monto son requeridos' })
    return
  }

  // Get currency code
  const currency = db.prepare('SELECT code FROM currencies WHERE id = ?').get(currency_id) as any
  if (!currency) {
    res.status(400).json({ error: 'Moneda no válida' })
    return
  }

  // Auto-convert to COP
  let amountCOP: number | null = null
  let exchangeRate: number | null = null

  try {
    const conversion = convertToCOP(amount, currency.code)
    amountCOP = conversion.copAmount
    exchangeRate = conversion.exchangeRate
  } catch (err) {
    console.error('Error converting to COP:', err)
    // Continue without conversion — don't block creation
  }

  // Calculate next due date for recurring
  let nextDueDate: string | null = null
  if (is_recurring && recurring_frequency) {
    const d = new Date(date || Date.now())
    switch (recurring_frequency) {
      case 'daily': d.setDate(d.getDate() + 1); break
      case 'weekly': d.setDate(d.getDate() + 7); break
      case 'monthly': d.setMonth(d.getMonth() + 1); break
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break
    }
    nextDueDate = d.toISOString().split('T')[0]
  }

  const result = db.prepare(`
    INSERT INTO expenses (description, amount, currency_id, amount_cop, exchange_rate, category_id, user_id, date, is_recurring, recurring_frequency, next_due_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    description, amount, currency_id, amountCOP, exchangeRate,
    category_id || null, userId,
    date || new Date().toISOString().split('T')[0],
    is_recurring ? 1 : 0, recurring_frequency || null, nextDueDate, notes || null,
  )

  const expense = db.prepare(`
    SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           cur.code as currency_code, cur.symbol as currency_symbol
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.id = ?
  `).get(result.lastInsertRowid)

  res.status(201).json(expense)
})

// PUT /api/gastos/:id — update expense
router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id
  const { description, amount, currency_id, category_id, date, is_recurring, recurring_frequency, notes } = req.body

  const existing = db.prepare('SELECT id FROM expenses WHERE id = ? AND user_id = ?').get(id, userId)
  if (!existing) {
    res.status(404).json({ error: 'Gasto no encontrado' })
    return
  }

  // If amount or currency changed, re-convert
  let amountCOP: number | null = null
  let exchangeRate: number | null = null

  if (amount && currency_id) {
    const currency = db.prepare('SELECT code FROM currencies WHERE id = ?').get(currency_id) as any
    if (currency) {
      try {
        const conversion = convertToCOP(amount, currency.code)
        amountCOP = conversion.copAmount
        exchangeRate = conversion.exchangeRate
      } catch (err) { /* continue */ }
    }
  }

  db.prepare(`
    UPDATE expenses
    SET description = COALESCE(?, description),
        amount = COALESCE(?, amount),
        currency_id = COALESCE(?, currency_id),
        amount_cop = COALESCE(?, amount_cop),
        exchange_rate = COALESCE(?, exchange_rate),
        category_id = COALESCE(?, category_id),
        date = COALESCE(?, date),
        is_recurring = COALESCE(?, is_recurring),
        recurring_frequency = COALESCE(?, recurring_frequency),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    description, amount, currency_id, amountCOP, exchangeRate,
    category_id, date,
    is_recurring !== undefined ? (is_recurring ? 1 : 0) : null,
    recurring_frequency, notes,
    id, userId,
  )

  const updated = db.prepare(`
    SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           cur.code as currency_code, cur.symbol as currency_symbol
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    JOIN currencies cur ON e.currency_id = cur.id
    WHERE e.id = ?
  `).get(id)

  res.json(updated)
})

// DELETE /api/gastos/:id
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  const result = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(id, userId)
  if (result.changes === 0) {
    res.status(404).json({ error: 'Gasto no encontrado' })
    return
  }

  res.json({ message: 'Gasto eliminado' })
})

// GET /api/gastos/categories — list categories
router.get('/categories', (req: AuthRequest, res: Response) => {
  const categories = db.prepare(
    'SELECT * FROM categories WHERE user_id = ? OR user_id IS NULL ORDER BY name'
  ).all(req.user!.id)
  res.json(categories)
})

// POST /api/gastos/categories — create category
router.post('/categories', (req: AuthRequest, res: Response) => {
  const { name, icon, color } = req.body
  if (!name) {
    res.status(400).json({ error: 'Nombre de categoría requerido' })
    return
  }

  const result = db.prepare(
    'INSERT INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, ?)'
  ).run(name, icon || '📦', color || '#6366f1', req.user!.id)

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(category)
})

// PUT /api/gastos/categories/:id — update category
router.put('/categories/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { name, icon, color } = req.body
  const userId = req.user!.id

  const existing = db.prepare('SELECT id FROM categories WHERE id = ? AND (user_id = ? OR user_id IS NULL)').get(id, userId)
  if (!existing) {
    res.status(404).json({ error: 'Categoría no encontrada' })
    return
  }

  db.prepare(`
    UPDATE categories SET name = COALESCE(?, name), icon = COALESCE(?, icon), color = COALESCE(?, color)
    WHERE id = ?
  `).run(name, icon, color, id)

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
  res.json(updated)
})

// DELETE /api/gastos/categories/:id — delete category
router.delete('/categories/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  const existing = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(id, userId)
  if (!existing) {
    res.status(404).json({ error: 'Categoría no encontrada' })
    return
  }

  // Set expenses using this category to null
  db.prepare('UPDATE expenses SET category_id = NULL WHERE category_id = ? AND user_id = ?').run(id, userId)
  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId)
  res.json({ message: 'Categoría eliminada' })
})

export default router

