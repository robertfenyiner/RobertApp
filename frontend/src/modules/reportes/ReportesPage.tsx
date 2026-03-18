import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Calendar, Loader2,
  RefreshCw, DollarSign, ArrowDownRight,
} from 'lucide-react'
import { gastosAPI } from '@/lib/api'

/* ===== Helpers ===== */
function fmtCOP(n: number) { return '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 0 }) }
function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) }
function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${months[Number(mo) - 1]} ${y.slice(2)}`
}

const PERIODS = [
  { label: 'Este mes', value: '1' },
  { label: '3 meses', value: '3' },
  { label: '6 meses', value: '6' },
  { label: '1 año', value: '12' },
]

const PIE_COLORS = ['#6366f1', '#a78bfa', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6']

export default function ReportesPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState('6')

  const fetchReports = (m: string) => {
    setLoading(true)
    gastosAPI.reports({ months: Number(m) })
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchReports(months) }, [months])

  if (loading || !data) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <Loader2 size={28} className="loading-spin" style={{ color: 'var(--color-accent)' }} />
    </div>
  )

  const mom = data.monthOverMonth
  const rec = data.recurringVsOnetime || {}
  const recTotal = (rec.recurring_total || 0) + (rec.onetime_total || 0)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Análisis detallado de tus gastos</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map(p => (
            <button key={p.value}
              className={`btn ${months === p.value ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={() => setMonths(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid stagger-children" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}><DollarSign size={20} /></div>
          <div className="stat-label">Mes Actual (COP)</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>{fmtCOP(mom.current)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}><DollarSign size={20} /></div>
          <div className="stat-label">Mes Anterior</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>{fmtCOP(mom.previous)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{
            background: mom.changePercent === null ? 'var(--color-bg-elevated)' : mom.changePercent > 0 ? 'var(--color-danger-soft)' : 'var(--color-success-soft)',
            color: mom.changePercent === null ? 'var(--color-text-muted)' : mom.changePercent > 0 ? 'var(--color-danger)' : 'var(--color-success)',
          }}>
            {mom.changePercent === null ? <Minus size={20} /> : mom.changePercent > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div className="stat-label">Variación</div>
          <div className="stat-value" style={{
            fontSize: '1.2rem',
            color: mom.changePercent === null ? 'var(--color-text-muted)' : mom.changePercent > 0 ? 'var(--color-danger)' : 'var(--color-success)',
          }}>
            {mom.changePercent === null ? 'N/A' : `${mom.changePercent > 0 ? '+' : ''}${mom.changePercent}%`}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Monthly Trend */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 600 }}>📊 Tendencia Mensual</h3>
          {data.monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.monthlyTrend.map((d: any) => ({ ...d, label: monthLabel(d.month) }))}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.82rem' }}
                  formatter={(v: any) => [fmtCOP(v as number), 'Total COP']}
                  labelFormatter={(l: any) => String(l)}
                />
                <Bar dataKey="total" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Sin datos</p>}
        </div>

        {/* Category Pie */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 600 }}>🏷️ Por Categoría</h3>
          {data.categoryBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.categoryBreakdown} dataKey="total" nameKey="name" cx="50%" cy="50%"
                  outerRadius={85} innerRadius={45} paddingAngle={2} label={({ name, percentage }: any) => `${name} ${percentage}%`}
                  labelLine={{ stroke: 'var(--color-text-muted)', strokeWidth: 1 }}
                  style={{ fontSize: '0.7rem' }}>
                  {data.categoryBreakdown.map((_: any, i: number) => (
                    <Cell key={i} fill={data.categoryBreakdown[i].color || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.82rem' }}
                  formatter={(v: any) => [fmtCOP(v as number), 'Total']}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Sin datos</p>}
        </div>
      </div>

      {/* Recurring vs One-time + Currency */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Recurring vs One-time */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 600 }}>🔄 Recurrentes vs Únicos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} style={{ color: 'var(--color-accent)' }} /> Recurrentes ({rec.recurring_count || 0})</span>
                <strong>{fmtCOP(rec.recurring_total || 0)}</strong>
              </div>
              <div style={{ height: 8, background: 'var(--color-bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--color-accent)', borderRadius: 4, width: recTotal > 0 ? `${((rec.recurring_total || 0) / recTotal) * 100}%` : '0%', transition: 'width 0.5s ease' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14} style={{ color: 'var(--color-warning)' }} /> Únicos ({rec.onetime_count || 0})</span>
                <strong>{fmtCOP(rec.onetime_total || 0)}</strong>
              </div>
              <div style={{ height: 8, background: 'var(--color-bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--color-warning)', borderRadius: 4, width: recTotal > 0 ? `${((rec.onetime_total || 0) / recTotal) * 100}%` : '0%', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Currency Breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 600 }}>💱 Por Moneda</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.currencyBreakdown.map((c: any) => (
              <div key={c.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--color-accent-soft)', color: 'var(--color-accent)', fontSize: '0.72rem', fontWeight: 600 }}>{c.code}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{c.count} gastos</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{c.symbol}{c.total_original.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
                  {c.code !== 'COP' && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>≈ {fmtCOP(c.total_cop)}</div>}
                </div>
              </div>
            ))}
            {data.currencyBreakdown.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>Sin datos</p>}
          </div>
        </div>
      </div>

      {/* Top Expenses */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 600 }}>🏆 Top 10 Gastos más grandes</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.topExpenses.map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: i < 3 ? 'var(--color-bg-elevated)' : 'transparent' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--color-border)', color: i < 3 ? 'white' : 'var(--color-text-muted)', flexShrink: 0 }}>
                {i + 1}
              </span>
              <div className="exp-icon-sm" style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--color-danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-danger)' }}>
                <ArrowDownRight size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', gap: 8 }}>
                  {e.category_name && <span>{e.category_icon} {e.category_name}</span>}
                  <span>{fmtDate(e.date)}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{e.currency_symbol}{e.amount.toLocaleString('es-CO')} <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{e.currency_code}</span></div>
                {e.currency_code !== 'COP' && e.amount_cop && <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>≈ {fmtCOP(e.amount_cop)}</div>}
              </div>
            </div>
          ))}
          {data.topExpenses.length === 0 && <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Sin datos</p>}
        </div>
      </div>

      {/* Scoped Styles */}
      <style>{`
        .loading-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn-ghost { background: var(--color-bg-elevated); border: 1px solid var(--color-border); }
        .exp-icon-sm { width: 28px; height: 28px; }

        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <style>{`
        @media (max-width: 900px) {
          .animate-fade-in > div[style*="grid-template-columns: 1.5fr"] { grid-template-columns: 1fr !important; }
          .animate-fade-in > div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
