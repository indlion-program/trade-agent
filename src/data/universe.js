// Curated bundled universe — high-liquidity US stocks + popular ETFs.
// These are the symbols most likely to produce gap-reversal opportunities
// (large enough to pass the $500M market-cap filter, liquid enough to pass
// the 750K avg-volume filter).
//
// Power-users can call "Expand Universe" to fetch the full US symbol list
// from Finnhub (1 API call, cached 7 days) for thousands more symbols.

// ─── Large-cap stocks (S&P 500 core + popular Nasdaq names) ────────────────
const LARGE_CAPS = [
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'LLY',
  'V', 'JPM', 'UNH', 'XOM', 'WMT', 'MA', 'JNJ', 'PG', 'ORCL', 'COST',
  'HD', 'ABBV', 'NFLX', 'AVGO', 'BAC', 'KO', 'PEP', 'ADBE', 'MRK', 'CRM',
  'CVX', 'AMD', 'ACN', 'WFC', 'CSCO', 'ABT', 'MCD', 'LIN', 'DHR', 'IBM',
  'GS', 'NOW', 'INTU', 'DIS', 'TXN', 'GE', 'NEE', 'PFE', 'PM', 'AMGN',
  'CAT', 'AXP', 'SPGI', 'T', 'RTX', 'VZ', 'COP', 'BLK', 'BKNG', 'LOW',
  'UNP', 'HON', 'ELV', 'NKE', 'BMY', 'MS', 'C', 'ETN', 'MDT', 'PLD',
  'SBUX', 'BSX', 'ADP', 'GILD', 'MMC', 'ANET', 'TJX', 'AMT', 'MDLZ', 'SCHW',
  'ISRG', 'ADI', 'LMT', 'DE', 'SYK', 'REGN', 'CI', 'MU', 'INTC', 'VRTX',
  'BX', 'TMUS', 'PYPL', 'LRCX', 'KLAC', 'BA', 'EQIX', 'PGR', 'FI', 'ICE',
  'TT', 'MO', 'CB', 'SLB', 'EOG', 'WM', 'ZTS', 'DUK', 'SO', 'BDX',
  'EMR', 'APD', 'CL', 'APH', 'ITW', 'NSC', 'EW', 'MCO', 'PSA', 'AON',
  'COF', 'MNST', 'MAR', 'FCX', 'KMB', 'CME', 'GD', 'CTAS', 'SCCO', 'ROP',
  'NXPI', 'FDX', 'CSX', 'USB', 'OXY', 'MCK', 'TFC', 'SHW', 'HUM', 'ORLY',
  'PCAR', 'MSI', 'ECL', 'TGT', 'RCL', 'F', 'GM', 'BBY', 'DLR', 'ROST',
  'ADSK', 'CARR', 'HCA', 'AIG', 'OTIS', 'AMP', 'PRU', 'MET', 'AFL', 'ALL',
  'CPRT', 'SPG', 'NEM', 'AEP', 'DXCM', 'PSX', 'TRV', 'CMI', 'BIIB', 'AZO',
  'STZ', 'DD', 'DOW', 'GIS', 'WMB', 'FERG', 'EBAY', 'VLO', 'MPC', 'CTSH',
  'IDXX', 'KR', 'HSY', 'EXC', 'MMM', 'SRE', 'CMG', 'FAST', 'KMI', 'CCI',
  'VICI', 'LHX', 'A', 'FIS', 'HLT', 'WELL', 'ROK', 'OKE', 'NUE', 'SYY',
  'CDNS', 'SNPS', 'LULU', 'PWR', 'HES', 'YUM', 'ON', 'IT', 'WBD', 'ABNB',
  'PCG', 'D', 'ED', 'ALB', 'EIX', 'AVB', 'DAL', 'UAL', 'AAL', 'LUV',
  'CCL', 'NCLH', 'MGM', 'LVS', 'WYNN', 'PENN', 'DKNG',
]

