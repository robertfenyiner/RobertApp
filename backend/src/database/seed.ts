import db, { initDatabase } from './index'
import bcrypt from 'bcryptjs'

export async function seedDatabase() {
  initDatabase()
  console.log('🌱 Seeding database...')

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any
  if (userCount.count > 0) {
    console.log('⚠️  Database already seeded, skipping')
    return
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash('robert2026', 12)
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
    'Robert', 'robert@robertapp.com', hashedPassword, 'admin'
  )

  // Consolidated categories
  const categories = [
    { name: 'Alimentación', icon: '🍔', color: '#10b981' },
    { name: 'Transporte', icon: '🚗', color: '#3b82f6' },
    { name: 'Salud', icon: '❤️', color: '#ef4444' },
    { name: 'Entretenimiento', icon: '🎬', color: '#f59e0b' },
    { name: 'Compras', icon: '🛒', color: '#8b5cf6' },
    { name: 'Servicios Públicos', icon: '⚡', color: '#06b6d4' },
    { name: 'Internet/Telefonía', icon: '📶', color: '#6366f1' },
    { name: 'Streaming', icon: '📺', color: '#e50914' },
    { name: 'Seguros', icon: '🛡️', color: '#059669' },
    { name: 'Banco/Tarjetas', icon: '💳', color: '#dc2626' },
    { name: 'Educación', icon: '📚', color: '#1d4ed8' },
    { name: 'Viajes', icon: '✈️', color: '#0ea5e9' },
    { name: 'Hogar', icon: '🏠', color: '#d97706' },
    { name: 'Cuidado Personal', icon: '💇', color: '#be185d' },
    { name: 'Hosting/Dominios', icon: '🌐', color: '#374151' },
    { name: 'Software/Licencias', icon: '💻', color: '#7c3aed' },
    { name: 'Mascotas', icon: '🐾', color: '#f59e0b' },
    { name: 'Regalos', icon: '🎁', color: '#ec4899' },
    { name: 'Otros', icon: '📋', color: '#64748b' },
  ]

  const insertCat = db.prepare('INSERT INTO categories (name, icon, color, user_id) VALUES (?, ?, ?, 1)')
  for (const c of categories) {
    insertCat.run(c.name, c.icon, c.color)
  }

  // Banks
  const banks = [
    { name: 'Nu Colombia', rate_ea: 8.75 },
    { name: 'Bold', rate_ea: 8.50 },
    { name: 'Bancolombia', rate_ea: 5.50 },
    { name: 'Nequi', rate_ea: 3.00 },
    { name: 'Davivienda', rate_ea: 4.25 },
  ]
  const insertBank = db.prepare('INSERT INTO banks (name, rate_ea, user_id) VALUES (?, ?, 1)')
  for (const b of banks) {
    insertBank.run(b.name, b.rate_ea)
  }

  // Savings boxes
  const boxes = [
    { name: 'Fondo de emergencia', bank_id: 1, balance: 4100000, goal: 10000000 },
    { name: 'Inversión inicial', bank_id: 1, balance: 3200000, goal: 5000000 },
    { name: 'Viaje Europa', bank_id: 2, balance: 2400000, goal: 8000000 },
    { name: 'MacBook Pro', bank_id: 3, balance: 1700000, goal: 7000000 },
  ]
  const insertBox = db.prepare('INSERT INTO savings_boxes (name, bank_id, balance, goal, user_id) VALUES (?, ?, ?, ?, 1)')
  for (const b of boxes) {
    insertBox.run(b.name, b.bank_id, b.balance, b.goal)
  }

  // Expenses — multi-currency (COP=1, USD=2, EUR=3)
  // cat IDs: 1=Alim, 2=Transp, 3=Salud, 4=Entret, 5=Compras, 6=Serv.Pub, 7=Internet,
  //          8=Streaming, 9=Seguros, 10=Banco, 11=Educ, 12=Viajes, 13=Hogar,
  //          14=Cuidado, 15=Hosting, 16=Software, 17=Mascotas, 18=Regalos, 19=Otros
  const expenses = [
    { desc: 'Mercado semanal', amount: 185000, cur: 1, cat: 1, date: '2026-03-15', cop: 185000, rate: 1 },
    { desc: 'Netflix Premium', amount: 15.49, cur: 2, cat: 8, date: '2026-03-01', rec: true, freq: 'monthly', cop: 65500, rate: 4228.5 },
    { desc: 'Spotify Family', amount: 9.99, cur: 2, cat: 8, date: '2026-03-01', rec: true, freq: 'monthly', cop: 42250, rate: 4228.5 },
    { desc: 'Amazon Prime Video', amount: 4.99, cur: 2, cat: 8, date: '2026-03-01', rec: true, freq: 'monthly', cop: 21100, rate: 4228.5 },
    { desc: 'Internet Claro 300MB', amount: 89000, cur: 1, cat: 7, date: '2026-03-05', rec: true, freq: 'monthly', cop: 89000, rate: 1 },
    { desc: 'Gasolina', amount: 92000, cur: 1, cat: 2, date: '2026-03-12', cop: 92000, rate: 1 },
    { desc: 'Curso Udemy React', amount: 12.99, cur: 2, cat: 11, date: '2026-03-10', cop: 54900, rate: 4228.5 },
    { desc: 'Seguro de vida', amount: 45.00, cur: 2, cat: 9, date: '2026-03-01', rec: true, freq: 'monthly', cop: 190300, rate: 4228.5 },
    { desc: 'Vuelo Bogotá-Cartagena', amount: 320000, cur: 1, cat: 12, date: '2026-03-08', cop: 320000, rate: 1 },
    { desc: 'DigitalOcean VPS', amount: 24.00, cur: 2, cat: 15, date: '2026-03-01', rec: true, freq: 'monthly', cop: 101500, rate: 4228.5 },
    { desc: 'Dominio .com', amount: 12.00, cur: 2, cat: 15, date: '2026-01-15', rec: true, freq: 'yearly', cop: 50700, rate: 4228.5 },
    { desc: 'JetBrains All Products', amount: 24.90, cur: 3, cat: 16, date: '2026-03-01', rec: true, freq: 'monthly', cop: 115600, rate: 4642.2 },
  ]

  const insertExpense = db.prepare(`
    INSERT INTO expenses (description, amount, currency_id, amount_cop, exchange_rate, category_id, user_id, date, is_recurring, recurring_frequency, next_due_date)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `)

  for (const e of expenses) {
    // Calculate next_due_date for recurring
    let nextDue: string | null = null
    if (e.rec && e.freq) {
      const d = new Date(e.date)
      switch (e.freq) {
        case 'daily': d.setDate(d.getDate() + 1); break
        case 'weekly': d.setDate(d.getDate() + 7); break
        case 'monthly': d.setMonth(d.getMonth() + 1); break
        case 'yearly': d.setFullYear(d.getFullYear() + 1); break
      }
      nextDue = d.toISOString().split('T')[0]
    }
    insertExpense.run(
      e.desc, e.amount, e.cur, e.cop, e.rate,
      e.cat, e.date, e.rec ? 1 : 0, e.freq || null, nextDue,
    )
  }

  console.log('✅ Database seeded successfully')
  console.log(`   👤 User: robert@robertapp.com / robert2026`)
  console.log(`   📁 ${categories.length} categories`)
  console.log(`   🏦 ${banks.length} banks`)
  console.log(`   💰 ${boxes.length} savings boxes`)
  console.log(`   🧾 ${expenses.length} expenses (COP, USD, EUR)`)
}

seedDatabase().catch(console.error)
