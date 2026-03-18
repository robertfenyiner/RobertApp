import { Menu, Moon, Sun, Bell } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface NavbarProps {
  onMenuToggle: () => void
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onMenuToggle}
          className="btn-ghost"
          style={{
            padding: 8,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Notifications */}
        <button
          className="btn-ghost"
          style={{
            padding: 8,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
          aria-label="Notificaciones"
        >
          <Bell size={20} />
          <span style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            background: 'var(--color-danger)',
            borderRadius: '50%',
            border: '2px solid var(--color-bg-primary)',
          }} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="btn-ghost"
          style={{
            padding: 8,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  )
}
