import { Router, Response } from 'express'
import db from '../../database'
import { authRequired, type AuthRequest } from '../../middleware/auth'
import { sendTestEmail, sendRecurringExpenseReminder } from '../../services/emailService'

const router = Router()
router.use(authRequired)

// GET /api/notifications/settings
router.get('/settings', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  let settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId) as any

  if (!settings) {
    // Create default settings
    db.prepare(`
      INSERT INTO notification_settings (user_id, email_enabled, email_address, notify_days_before)
      VALUES (?, 1, ?, 1)
    `).run(userId, req.user!.email)

    settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId)
  }

  res.json(settings)
})

// PUT /api/notifications/settings
router.put('/settings', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const { email_enabled, email_address, telegram_enabled, telegram_chat_id, notify_days_before } = req.body

  // Ensure settings exist
  const existing = db.prepare('SELECT id FROM notification_settings WHERE user_id = ?').get(userId)
  if (!existing) {
    db.prepare(`
      INSERT INTO notification_settings (user_id, email_enabled, email_address, notify_days_before)
      VALUES (?, 1, ?, 1)
    `).run(userId, req.user!.email)
  }

  db.prepare(`
    UPDATE notification_settings
    SET email_enabled = COALESCE(?, email_enabled),
        email_address = COALESCE(?, email_address),
        telegram_enabled = COALESCE(?, telegram_enabled),
        telegram_chat_id = COALESCE(?, telegram_chat_id),
        notify_days_before = COALESCE(?, notify_days_before),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    email_enabled !== undefined ? (email_enabled ? 1 : 0) : null,
    email_address, telegram_enabled !== undefined ? (telegram_enabled ? 1 : 0) : null,
    telegram_chat_id, notify_days_before, userId,
  )

  const updated = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId)
  res.json(updated)
})

// POST /api/notifications/test — send test email
router.post('/test', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const settings = db.prepare('SELECT * FROM notification_settings WHERE user_id = ?').get(userId) as any

  if (!settings?.email_address) {
    res.status(400).json({ error: 'No hay dirección de email configurada' })
    return
  }

  try {
    await sendTestEmail(settings.email_address)
    res.json({ message: `Email de prueba enviado a ${settings.email_address}` })
  } catch (err: any) {
    console.error('Test email error:', err)
    res.status(500).json({ error: `Error al enviar email: ${err.message}` })
  }
})

// POST /api/notifications/check-due — check and notify upcoming expenses
router.post('/check-due', async (req: AuthRequest, res: Response) => {
  try {
    const result = await checkAndNotifyDueExpenses()
    res.json(result)
  } catch (err: any) {
    console.error('Check-due error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ===== Scheduler Logic =====
export async function checkAndNotifyDueExpenses() {
  const usersWithNotifications = db.prepare(`
    SELECT ns.*, u.email as user_email, u.name as user_name
    FROM notification_settings ns
    JOIN users u ON ns.user_id = u.id
    WHERE ns.email_enabled = 1 AND ns.email_address IS NOT NULL
  `).all() as any[]

  let totalNotified = 0

  for (const settings of usersWithNotifications) {
    const daysAdvance = settings.notify_days_before || 1

    const dueExpenses = db.prepare(`
      SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
             cur.code as currency_code, cur.symbol as currency_symbol
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      JOIN currencies cur ON e.currency_id = cur.id
      WHERE e.user_id = ? AND e.is_recurring = 1
        AND e.next_due_date IS NOT NULL
        AND e.next_due_date <= date('now', '+' || ? || ' days')
        AND e.next_due_date >= date('now')
      ORDER BY e.next_due_date ASC
    `).all(settings.user_id, daysAdvance) as any[]

    if (dueExpenses.length > 0) {
      try {
        await sendRecurringExpenseReminder(settings.email_address, dueExpenses)
        totalNotified += dueExpenses.length
        console.log(`📧 Enviado recordatorio a ${settings.email_address}: ${dueExpenses.length} gastos`)
      } catch (err) {
        console.error(`Error enviando a ${settings.email_address}:`, err)
      }
    }
  }

  return { message: `Revisión completada. ${totalNotified} notificaciones enviadas.`, notified: totalNotified }
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null

export function startNotificationScheduler() {
  // Run every 12 hours
  const INTERVAL = 12 * 60 * 60 * 1000

  // Initial check after 30 seconds (let server start)
  setTimeout(() => {
    checkAndNotifyDueExpenses().catch(err => console.error('Scheduled check failed:', err))
  }, 30_000)

  schedulerInterval = setInterval(() => {
    checkAndNotifyDueExpenses().catch(err => console.error('Scheduled check failed:', err))
  }, INTERVAL)

  console.log('⏰ Notification scheduler started (every 12h)')
}

export function stopNotificationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
}

export default router
