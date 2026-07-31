import { useMemo, useState } from 'react'
import { ledger } from './data/ledger'
import './App.css'

const waterBillFiles = import.meta.glob('./Water Bills/*.pdf', { eager: true, import: 'default', query: '?url' }) as Record<string, string>

declare const __BUILD_VERSION__: string
declare const __BUILD_DATE__: string

type PaymentState = 'paid' | 'overdue' | 'upcoming'

const parseDate = (value: string) => new Date(`${value}T12:00:00`)
const formatDate = (value: string | Date) => new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(value instanceof Date ? value : parseDate(value))
const formatShortDate = (value: string | Date) => new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' }).format(value instanceof Date ? value : parseDate(value))
const formatMoney = (amount: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: ledger.property.currency }).format(amount)
const today = new Date()
today.setHours(0, 0, 0, 0)

function rentDueDate(periodStart: string) {
  const dueDate = parseDate(periodStart)
  dueDate.setDate(dueDate.getDate() - 1)
  return dueDate
}

function paymentState(paid: boolean, dueDate: Date): PaymentState {
  if (paid) return 'paid'
  return dueDate < today ? 'overdue' : 'upcoming'
}

function Status({ state }: { state: PaymentState }) {
  const labels = { paid: 'Paid', overdue: 'Overdue', upcoming: 'Upcoming' }
  return <span className={`status ${state}`}><i />{labels[state]}</span>
}

