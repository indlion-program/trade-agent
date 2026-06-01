import { useState } from 'react'
import { ScannerScreen } from './screens/ScannerScreen'
import { DetailScreen } from './screens/DetailScreen'
import { PortfolioScreen } from './screens/PortfolioScreen'

export default function App() {
  const [tab, setTab] = useState('scanner')
  const [selectedStock, setSelectedStock] = useState(null)

  function handleSelectStock(data) {
    setSelectedStock(data)
  }

  function handleTabChange(newTab) {
    setTab(newTab)
    if (newTab !== 'scanner') setSelectedStock(null)
  }

  return (
    <>
      {/* Scanner flow */}
      <div style={{ display: tab === 'scanner' && !selectedStock ? 'block' : 'none' }}>
        <ScannerScreen onSelectStock={handleSelectStock} />
      </div>

      {/* Detail view (scanner sub-page) */}
      {tab === 'scanner' && selectedStock && (
        <DetailScreen
          stockData={selectedStock}
          onBack={() => setSelectedStock(null)}
        />
      )}

      {/* Portfolio */}
      <div style={{ display: tab === 'portfolio' ? 'block' : 'none' }}>
        <PortfolioScreen />
      </div>

      {/* Persistent bottom tab bar */}
      <TabBar active={selectedStock ? 'scanner' : tab} onChange={handleTabChange} />
    </>
  )
}

export function TabBar({ active, onChange }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-3"
      style={{
        background: 'rgba(8,8,16,0.97)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(79,110,247,0.15)',
      }}
    >
      <TabBtn id="scanner"   label="Scanner"   icon="📡" active={active} onChange={onChange} />
      <TabBtn id="portfolio" label="Portfolio" icon="💼" active={active} onChange={onChange} />
    </div>
  )
}

function TabBtn({ id, label, icon, active, onChange }) {
  const isActive = active === id
  return (
    <button
      onClick={() => onChange(id)}
      className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl"
      style={{
        background: isActive ? 'rgba(79,110,247,0.12)' : 'transparent',
        color: isActive ? '#818cf8' : '#475569',
        border: isActive ? '1px solid rgba(79,110,247,0.25)' : '1px solid transparent',
        boxShadow: isActive ? '0 0 12px rgba(79,110,247,0.15)' : 'none',
      }}
    >
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <span className="text-xs font-semibold" style={{ letterSpacing: '0.04em' }}>{label}</span>
    </button>
  )
}
