import { useState } from 'react'
import { ScannerScreen } from './screens/ScannerScreen'
import { DetailScreen } from './screens/DetailScreen'

export default function App() {
  const [selectedStock, setSelectedStock] = useState(null)

  if (selectedStock) {
    return (
      <DetailScreen
        stockData={selectedStock}
        onBack={() => setSelectedStock(null)}
      />
    )
  }

  return (
    <ScannerScreen
      onSelectStock={setSelectedStock}
    />
  )
}
