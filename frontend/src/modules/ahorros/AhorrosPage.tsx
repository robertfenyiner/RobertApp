import { useEffect, useState } from 'react'
import {
  PiggyBank, Plus, TrendingUp, Building2, ChevronRight,
  Percent, DollarSign, Loader2, X,
} from 'lucide-react'
import { ahorrosAPI } from '@/lib/api'

function getProgressColor(p: number) {
  if (p >= 75) return 'var(--color-success)'
  if (p >= 50) return 'var(--color-accent)'
  if (p >= 25) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

export default function AhorrosPage() {
  const [boxes, setBoxes] = useState<any[]>([])
  const [banks, setBanks] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', bank_id: 0, goal: 0, balance: 0 })

  const fetchData = async () => {
    try {
      const [boxRes, bankRes, sumRes] = await Promise.all([
        ahorrosAPI.boxes(),
        ahorrosAPI.banks(),
        ahorrosAPI.summary(),
      ])
      setBoxes(boxRes.data)
      setBanks(bankRes.data)
      setSummary(sumRes.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await ahorrosAPI.createBox(formData)
      setShowForm(false)
      setFormData({ name: '', bank_id: 0, goal: 0, balance: 0 })
      fetchData()
    } catch (err) { console.error(err) }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const totalAhorros = summary?.totalSavings || 0
  const avgRate = banks.length > 0 ? banks.reduce((s: number, b: any) => s + b.rate_ea, 0) / banks.length : 0

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Ahorros</h1>
          <p className="page-subtitle">Tus cajitas de ahorro, proyecciones e intereses</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} id="btn-nueva-cajita">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Nueva Cajita'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card animate-fade-in" style={{ padding: 20, marginBottom: 16 }}>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Nombre</label>
              <input className="input" placeholder="Ej: Fondo viaje" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Banco</label>
              <select className="input" required value={formData.bank_id || ''} onChange={e => setFormData({ ...formData, bank_id: Number(e.target.value) })}>
                <option value="">Seleccionar</option>
                {banks.map((b: any) => <option key={b.id} value={b.id}>{b.name} ({b.rate_ea}%)</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Meta</label>
              <input className="input" type="number" placeholder="0" value={formData.goal || ''} onChange={e => setFormData({ ...formData, goal: Number(e.target.value) })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Saldo inicial</label>
              <input className="input" type="number" placeholder="0" value={formData.balance || ''} onChange={e => setFormData({ ...formData, balance: Number(e.target.value) })} />
            </div>
            <button type="submit" className="btn btn-success" style={{ height: 40 }}>Crear</button>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid stagger-children">
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}><PiggyBank size={20} /></div>
          <div className="stat-label">Total Ahorrado</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>${totalAhorros.toLocaleString('es-CO')}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}><TrendingUp size={20} /></div>
          <div className="stat-label">Progreso Meta</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>{summary?.progressPercent || 0}%</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}><Percent size={20} /></div>
          <div className="stat-label">Tasa Promedio</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>{avgRate.toFixed(2)}% EA</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}><DollarSign size={20} /></div>
          <div className="stat-label">Cajitas Activas</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>{boxes.length}</div>
        </div>
      </div>

      {/* Boxes */}
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 12, marginTop: 8 }}>Cajitas de Ahorro</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
        {boxes.map((cajita: any) => {
          const progress = cajita.goal > 0 ? Math.round((cajita.balance / cajita.goal) * 100) : 0
          return (
            <div key={cajita.id} className="card" style={{ padding: 20, cursor: 'pointer', transition: 'all var(--transition-fast)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{cajita.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <Building2 size={12} />{cajita.bank_name}
                  </div>
                </div>
                <span className="badge badge-accent">{cajita.bank_rate}% EA</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                ${cajita.balance.toLocaleString('es-CO')}
              </div>
              {cajita.goal > 0 && (
                <>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>Meta: ${cajita.goal.toLocaleString('es-CO')}</div>
                  <div style={{ width: '100%', height: 6, background: 'var(--color-bg-hover)', borderRadius: 9999, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: getProgressColor(progress), borderRadius: 9999, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: getProgressColor(progress) }}>{progress}% completado</span>
                  </div>
                </>
              )}
            </div>
          )
        })}
        {boxes.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No tienes cajitas de ahorro. ¡Crea tu primera!
          </div>
        )}
      </div>

      {/* Banks */}
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 12 }}>Bancos Registrados</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {banks.map((banco: any, idx: number) => (
          <div key={banco.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px',
            borderBottom: idx < banks.length - 1 ? '1px solid var(--color-border-light)' : 'none',
            transition: 'background var(--transition-fast)', cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--color-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={18} style={{ color: 'var(--color-accent)' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>{banco.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {banco.box_count} cajita{banco.box_count !== 1 ? 's' : ''} · ${(banco.total_balance || 0).toLocaleString('es-CO')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="badge badge-success">{banco.rate_ea}% EA</span>
              <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