// ─── Nasdaq 100 & high-beta tech ───────────────────────────────────────────
const TECH = [
  'ASML', 'MELI', 'PANW', 'WDAY', 'TEAM', 'ZS', 'CRWD', 'DDOG', 'MDB', 'SNOW',
  'PLTR', 'COIN', 'U', 'RBLX', 'HOOD', 'SOFI', 'AFRM', 'UPST', 'OPEN', 'ROKU',
  'SPOT', 'PINS', 'SNAP', 'MTCH', 'TWLO', 'ZM', 'DOCU', 'OKTA', 'NET', 'FSLY',
  'PATH', 'AI', 'BBAI', 'IONQ', 'RGTI', 'SMCI', 'ARM', 'SOUN', 'MRVL', 'ASM',
  'AMAT', 'ENPH', 'SEDG', 'FSLR', 'RUN', 'NOVA', 'PLUG', 'BLDP', 'FCEL', 'BE',
  'CRSP', 'NTLA', 'BEAM', 'EDIT', 'EXAS', 'MRNA', 'BNTX', 'NVAX',
]

// ─── Mid-cap + popular speculative ────────────────────────────────────────
const MID_CAP_SPEC = [
  'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'NKLA', 'FFIE', 'FSR', 'CHPT', 'EVGO',
  'MARA', 'RIOT', 'HUT', 'CLSK', 'BITF', 'CIFR', 'IREN', 'WULF', 'GBTC', 'ETHE',
  'GME', 'AMC', 'BB', 'NOK', 'SOUN', 'BBAI', 'TLRY', 'CGC', 'ACB', 'SNDL',
  'CVNA', 'CAR', 'OSTK', 'BYND', 'PTON', 'WISH', 'CLOV', 'SDC', 'WKHS', 'GOEV',
  'RIDE', 'HYZN', 'MULN', 'ATER', 'BBBY', 'IRNT', 'SPRT', 'PROG', 'BBIG', 'ANY',
  'DWAC', 'PHUN', 'CFVI', 'BKKT', 'SOFI', 'AFRM', 'UPST', 'LMND', 'ROOT', 'OPEN',
]

// ─── International ADRs ───────────────────────────────────────────────────
const ADR = [
  'TSM', 'BABA', 'BIDU', 'JD', 'PDD', 'BILI', 'VIPS', 'NTES', 'TCEHY', 'HUYA',
  'IQ', 'WB', 'TM', 'HMC', 'SONY', 'DEO', 'BTI', 'HSBC', 'BCS', 'UBS',
  'CS', 'DB', 'BP', 'SHEL', 'TTE', 'EQNR', 'VALE', 'RIO', 'BHP', 'YUMC',
  'TME', 'KWEB', 'CWEB', 'TCOM', 'NTES', 'TAL', 'EDU', 'GOTU', 'YMM', 'BEKE',
]

