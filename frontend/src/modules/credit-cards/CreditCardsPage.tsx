import { useEffect, useState } from 'react'
import { CreditCard, Plus, Receipt, Wallet } from 'lucide-react'
import { currenciesAPI } from '@/lib/api'
import { creditCardsAPI } from './creditCardsApi'

const fmt = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO')
const today = () => new Date().toISOString().slice(0, 10)

export default function CreditCardsPage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [summary, setSummary] = useState<any>(null)
  const [cards, setCards] = useState<any[]>([])
  const [charges, setCharges] = useState<any[]>([])
  const [installments, setInstallments] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  const [cardForm, setCardForm] = useState({
    name: '', bank_name: '', country: 'Colombia', last_four: '', network: 'Visa', currency_id: 1,
    credit_limit: 0, interest_rate_monthly: 0, interest_rate_annual: 0, cut_day: 1, payment_due_day: 15, color: '#6366f1',
  })

  const [chargeForm, setChargeForm] = useState({
    card_id: '', description: '', amount: 0, currency_id: 1, purchase_date: today(), installments: 1, interest_rate_monthly: 0, notes: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    card_id: '', amount: 0, currency_id: 1, payment_date: today(), payment_type: 'partial', notes: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [s, c, ch, i, cur] = await Promise.all([
        creditCardsAPI.summary(), creditCardsAPI.cards(), creditCardsAPI.charges(), creditCardsAPI.installments(), currenciesAPI.list(),
      ])
      setSummary(s.data)
      setCards(c.data)
      setCharges(ch.data)
      setInstallments(i.data)
      setCurrencies(cur.data)
      if (c.data[0]) {
        setChargeForm(f => ({ ...f, card_id: String(c.data[0].id), currency_id: c.data[0].currency_id, interest_rate_monthly: c.data[0].interest_rate_monthly || 0 }))
        setPaymentForm(f => ({ ...f, card_id: String(c.data[0].id), currency_id: c.data[0].currency_id }))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createCard = async () => {
    await creditCardsAPI.createCard(cardForm)
    setCardForm({ name: '', bank_name: '', country: 'Colombia', last_four: '', network: 'Visa', currency_id: 1, credit_limit: 0, interest_rate_monthly: 0, interest_rate_annual: 0, cut_day: 1, payment_due_day: 15, color: '#6366f1' })
    setMessage('Tarjeta creada')
    load()
  }

  const startEditCard = (card: any) => {
    setEditingCardId(card.id)
    setEditForm({
      credit_limit: card.credit_limit || 0,
      interest_rate_monthly: card.interest_rate_monthly || 0,
      interest_rate_annual: card.interest_rate_annual || 0,
      cut_day: card.cut_day || 1,
      payment_due_day: card.payment_due_day || 15,
      is_active: card.is_active !== 0,
    })
  }

  const saveEditCard = async () => {
    if (!editingCardId) return
    await creditCardsAPI.updateCard(editingCardId, editForm)
    setMessage('Tarjeta actualizada')
    setEditingCardId(null)
    setEditForm({})
    load()
  }

  const createCharge = async () => {
    await creditCardsAPI.createCharge({ ...chargeForm, card_id: Number(chargeForm.card_id) })
    setChargeForm(f => ({ ...f, description: '', amount: 0, installments: 1, notes: '' }))
    setMessage('Consumo registrado y gasto creado')
    load()
  }

  const createPayment = async () => {
    const r = await creditCardsAPI.createPayment({ ...paymentForm, card_id: Number(paymentForm.card_id) })
    const allocation = r.data?.allocation
    const detail = allocation ? ` Aplicado: ${fmt(allocation.applied)}${allocation.unapplied > 0 ? `, sin aplicar: ${fmt(allocation.unapplied)}` : ''}` : ''
    setPaymentForm(f => ({ ...f, amount: 0, notes: '' }))
    setMessage(`Pago registrado.${detail}`)
    load()
  }

  if (loading) return <div style={{ padding: 40 }}>Cargando tarjetas...</div>

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Tarjetas de Crédito</h1>
        <p className="page-subtitle">Controla tarjetas, consumos, cuotas, pagos y próximos vencimientos</p>
      </div>

      {message && <div className="card" style={{ padding: 12, marginBottom: 16 }}>{message}</div>}

      <div className="cc-grid">
        <Stat title="Deuda estimada" value={fmt(summary?.totalDebt)} icon={<CreditCard />} />
        <Stat title="Cupo total" value={fmt(summary?.totalLimit)} icon={<Wallet />} />
        <Stat title="Cupo disponible" value={fmt(summary?.availableLimit)} icon={<Wallet />} />
        <Stat title="Cuotas próximas" value={summary?.upcoming?.length || 0} icon={<Receipt />} />
      </div>

      <div className="cc-grid two">
        <Panel title="Nueva tarjeta">
          <input className="input" placeholder="Nombre tarjeta" value={cardForm.name} onChange={e => setCardForm({ ...cardForm, name: e.target.value })} />
          <input className="input" placeholder="Banco" value={cardForm.bank_name} onChange={e => setCardForm({ ...cardForm, bank_name: e.target.value })} />
          <select className="input" value={cardForm.country} onChange={e => setCardForm({ ...cardForm, country: e.target.value })}>
            <option>Colombia</option><option>Turquía</option><option>Nigeria</option><option>Otro</option>
          </select>
          <input className="input" placeholder="Últimos 4 dígitos" value={cardForm.last_four} onChange={e => setCardForm({ ...cardForm, last_four: e.target.value })} />
          <select className="input" value={cardForm.currency_id} onChange={e => setCardForm({ ...cardForm, currency_id: Number(e.target.value) })}>{currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
          <input className="input" type="number" placeholder="Cupo" value={cardForm.credit_limit} onChange={e => setCardForm({ ...cardForm, credit_limit: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Tasa mensual %" value={cardForm.interest_rate_monthly} onChange={e => setCardForm({ ...cardForm, interest_rate_monthly: Number(e.target.value) })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="input" type="number" placeholder="Día corte" value={cardForm.cut_day} onChange={e => setCardForm({ ...cardForm, cut_day: Number(e.target.value) })} />
            <input className="input" type="number" placeholder="Día pago" value={cardForm.payment_due_day} onChange={e => setCardForm({ ...cardForm, payment_due_day: Number(e.target.value) })} />
          </div>
          <button className="btn btn-primary" onClick={createCard}><Plus size={16} /> Crear tarjeta</button>
        </Panel>

        <Panel title="Registrar consumo con tarjeta">
          <select className="input" value={chargeForm.card_id} onChange={e => setChargeForm({ ...chargeForm, card_id: e.target.value })}>{cards.map(c => <option key={c.id} value={c.id}>{c.name} - {c.bank_name}</option>)}</select>
          <input className="input" placeholder="Descripción" value={chargeForm.description} onChange={e => setChargeForm({ ...chargeForm, description: e.target.value })} />
          <input className="input" type="number" placeholder="Monto" value={chargeForm.amount} onChange={e => setChargeForm({ ...chargeForm, amount: Number(e.target.value) })} />
          <select className="input" value={chargeForm.currency_id} onChange={e => setChargeForm({ ...chargeForm, currency_id: Number(e.target.value) })}>{currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
          <input className="input" type="date" value={chargeForm.purchase_date} onChange={e => setChargeForm({ ...chargeForm, purchase_date: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="input" type="number" min={1} placeholder="Cuotas" value={chargeForm.installments} onChange={e => setChargeForm({ ...chargeForm, installments: Number(e.target.value) })} />
            <input className="input" type="number" placeholder="Interés mensual %" value={chargeForm.interest_rate_monthly} onChange={e => setChargeForm({ ...chargeForm, interest_rate_monthly: Number(e.target.value) })} />
          </div>
          <button className="btn btn-primary" onClick={createCharge} disabled={!cards.length}>Registrar consumo</button>
        </Panel>
      </div>

      <div className="cc-grid two">
        <Panel title="Registrar pago">
          <select className="input" value={paymentForm.card_id} onChange={e => setPaymentForm({ ...paymentForm, card_id: e.target.value })}>{cards.map(c => <option key={c.id} value={c.id}>{c.name} - {c.bank_name}</option>)}</select>
          <input className="input" type="number" placeholder="Monto pagado" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} />
          <select className="input" value={paymentForm.currency_id} onChange={e => setPaymentForm({ ...paymentForm, currency_id: Number(e.target.value) })}>{currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
          <select className="input" value={paymentForm.payment_type} onChange={e => setPaymentForm({ ...paymentForm, payment_type: e.target.value })}><option value="partial">Parcial</option><option value="minimum">Mínimo</option><option value="full">Total</option><option value="advance">Anticipo</option></select>
          <input className="input" type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
          <button className="btn btn-primary" onClick={createPayment} disabled={!cards.length}>Registrar pago y aplicar a cuotas</button>
        </Panel>

        <Panel title="Mis tarjetas">
          {cards.map(c => <div key={c.id} className="cc-row">
            <strong>{c.name} {c.last_four ? `*${c.last_four}` : ''}</strong>
            <span>{c.bank_name} · {c.country} · {c.currency_code}</span>
            <span>Cupo: {fmt(c.credit_limit)} · Saldo: {fmt(c.pending_balance)} · Disponible: {fmt(Number(c.credit_limit || 0) - Number(c.pending_balance || 0))}</span>
            {editingCardId === c.id ? <div className="edit-grid">
              <input className="input" type="number" placeholder="Cupo" value={editForm.credit_limit} onChange={e => setEditForm({ ...editForm, credit_limit: Number(e.target.value) })} />
              <input className="input" type="number" placeholder="Tasa mensual" value={editForm.interest_rate_monthly} onChange={e => setEditForm({ ...editForm, interest_rate_monthly: Number(e.target.value) })} />
              <input className="input" type="number" placeholder="Día corte" value={editForm.cut_day} onChange={e => setEditForm({ ...editForm, cut_day: Number(e.target.value) })} />
              <input className="input" type="number" placeholder="Día pago" value={editForm.payment_due_day} onChange={e => setEditForm({ ...editForm, payment_due_day: Number(e.target.value) })} />
              <button className="btn btn-primary" onClick={saveEditCard}>Guardar cambios</button>
              <button className="btn" onClick={() => setEditingCardId(null)}>Cancelar</button>
            </div> : <button className="btn" onClick={() => startEditCard(c)}>Editar cupo/tasa/fechas</button>}
          </div>)}
          {!cards.length && <p>No hay tarjetas registradas.</p>}
        </Panel>
      </div>

      <Panel title="Próximas cuotas">
        {installments.slice(0, 16).map(i => <div key={i.id} className="cc-row"><strong>{i.description}</strong><span>{i.card_name} · cuota {i.installment_number} · vence {i.due_date} · {i.status}</span><span>Saldo cuota: {fmt(i.remaining_amount ?? i.total_amount)}</span></div>)}
        {!installments.length && <p>No hay cuotas pendientes.</p>}
      </Panel>

      <Panel title="Últimos consumos">
        {charges.slice(0, 10).map(c => <div key={c.id} className="cc-row"><strong>{c.description}</strong><span>{c.card_name} · {c.purchase_date} · {c.installments} cuota(s)</span><span>{c.currency_symbol}{Number(c.amount).toLocaleString('es-CO')} {c.currency_code}</span></div>)}
      </Panel>

      <style>{`
        .cc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
        .cc-grid.two { grid-template-columns: 1fr 1fr; }
        .cc-row { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
        @media (max-width: 900px) { .cc-grid, .cc-grid.two, .edit-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}

function Stat({ title, value, icon }: any) {
  return <div className="card" style={{ padding: 18 }}><div style={{ color: 'var(--color-accent)', marginBottom: 8 }}>{icon}</div><p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{title}</p><h3 style={{ margin: 0 }}>{value}</h3></div>
}

function Panel({ title, children }: any) {
  return <div className="card" style={{ padding: 20, marginBottom: 16 }}><h3 style={{ marginTop: 0 }}>{title}</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div></div>
}
