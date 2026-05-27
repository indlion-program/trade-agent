const AVOID_KEYWORDS = [
  'fraud', 'sec investigation', 'investigation', 'delisting', 'bankruptcy',
  'restatement', 'accounting', 'ceo resign', 'cfo resign', 'lawsuit',
  'criminal', 'fda reject', 'fda rejection', 'data breach', 'going concern',
  'class action', 'securities fraud', 'ponzi', 'embezzlement', 'indicted',
  'subpoena', 'regulatory action', 'warning letter', 'default', 'insolvency',
]

const OPPORTUNITY_KEYWORDS = [
  'downgrade', 'analyst', 'sector', 'macro', 'market', 'fear', 'rotation',
  'index rebalance', 'etf outflow', 'short squeeze', 'broader market',
  'market selloff', 'sector weakness', 'institutional', 'fund outflow',
  'portfolio rebalance', 'rate', 'fed', 'inflation',
]

export function classifyNews(text) {
  if (!text) return 'NEUTRAL'
  const lower = text.toLowerCase()
  for (const kw of AVOID_KEYWORDS) {
    if (lower.includes(kw)) return 'AVOID'
  }
  for (const kw of OPPORTUNITY_KEYWORDS) {
    if (lower.includes(kw)) return 'OPPORTUNITY'
  }
  return 'NEUTRAL'
}

export function classifyNewsList(items) {
  if (!Array.isArray(items)) return []
  return items.map(item => ({
    ...item,
    classification: classifyNews(item.headline || item.summary || ''),
  }))
}

export function hasAvoidSignal(classifiedItems) {
  return classifiedItems.some(item => item.classification === 'AVOID')
}
