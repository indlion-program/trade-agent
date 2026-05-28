export function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="skeleton h-5 w-16 mb-2 rounded" />
          <div className="skeleton h-3.5 w-32 rounded" />
        </div>
        <div className="skeleton h-6 w-16 rounded" />
      </div>
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-8 w-24 rounded" />
        <div className="skeleton h-6 w-20 rounded" />
      </div>
      <div className="skeleton h-3 w-full rounded mb-1.5" />
      <div className="skeleton h-3 w-4/5 rounded" />
    </div>
  )
}

export function SkeletonDetail() {
  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header section */}
      <div className="rounded-xl p-4 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
        <div className="skeleton h-4 w-24 mb-3 rounded" />
        <div className="skeleton h-10 w-32 mb-2 rounded" />
        <div className="skeleton h-4 w-48 rounded" />
      </div>

      {/* Filters section */}
      <div className="rounded-xl p-4 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
        <div className="skeleton h-4 w-20 mb-3 rounded" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-2.5">
            <div className="skeleton w-5 h-5 rounded-full" />
            <div className="skeleton h-3.5 flex-1 rounded" />
          </div>
        ))}
      </div>

      {/* Fibonacci */}
      <div className="rounded-xl p-4 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
        <div className="skeleton h-4 w-28 mb-3 rounded" />
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex justify-between mb-2">
            <div className="skeleton h-3.5 w-24 rounded" />
            <div className="skeleton h-3.5 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