// ─── ETFs — broad market, sector, leverage, country ────────────────────────
const ETFS = [
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'VEA', 'VWO', 'VUG', 'VTV',
  'VIG', 'VYM', 'BND', 'AGG', 'TLT', 'HYG', 'LQD', 'GLD', 'SLV', 'USO',
  'UNG', 'BNO', 'XLE', 'XLF', 'XLK', 'XLV', 'XLI', 'XLP', 'XLY', 'XLU',
  'XLB', 'XLRE', 'XLC', 'XBI', 'IBB', 'SOXX', 'SMH', 'SOXL', 'SOXS', 'TQQQ',
  'SQQQ', 'UPRO', 'SPXL', 'SPXS', 'TZA', 'TNA', 'FAS', 'FAZ', 'JNUG', 'JDST',
  'NUGT', 'DUST', 'JNK', 'EMB', 'MUB', 'BIL', 'SHY', 'IEF', 'MBB', 'VNQ',
  'IYR', 'GDX', 'GDXJ', 'KRE', 'KBE', 'ITB', 'XHB', 'XME', 'XRT', 'XOP',
  'ARKK', 'ARKW', 'ARKG', 'ARKF', 'ARKQ', 'ARKX', 'IBIT', 'FBTC', 'BITO',
  'FXI', 'MCHI', 'INDA', 'EWY', 'EWJ', 'EWG', 'EWU', 'EWA', 'EWC', 'EWZ',
  'EWT', 'EWH', 'EZA', 'TUR', 'EWW', 'ARGT', 'ECH', 'EPHE', 'EIDO', 'EPI',
  'EPP', 'IEMG', 'IEFA', 'EFA', 'EEM', 'VXUS', 'BNDX', 'BWX', 'EMLC', 'CEW',
  'VXX', 'UVXY', 'UVIX', 'SVXY', 'VIXY', 'SH', 'SDS', 'RWM', 'SRTY', 'EUM',
  'PSQ', 'DOG', 'MYY', 'BOIL', 'KOLD', 'UCO', 'SCO', 'AGQ', 'ZSL', 'UGL',
  'GLL', 'DRN', 'DRV', 'LABU', 'LABD', 'ERX', 'ERY', 'CURE', 'NAIL', 'WANT',
  'PILL', 'JETS', 'IYT', 'XAR', 'ITA', 'PPA', 'DFEN', 'XPH', 'XHE', 'IHI',
  'IHF', 'IBB', 'XHS', 'PBE', 'PJP', 'XSD', 'PSI', 'IGV', 'VGT', 'FDN',
  'PNQI', 'HACK', 'CIBR', 'WCLD', 'SKYY', 'BOTZ', 'ROBO', 'IRBO', 'KOMP', 'AIQ',
  'KWEB', 'CQQQ', 'EMQQ', 'INDS', 'FINX', 'IPAY', 'SPMO', 'MTUM', 'QUAL', 'USMV',
  'VLUE', 'SIZE', 'SPHB', 'SPLV', 'SPHQ', 'SCHD', 'NOBL', 'DGRO', 'HDV', 'SPHD',
  'PFF', 'PGX', 'PFFD', 'PCY', 'EMB', 'CWB', 'ANGL', 'FALN', 'SHYG', 'USHY',
  'PHB', 'JNK', 'BSV', 'BIV', 'BLV', 'VTEB', 'TIP', 'SCHP', 'STIP', 'VTIP',
]

// ─── Healthcare / biotech ─────────────────────────────────────────────────
const HEALTHCARE = [
  'TMO', 'DHR', 'ZBH', 'BAX', 'IDXX', 'ALGN', 'MTD', 'HOLX', 'PODD', 'INSP',
  'ALNY', 'IONS', 'SRPT', 'BMRN', 'EXEL', 'NBIX', 'BHVN', 'GH', 'NTRA', 'NVTA',
  'RGEN', 'TECH', 'WAT', 'PKI', 'CRL', 'BRKR', 'A', 'XRAY', 'ZBH', 'TEVA',
  'VTRS', 'OGN', 'PRGO', 'CTLT', 'WST', 'HSIC', 'COO', 'GMED', 'AXNX', 'ATEC',
]

// ─── Financials / fintech ─────────────────────────────────────────────────
const FINANCIALS = [
  'KKR', 'APO', 'CG', 'ARES', 'OWL', 'STEP', 'TPG', 'BAM', 'BIPC', 'BAM',
  'WTW', 'AON', 'BRO', 'RJF', 'LPLA', 'EVR', 'LAZ', 'MC', 'HLI', 'PJT',
  'NTRS', 'STT', 'BK', 'PNC', 'USB', 'TFC', 'MTB', 'KEY', 'CFG', 'HBAN',
  'RF', 'FITB', 'ZION', 'CMA', 'SNV', 'WAL', 'WBS', 'PB', 'CFR', 'BOH',
  'PACW', 'WAFD', 'ALLY', 'SYF', 'DFS', 'AMERICA', 'BX', 'SQ', 'PYPL', 'V',
]