function App() {
  const [view, setView] = useState<'overview' | 'rent' | 'water'>('overview')
  const [filter, setFilter] = useState<'all' | PaymentState>('all')
  const [pendingBill, setPendingBill] = useState<{ url: string; file: string } | null>(null)
  const { rentPayments, waterInvoices } = ledger
  const rentStates = rentPayments.map((payment) => {
    const dueDate = rentDueDate(payment.periodStart)
    return { ...payment, dueDate, state: paymentState(payment.paid, dueDate) }
  })
  const waterStates = waterInvoices.map((invoice) => {
    const paymentDueDate = parseDate(invoice.dueDate)
    return { ...invoice, paymentDueDate, state: paymentState(invoice.tenantPaid, paymentDueDate) }
  })
  const unpaidWater = waterInvoices.filter((invoice) => !invoice.tenantPaid).reduce((sum, invoice) => sum + invoice.tenantUsage, 0)
  const attention = [
    ...rentStates.filter((item) => item.state === 'overdue').map((item) => ({ type: 'Rent payment', date: item.dueDate, detail: `${formatDate(item.periodStart)} – ${formatDate(item.periodEnd)}`, state: item.state })),
    ...waterStates.filter((item) => !item.tenantPaid).map((item) => ({ type: 'Water invoice', date: item.paymentDueDate, detail: 'tenant to pay', amount: formatMoney(item.tenantUsage), state: item.state })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())
  const visibleWater = useMemo(() => filter === 'all' ? waterStates : waterStates.filter((item) => item.state === filter), [filter, waterStates])

  const downloadBill = () => {
    if (!pendingBill) return
    const link = document.createElement('a')
    link.href = pendingBill.url
    link.download = pendingBill.file
    link.click()
    setPendingBill(null)
  }

  return <><main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">H</span><div><strong>{ledger.property.name}</strong><small>{ledger.property.tenant} · Payment overview</small></div></div>
      <div className="today">{new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(today)}</div>
    </header>
    <section className="hero"><p className="eyebrow">PROPERTY FINANCES</p><h1>Everything, clearly accounted for.</h1><p>Track weekly rent and water invoices from one simple source of truth.</p></section>
    <nav className="tabs" aria-label="Ledger sections">
      {([['overview', 'Overview'], ['rent', 'Rent'], ['water', 'Water']] as const).map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}
    </nav>
    {view === 'overview' && <Overview rentStates={rentStates} waterStates={waterStates} unpaidWater={unpaidWater} attention={attention} />}
    {view === 'rent' && <RentCalendar rows={rentStates} />}
    {view === 'water' && <LedgerTable kind="water" rows={visibleWater} filter={filter} setFilter={setFilter} onDownloadRequest={setPendingBill} />}
    <footer className="build-version">Version: {__BUILD_VERSION__} - {__BUILD_DATE__}</footer>
  </main>{pendingBill && <div className="download-dialog-backdrop" role="presentation"><section className="download-dialog" role="alertdialog" aria-modal="true" aria-labelledby="download-dialog-title"><h2 id="download-dialog-title">Download bill?</h2><p>Would you like to download this water invoice PDF?</p><div><button className="dialog-no" onClick={() => setPendingBill(null)}>No</button><button className="dialog-yes" onClick={downloadBill}>Yes, download</button></div></section></div>}</>
}

type RentRow = (typeof ledger.rentPayments)[number] & { dueDate: Date; state: PaymentState }
type WaterRow = (typeof ledger.waterInvoices)[number] & { paymentDueDate: Date; state: PaymentState }
type AttentionItem = { type: string; date: Date; detail: string; amount?: string; state: PaymentState }

function Overview({ rentStates, waterStates, unpaidWater, attention }: { rentStates: RentRow[]; waterStates: WaterRow[]; unpaidWater: number; attention: AttentionItem[] }) {
  const nextRent = rentStates.find((item) => !item.paid && item.dueDate >= today) || rentStates.find((item) => !item.paid)
  return <>
    <section className="stat-grid">
      <article className="stat-card"><span className="icon rent-icon">⌂</span><p>Next rent period</p><strong>{nextRent ? formatDate(nextRent.periodStart) : 'All paid'}</strong><small>{nextRent ? `${formatDate(nextRent.periodStart)} – ${formatDate(nextRent.periodEnd)}` : 'No outstanding periods'}</small></article>
      <article className="stat-card"><span className="icon water-icon">≈</span><p>Water outstanding</p><strong>{formatMoney(unpaidWater)}</strong><small>{waterStates.filter((item) => !item.tenantPaid).length} invoice{waterStates.filter((item) => !item.tenantPaid).length === 1 ? '' : 's'} awaiting tenant payment</small></article>
      <article className="stat-card"><span className="icon paid-icon">✓</span><p>Payments recorded</p><strong>{rentStates.filter((item) => item.paid).length + waterStates.filter((item) => item.tenantPaid).length}</strong><small>{rentStates.filter((item) => item.paid).length} rent · {waterStates.filter((item) => item.tenantPaid).length} water</small></article>
    </section>
    <section className="panel attention"><div className="section-heading"><div><p className="eyebrow">ACTION NEEDED</p><h2>Open items</h2></div><span className="count">{attention.length}</span></div>
      {attention.length ? <div className="action-list">{attention.map((item, index) => <div className="action-row" key={`${item.type}-${index}`}><span className="action-icon">{item.type === 'Rent payment' ? '⌂' : '≈'}</span><div className={item.amount ? 'water-summary' : undefined}><strong>{item.type}</strong>{item.amount ? <span className="water-charge"><b>{item.amount}</b>{item.detail}</span> : <p>{item.detail}</p>}</div><div className="action-right"><span className={item.type === 'Water invoice' ? 'action-due' : undefined}>{item.type === 'Water invoice' ? `Due at ${formatDate(item.date)}` : formatDate(item.date)}</span><Status state={item.state} /></div></div>)}</div> : <p className="empty">Nothing is waiting for attention.</p>}
    </section>
  </>
}

function RentCalendar({ rows }: { rows: RentRow[] }) {
  const nextUnpaid = rows.find((item) => !item.paid && item.dueDate >= today) || rows.find((item) => !item.paid)

  return <section className="panel rent-calendar">
    <div className="section-heading"><div><p className="eyebrow">WEEKLY SCHEDULE</p><h2>Rent payments</h2></div><div className="rent-legend"><span className="paid">Paid</span><span className="next">Upcoming</span><span>Scheduled</span></div></div>
    <div className="rent-grid">
      {rows.map((period) => {
        const isNext = period === nextUnpaid
        const visualState = period.paid ? 'paid' : isNext ? 'next' : period.state === 'overdue' ? 'overdue' : 'scheduled'
        const statusLabel = visualState === 'paid' ? 'Paid' : visualState === 'next' ? 'Upcoming' : visualState === 'overdue' ? 'Overdue' : 'Scheduled'
        const monthLabel = new Intl.DateTimeFormat('en-NZ', { month: 'long', year: 'numeric' }).format(parseDate(period.periodStart))
        return <article className={`rent-card ${visualState}`} key={period.periodStart}>
          <div className="rent-card-top"><span>{monthLabel}</span><span className="rent-card-status">{statusLabel}</span></div>
          <strong>{formatShortDate(period.periodStart)} – {formatShortDate(period.periodEnd)}</strong>
          <small>{period.paidDate ? `Paid ${formatShortDate(period.paidDate)}` : `Due ${formatShortDate(period.dueDate)}`}</small>
        </article>
      })}
    </div>
  </section>
}

function LedgerTable({ kind, rows, filter, setFilter, onDownloadRequest }: { kind: 'rent' | 'water'; rows: RentRow[] | WaterRow[]; filter: 'all' | PaymentState; setFilter: (filter: 'all' | PaymentState) => void; onDownloadRequest?: (bill: { url: string; file: string }) => void }) {
  const rent = kind === 'rent'
  return <section className="panel ledger-panel"><div className="section-heading"><div><p className="eyebrow">{rent ? 'WEEKLY SCHEDULE' : 'INVOICE HISTORY'}</p><h2>{rent ? 'Rent payments' : 'Water invoices'}</h2></div><div className="filters">{(['all', 'paid', 'upcoming', 'overdue'] as const).map((option) => <button key={option} onClick={() => setFilter(option)} className={filter === option ? 'selected' : ''}>{option}</button>)}</div></div>
    <div className="table-wrap"><table className={rent ? undefined : 'water-table'}><thead><tr>{rent ? <><th>Period</th><th>Due date</th><th>Paid date</th></> : <><th>Invoice date</th><th>Due date</th><th>Total bill</th><th>Fixed charge</th><th>Tenant usage</th><th>Tenant paid</th><th>Landlord paid bill</th><th>Bill</th></>}<th>{rent ? 'Status' : 'Tenant status'}</th></tr></thead><tbody>{rows.map((item) => 'periodStart' in item ? <tr key={item.periodStart}><td><strong>{formatDate(item.periodStart)}</strong><span>{formatDate(item.periodEnd)}</span></td><td>{formatDate(item.dueDate)}</td><td>{item.paidDate ? formatDate(item.paidDate) : '—'}</td><td><Status state={item.state} /></td></tr> : <tr key={item.invoiceDate}><td><strong>{formatDate(item.invoiceDate)}</strong></td><td>{formatDate(item.dueDate)}</td><td>{formatMoney(item.total)}</td><td>{formatMoney(item.fixed)}</td><td className="tenant-charge">{formatMoney(item.tenantUsage)}</td><td>{item.tenantPaidDate ? formatDate(item.tenantPaidDate) : '—'}</td><td><span className={`payment-flag ${item.totalPaidByLandlord ? 'settled' : 'unsettled'}`}>{item.totalPaidByLandlord ? 'Paid' : 'Not paid'}</span></td><td>{item.file && waterBillFiles[`./Water Bills/${item.file}`] ? <button className="download-bill" onClick={() => onDownloadRequest?.({ url: waterBillFiles[`./Water Bills/${item.file}`], file: item.file })}>Download bill</button> : '—'}</td><td><Status state={item.state} /></td></tr>)}</tbody></table></div>
    {!rows.length && <p className="empty">No entries match this filter.</p>}
  </section>
}

export default App
