import { useEffect, useState, useCallback, useRef } from 'react'
import {
  PiggyBank, Plus, TrendingUp, Building2, Percent, DollarSign,
  Loader2, X, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle,
  Sparkles, ChevronDown, ChevronUp, Calculator,
} from 'lucide-react'
import { ahorrosAPI } from '@/lib/api'

/* ===== Helpers ===== */
function fmt(n: number) { return '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 0 }) }
function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) }
function getProgressColor(p: number) {
  if (p >= 75) return 'var(--color-success)'
  if (p >= 50) return 'var(--color-accent)'
  if (p >= 25) return 'var(--color-warning)'
  return 'var(--color-danger)'
}
const MOVE_ICONS: Record<string, any> = { deposit: ArrowUpCircle, withdrawal: ArrowDownCircle, interest: Sparkles }
const MOVE_LABELS: Record<string, string> = { deposit: 'Depósito', withdrawal: 'Retiro', interest: 'Intereses' }
const MOVE_COLORS: Record<string, string> = { deposit: 'var(--color-success)', withdrawal: 'var(--color-danger)', interest: 'var(--color-accent)' }

/* ===== Component ===== */
export default function AhorrosPage() {
  const [boxes, setBoxes] = useState<any[]>([])
  const [banks, setBanks] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Box form
  const [showBoxForm, setShowBoxForm] = useState(false)
  const [editingBoxId, setEditingBoxId] = useState<number | null>(null)
  const [boxForm, setBoxForm] = useState({ name: '', bank_id: 0, goal: 0, balance: 0 })

  // Bank panel
  const [showBanks, setShowBanks] = useState(false)
  const [editingBankId, setEditingBankId] = useState<number | null>(null)
  const [bankForm, setBankForm] = useState({ name: '', rate_ea: 0 })

  // Detail modal
  const [selectedBox, setSelectedBox] = useState<any>(null)
  const [boxDetail, setBoxDetail] = useState<any>(null)
  const [projection, setProjection] = useState<any>(null)
  const [projMonths, setProjMonths] = useState(12)
  const [projDeposit, setProjDeposit] = useState(0)
  const [moveForm, setMoveForm] = useState({ type: 'deposit', amount: 0, description: '' })
  const [newRate, setNewRate] = useState<number | null>(null)
  const [changingRate, setChangingRate] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const [boxRes, bankRes, sumRes] = await Promise.all([
        ahorrosAPI.boxes(), ahorrosAPI.banks(), ahorrosAPI.summary(),
      ])
      setBoxes(boxRes.data); setBanks(bankRes.data); setSummary(sumRes.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Box CRUD
  const openCreateBox = () => { setEditingBoxId(null); setBoxForm({ name: '', bank_id: banks[0]?.id || 0, goal: 0, balance: 0 }); setShowBoxForm(true) }
  const openEditBox = (b: any) => { setEditingBoxId(b.id); setBoxForm({ name: b.name, bank_id: b.bank_id, goal: b.goal, balance: b.balance }); setShowBoxForm(true) }
  const handleBoxSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingBoxId) { await ahorrosAPI.updateBox(editingBoxId, { name: boxForm.name, bank_id: boxForm.bank_id, goal: boxForm.goal }) }
      else { await ahorrosAPI.createBox(boxForm) }
      setShowBoxForm(false); setEditingBoxId(null); fetchData()
    } catch (err) { console.error(err) }
  }
  const handleDeleteBox = async (id: number) => {
    if (!confirm('¿Eliminar esta cajita y todos sus movimientos?')) return
    await ahorrosAPI.deleteBox(id).catch(console.error); fetchData()
    if (selectedBox?.id === id) { setSelectedBox(null); setBoxDetail(null) }
  }

  // Bank CRUD
  const handleBankSubmit = async () => {
    if (!bankForm.name || !bankForm.rate_ea) return
    try {
      if (editingBankId) { await ahorrosAPI.updateBank(editingBankId, bankForm) }
      else { await ahorrosAPI.createBank(bankForm) }
      setBankForm({ name: '', rate_ea: 0 }); setEditingBankId(null); fetchData()
    } catch (err) { console.error(err) }
  }
  const handleDeleteBank = async (id: number) => {
    if (!confirm('¿Eliminar este banco?')) return
    try { await ahorrosAPI.deleteBank(id); fetchData() }
    catch (err: any) { alert(err.response?.data?.error || 'Error al eliminar') }
  }

  // Detail modal
  const openDetail = async (box: any) => {
    setSelectedBox(box)
    setNewRate(null)
    setChangingRate(false)
    // Scroll page to top immediately
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const r = await ahorrosAPI.boxDetail(box.id)
      setBoxDetail(r.data)
      setNewRate(r.data.bank_rate)
      const p = await ahorrosAPI.projection(box.id, { months: projMonths, monthly_deposit: projDeposit })
      setProjection(p.data)
    } catch (err) { console.error(err) }
    // Scroll modal overlay to top after it renders
    requestAnimationFrame(() => {
      if (overlayRef.current) overlayRef.current.scrollTop = 0
      if (modalRef.current) modalRef.current.scrollTop = 0
    })
  }
  const handleChangeRate = async () => {
    if (!selectedBox || newRate === null) return
    setChangingRate(true)
    try {
      await ahorrosAPI.changeRate(selectedBox.id, newRate)
      const r = await ahorrosAPI.boxDetail(selectedBox.id)
      setBoxDetail(r.data)
      fetchProjection(selectedBox.id, projMonths, projDeposit)
      fetchData()
    } catch (err) { console.error(err) }
    setChangingRate(false)
  }
  const fetchProjection = async (boxId: number, months: number, deposit: number) => {
    try {
      const p = await ahorrosAPI.projection(boxId, { months, monthly_deposit: deposit })
      setProjection(p.data)
    } catch (err) { console.error(err) }
  }
  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBox || !moveForm.amount) return
    try {
      await ahorrosAPI.addMovement(selectedBox.id, { type: moveForm.type, amount: moveForm.amount, description: moveForm.description })
      setMoveForm({ type: 'deposit', amount: 0, description: '' })
      const r = await ahorrosAPI.boxDetail(selectedBox.id)
      setBoxDetail(r.data)
      fetchProjection(selectedBox.id, projMonths, projDeposit)
      fetchData()
    } catch (err) { console.error(err) }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} className="loading-spin" style={{ color: 'var(--color-accent)' }} />
    </div>
  )

  const totalAhorros = summary?.totalSavings || 0
  const avgRate = banks.length > 0 ? banks.reduce((s: number, b: any) => s + b.rate_ea, 0) / banks.length : 0

  return (
    <div className="animate-fade-in ahorros-page">
      {/* Header */}
      <div className="ahorros-header">
        <div>
          <h1 className="page-title">Ahorros</h1>
          <p className="page-subtitle">Cajitas de ahorro, interés compuesto y proyecciones</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setShowBanks(!showBanks)}>
            <Building2 size={15} /> <span className="hide-mobile">Bancos</span> {showBanks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button className="btn btn-primary" onClick={showBoxForm ? () => { setShowBoxForm(false); setEditingBoxId(null) } : openCreateBox}>
            {showBoxForm ? <X size={16} /> : <Plus size={16} />} <span className="hide-mobile">{showBoxForm ? 'Cancelar' : 'Nueva Cajita'}</span>
          </button>
        </div>
      </div>

      {/* Bank Panel */}
      {showBanks && (
        <div className="card animate-fade-in" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 600 }}>🏦 Gestionar Bancos</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <input className="input" placeholder="Nombre del banco" value={bankForm.name}
              onChange={e => setBankForm({ ...bankForm, name: e.target.value })} style={{ width: 200 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input className="input" type="number" step="0.01" placeholder="Tasa EA%" value={bankForm.rate_ea || ''}
                onChange={e => setBankForm({ ...bankForm, rate_ea: Number(e.target.value) })} style={{ width: 100 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>% EA</span>
            </div>
            <button className="btn btn-success" onClick={handleBankSubmit} style={{ padding: '6px 14px' }}>{editingBankId ? 'Actualizar' : 'Crear'}</button>
            {editingBankId && <button className="btn btn-ghost" onClick={() => { setEditingBankId(null); setBankForm({ name: '', rate_ea: 0 }) }}>Cancelar</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {banks.map(b => (
              <span key={b.id} className="badge" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
                onClick={() => { setEditingBankId(b.id); setBankForm({ name: b.name, rate_ea: b.rate_ea }) }}>
                <Building2 size={11} /> {b.name} ({b.rate_ea}%)
                <button onClick={ev => { ev.stopPropagation(); handleDeleteBank(b.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, marginLeft: 2, opacity: 0.6, display: 'inline-flex' }}><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Box Create/Edit Form */}
      {showBoxForm && (
        <div className="card animate-fade-in" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 600 }}>
            {editingBoxId ? '✏️ Editar cajita' : '➕ Nueva cajita'}
          </h3>
          <form onSubmit={handleBoxSubmit} className="box-form-grid">
            <div><label className="form-label">Nombre *</label>
              <input className="input" required placeholder="Ej: Fondo viaje" value={boxForm.name} onChange={e => setBoxForm({ ...boxForm, name: e.target.value })} /></div>
            <div><label className="form-label">Banco *</label>
              <select className="input" required value={boxForm.bank_id || ''} onChange={e => setBoxForm({ ...boxForm, bank_id: Number(e.target.value) })}>
                <option value="">Seleccionar</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.name} ({b.rate_ea}%)</option>)}
              </select></div>
            <div><label className="form-label">Meta</label>
              <input className="input" type="number" placeholder="0" value={boxForm.goal || ''} onChange={e => setBoxForm({ ...boxForm, goal: Number(e.target.value) })} /></div>
            {!editingBoxId && <div><label className="form-label">Saldo inicial</label>
              <input className="input" type="number" placeholder="0" value={boxForm.balance || ''} onChange={e => setBoxForm({ ...boxForm, balance: Number(e.target.value) })} /></div>}
            <button type="submit" className="btn btn-success" style={{ alignSelf: 'end', height: 40 }}>{editingBoxId ? 'Guardar' : 'Crear'}</button>
          </form>
        </div>
      )}

      {/* Boxes Grid */}
      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, marginTop: 8 }}>Cajitas de Ahorro</h2>
      <div className="boxes-grid">
        {boxes.map((cajita: any) => {
          const progress = cajita.goal > 0 ? Math.round((cajita.balance / cajita.goal) * 100) : 0
          return (
            <div key={cajita.id} className="card cajita-card" onClick={() => openDetail(cajita)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{cajita.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <Building2 size={12} />{cajita.bank_name}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="badge badge-accent">{cajita.bank_rate}% EA</span>
                  <button onClick={ev => { ev.stopPropagation(); openEditBox(cajita) }} className="icon-btn accent"><Pencil size={14} /></button>
                  <button onClick={ev => { ev.stopPropagation(); handleDeleteBox(cajita.id) }} className="icon-btn danger"><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>{fmt(cajita.balance)}</div>
              {/* Daily earnings */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: cajita.goal > 0 ? 8 : 0 }}>
                <Sparkles size={13} style={{ color: 'var(--color-success)' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 600 }}>+{fmt(cajita.dailyEarnings || 0)}/día</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>({cajita.bank_rate}% EA)</span>
              </div>
              {cajita.goal > 0 && (
                <>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>Meta: {fmt(cajita.goal)}</div>
                  <div style={{ width: '100%', height: 6, background: 'var(--color-bg-hover)', borderRadius: 9999, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: getProgressColor(progress), borderRadius: 9999, transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: getProgressColor(progress) }}>{progress}% completado</span>
                </>
              )}
            </div>
          )
        })}
        {boxes.length === 0 && <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>No tienes cajitas. ¡Crea tu primera!</div>}
      </div>

      {/* ===== Detail Modal ===== */}
      {selectedBox && boxDetail && (
        <div ref={overlayRef} className="modal-overlay" onClick={() => { setSelectedBox(null); setBoxDetail(null); setProjection(null) }}>
          <div ref={modalRef} className="card modal-content modal-large" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{boxDetail.name}</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Building2 size={12} /> {boxDetail.bank_name} · <span style={{ color: 'var(--color-accent)' }}>{boxDetail.bank_rate}% EA</span>
                </div>
              </div>
              <button onClick={() => { setSelectedBox(null); setBoxDetail(null); setProjection(null) }} className="icon-btn"><X size={22} /></button>
            </div>

            {/* Balance summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-success-soft)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-success)', fontWeight: 500 }}>Saldo Actual</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-success)' }}>{fmt(boxDetail.balance)}</div>
              </div>
              {boxDetail.goal > 0 && (
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-accent-soft)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-accent)', fontWeight: 500 }}>Meta</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-accent)' }}>{fmt(boxDetail.goal)}</div>
                </div>
              )}
            </div>

            {/* Daily earnings + Rate change */}
            <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} style={{ color: 'var(--color-success)' }} />
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Ganancia Diaria</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-success)' }}>+{fmt(boxDetail.dailyEarnings || 0)}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Ganancia Mensual (aprox)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-accent)' }}>+{fmt((boxDetail.dailyEarnings || 0) * 30)}</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Cambiar Tasa EA %</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" type="number" step="0.01" min="0" value={newRate ?? ''}
                    onChange={e => setNewRate(Number(e.target.value))} style={{ width: 100 }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>% EA</span>
                  <button className="btn btn-primary" onClick={handleChangeRate} disabled={changingRate || newRate === boxDetail.bank_rate}
                    style={{ padding: '4px 12px', fontSize: '0.78rem' }}>
                    {changingRate ? <Loader2 size={14} className="loading-spin" /> : 'Aplicar'}
                  </button>
                </div>
                {boxDetail.rateHistory && boxDetail.rateHistory.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Historial de tasas:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {boxDetail.rateHistory.slice(0, 5).map((rh: any, i: number) => (
                        <span key={rh.id || i} style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, background: i === 0 ? 'var(--color-accent-soft)' : 'var(--color-bg-hover)', color: i === 0 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                          {rh.rate_ea}% {rh.start_date ? `(${rh.start_date})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Add movement */}
            <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 600 }}>Agregar Movimiento</h4>
              <form onSubmit={handleAddMovement} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                <select className="input" value={moveForm.type} onChange={e => setMoveForm({ ...moveForm, type: e.target.value })} style={{ width: 120 }}>
                  <option value="deposit">Depósito</option>
                  <option value="withdrawal">Retiro</option>
                  <option value="interest">Intereses</option>
                </select>
                <input className="input" type="number" step="0.01" min="0.01" placeholder="Monto" required
                  value={moveForm.amount || ''} onChange={e => setMoveForm({ ...moveForm, amount: Number(e.target.value) })} style={{ width: 120 }} />
                <input className="input" placeholder="Descripción (opcional)"
                  value={moveForm.description} onChange={e => setMoveForm({ ...moveForm, description: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
                <button type="submit" className="btn btn-success" style={{ padding: '6px 14px' }}>Agregar</button>
              </form>
            </div>

            {/* Projection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Calculator size={16} style={{ color: 'var(--color-accent)' }} />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>Proyección de Interés Compuesto</h4>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>Meses: <strong style={{ color: 'var(--color-accent)' }}>{projMonths}</strong></label>
                  <input type="range" min={1} max={60} value={projMonths} onChange={e => {
                    const m = Number(e.target.value); setProjMonths(m); if (selectedBox) fetchProjection(selectedBox.id, m, projDeposit)
                  }} style={{ width: 150, accentColor: 'var(--color-accent)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>Depósito mensual</label>
                  <input className="input" type="number" value={projDeposit || ''} placeholder="0"
                    onChange={e => { const d = Number(e.target.value); setProjDeposit(d); if (selectedBox) fetchProjection(selectedBox.id, projMonths, d) }}
                    style={{ width: 120 }} />
                </div>
              </div>
              {projection && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ padding: 10, borderRadius: 8, background: 'var(--color-bg-elevated)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Saldo Final</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-success)' }}>{fmt(projection.finalBalance)}</div>
                    </div>
                    <div style={{ padding: 10, borderRadius: 8, background: 'var(--color-bg-elevated)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Intereses ganados</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-accent)' }}>{fmt(projection.totalInterest)}</div>
                    </div>
                    <div style={{ padding: 10, borderRadius: 8, background: 'var(--color-bg-elevated)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Tasa mensual</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-warning)' }}>{projection.monthlyRate}%</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Movements */}
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 600 }}>Historial de Movimientos</h4>
              {boxDetail.movements && boxDetail.movements.length > 0 ? (
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {(() => {
                    // Build map of rate change dates → { from, to }
                    const rateChangeDates: Record<string, { from: number; to: number }> = {}
                    if (boxDetail.rateHistory && boxDetail.rateHistory.length > 1) {
                      const sorted = [...boxDetail.rateHistory].sort((a: any, b: any) => a.start_date.localeCompare(b.start_date))
                      for (let i = 1; i < sorted.length; i++) {
                        rateChangeDates[sorted[i].start_date] = { from: sorted[i - 1].rate_ea, to: sorted[i].rate_ea }
                      }
                    }
                    let lastShownChangeDate = ''
                    return boxDetail.movements.map((m: any) => {
                      const Icon = MOVE_ICONS[m.type] || DollarSign
                      const rateChange = rateChangeDates[m.date]
                      const showBanner = rateChange && m.date !== lastShownChangeDate
                      if (showBanner) lastShownChangeDate = m.date
                      return (
                        <div key={m.id}>
                          {showBanner && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '6px 12px', margin: '6px 0', borderRadius: 6,
                              background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
                              border: '1px solid rgba(245,158,11,0.3)',
                            }}>
                              <Percent size={13} style={{ color: 'var(--color-warning)' }} />
                              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--color-warning)' }}>
                                ⚡ Cambio de tasa: {rateChange.from}% → {rateChange.to}% EA
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{fmtDate(m.date)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                            <Icon size={18} style={{ color: MOVE_COLORS[m.type], flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{MOVE_LABELS[m.type]}</div>
                              {m.description && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{m.description}</div>}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: MOVE_COLORS[m.type] }}>
                                {m.type === 'withdrawal' ? '-' : '+'}{fmt(m.amount)}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{fmtDate(m.date)}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ) : <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>Sin movimientos</p>}
            </div>
          </div>
        </div>
      )}

      {/* Scoped Styles */}
      <style>{`
        .loading-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ahorros-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
        .btn-ghost { background: var(--color-bg-elevated); border: 1px solid var(--color-border); }
        .icon-btn { padding: 4px; background: none; border: none; cursor: pointer; color: var(--color-text-muted); display: inline-flex; align-items: center; }
        .icon-btn.accent { color: var(--color-accent); }
        .icon-btn.danger { color: var(--color-danger); }
        .icon-btn:hover { opacity: 0.7; }
        .form-label { display: block; font-size: 0.76rem; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px; }
        .box-form-grid { display: grid; grid-template-columns: 1.5fr 1fr 0.7fr 0.7fr auto; gap: 12px; align-items: end; }
        .boxes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .cajita-card { padding: 20px; cursor: pointer; transition: all var(--transition-fast); }
        .cajita-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; overflow-y: auto; padding: 32px 16px; }
        .modal-content { padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; position: relative; }
        .modal-large { max-width: 640px; }
        .hide-mobile { display: inline; }
        @media (max-width: 768px) {
          .hide-mobile { display: none; }
          .box-form-grid { grid-template-columns: 1fr 1fr; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .modal-overlay { padding: 0; }
          .modal-content { max-width: 100%; border-radius: 0; min-height: 100vh; padding: 16px 16px 32px; margin: 0; }
          .modal-large { max-width: 100%; }
        }
        @media (max-width: 480px) {
          .box-form-grid { grid-template-columns: 1fr; }
          .boxes-grid { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