// ─── Industrials, energy, materials ───────────────────────────────────────
const INDUSTRIALS = [
  'CTRA', 'DVN', 'APA', 'PXD', 'CIVI', 'MRO', 'EQT', 'AR', 'RRC', 'SWN',
  'OKE', 'KMI', 'WMB', 'TRGP', 'ET', 'EPD', 'MPLX', 'MMP', 'DCP', 'PAA',
  'LIN', 'APD', 'ECL', 'SHW', 'PPG', 'NEM', 'GOLD', 'AEM', 'FNV', 'WPM',
  'X', 'CLF', 'STLD', 'NUE', 'RS', 'ATI', 'AA', 'CENX', 'KALU', 'ACH',
  'GE', 'HON', 'MMM', 'EMR', 'ETN', 'PH', 'ROK', 'AME', 'DOV', 'XYL',
  'IEX', 'PNR', 'GGG', 'AOS', 'NDSN', 'WTS', 'WSM', 'BLD', 'CSL', 'GNRC',
]

// ─── Consumer / retail / media ────────────────────────────────────────────
const CONSUMER = [
  'DG', 'DLTR', 'KSS', 'M', 'JWN', 'GPS', 'AEO', 'ANF', 'URBN', 'CHWY',
  'PETS', 'TPR', 'TPL', 'CPRI', 'RL', 'PVH', 'LEVI', 'GIL', 'HBI', 'CRI',
  'COMP', 'ZG', 'Z', 'OPEN', 'RDFN', 'EXP', 'BLD', 'IBP', 'LEN', 'DHI',
  'PHM', 'NVR', 'TOL', 'KBH', 'MTH', 'TPH', 'MDC', 'TMHC', 'GRBK', 'BZH',
  'CMCSA', 'CHTR', 'PARA', 'FOXA', 'FOX', 'NWS', 'NWSA', 'NYT', 'WBD', 'DIS',
  'EA', 'TTWO', 'RBLX', 'ATVI', 'ZNGA', 'SE', 'SHOP', 'ETSY', 'EBAY', 'MELI',
]

// ─── Combine + dedupe ─────────────────────────────────────────────────────
function dedupe(arr) {
  return [...new Set(arr.map((s) => s.toUpperCase().trim()).filter(Boolean))]
}

export const STARTER_WATCHLIST = [
  'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA', 'JPM', 'BAC', 'GS', 'V',
  'MA', 'CHKP', 'CRM', 'ORCL', 'INTC', 'AMD', 'TSLA', 'WMT', 'JNJ', 'PFE',
]

export const CURATED_UNIVERSE = dedupe([
  ...LARGE_CAPS,
  ...TECH,
  ...MID_CAP_SPEC,
  ...ADR,
  ...ETFS,
  ...HEALTHCARE,
  ...FINANCIALS,
  ...INDUSTRIALS,
  ...CONSUMER,
])

export const UNIVERSE_GROUPS = {
  starter: STARTER_WATCHLIST,
  curated: CURATED_UNIVERSE,
  largecaps: dedupe(LARGE_CAPS),
  tech: dedupe(TECH),
  speculative: dedupe(MID_CAP_SPEC),
  etfs: dedupe(ETFS),
  // null = no symbol post-filter; TV screener enforces market_cap > $500M server-side
  large_us: null,
}

// ─── Filter Finnhub symbol response → tradeable subset ────────────────────
// /stock/symbol?exchange=US returns ~25k symbols including warrants, units,
// preferred shares, and inactive issues. We want only common stock + ETFs.
export function filterTradeableSymbols(rawSymbols) {
  if (!Array.isArray(rawSymbols)) return []
  return rawSymbols
    .filter((s) => {
      if (!s.symbol || !s.type) return false
      const sym = s.symbol
      // Skip obviously non-tradeable
      if (sym.includes('.') && !['BRK.B', 'BRK.A', 'BF.B', 'BF.A'].includes(sym)) return false
      if (sym.length > 5) return false
      if (/[^A-Z]/.test(sym)) return false
      // Type filter: Common Stock, ETF, ADR
      const t = s.type.toLowerCase()
      return (
        t.includes('common') ||
        t.includes('etf') ||
        t.includes('adr') ||
        t === 'common stock' ||
        t === 'etp'
      )
    })
    .map((s) => s.symbol)
}
