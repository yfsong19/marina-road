import { useMemo, useState } from 'react'
import { ledger } from './data/ledger'
import './App.css'

type PaymentState = 'paid' | 'overdue' | 'upcoming'

const parseDate = (value: string) => new Date(`${value}T12:00:00`)
const formatDate = (value: string | Date) => new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(value instanceof Date ? value : parseDate(value))
const formatMoney = (amount: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: ledger.property.currency }).format(amount)
const today = new Date()
today.setHours(0, 0, 0, 0)

function rentDueDate(periodStart: string) {
  const dueDate = parseDate(periodStart)
  dueDate.setDate(dueDate.getDate() - 1)
  return dueDate
}

function paymentState(item: { paid: boolean }, dueDate: Date): PaymentState {
  if (item.paid) return 'paid'
  return dueDate < today ? 'overdue' : 'upcoming'
}

function Status({ state }: { state: PaymentState }) {
  const labels = { paid: 'Paid', overdue: 'Overdue', upcoming: 'Upcoming' }
  return <span className={`status ${state}`}><i />{labels[state]}</span>
}

function App() {
  const [view, setView] = useState<'overview' | 'rent' | 'water'>('overview')
  const [filter, setFilter] = useState<'all' | PaymentState>('all')
  const { rentPayments, waterInvoices } = ledger
  const rentStates = rentPayments.map((payment) => {
    const dueDate = rentDueDate(payment.periodStart)
    return { ...payment, dueDate, state: paymentState(payment, dueDate) }
  })
  const waterStates = waterInvoices.map((invoice) => {
    const paymentDueDate = parseDate(invoice.dueDate)
    return { ...invoice, paymentDueDate, state: paymentState(invoice, paymentDueDate) }
  })
  const unpaidWater = waterInvoices.filter((invoice) => !invoice.paid).reduce((sum, invoice) => sum + invoice.tenantUsage, 0)
  const attention = [
    ...rentStates.filter((item) => item.state === 'overdue').map((item) => ({ type: 'Rent payment', date: item.dueDate, detail: `${formatDate(item.periodStart)} – ${formatDate(item.periodEnd)}`, state: item.state })),
    ...waterStates.filter((item) => !item.paid).map((item) => ({ type: 'Water invoice', date: item.paymentDueDate, detail: `${formatMoney(item.tenantUsage)} tenant usage`, state: item.state })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())
  const visibleRent = useMemo(() => filter === 'all' ? rentStates : rentStates.filter((item) => item.state === filter), [filter, rentStates])
  const visibleWater = useMemo(() => filter === 'all' ? waterStates : waterStates.filter((item) => item.state === filter), [filter, waterStates])

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">H</span><div><strong>{ledger.property.name}</strong><small>{ledger.property.tenant} · Payment overview</small></div></div>
      <div className="today">{new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(today)}</div>
    </header>
    <section className="hero"><p className="eyebrow">PROPERTY FINANCES</p><h1>Everything, clearly accounted for.</h1><p>Track weekly rent and water invoices from one simple source of truth.</p></section>
    <nav className="tabs" aria-label="Ledger sections">
      {([['overview', 'Overview'], ['rent', 'Rent'], ['water', 'Water']] as const).map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}
    </nav>
    {view === 'overview' && <Overview rentStates={rentStates} waterStates={waterStates} unpaidWater={unpaidWater} attention={attention} />}
    {view === 'rent' && <LedgerTable kind="rent" rows={visibleRent} filter={filter} setFilter={setFilter} />}
    {view === 'water' && <LedgerTable kind="water" rows={visibleWater} filter={filter} setFilter={setFilter} />}
  </main>
}

type RentRow = (typeof ledger.rentPayments)[number] & { dueDate: Date; state: PaymentState }
type WaterRow = (typeof ledger.waterInvoices)[number] & { paymentDueDate: Date; state: PaymentState }
type AttentionItem = { type: string; date: Date; detail: string; state: PaymentState }

function Overview({ rentStates, waterStates, unpaidWater, attention }: { rentStates: RentRow[]; waterStates: WaterRow[]; unpaidWater: number; attention: AttentionItem[] }) {
  const nextRent = rentStates.find((item) => !item.paid && item.dueDate >= today) || rentStates.find((item) => !item.paid)
  return <>
    <section className="stat-grid">
      <article className="stat-card"><span className="icon rent-icon">⌂</span><p>Next rent period</p><strong>{nextRent ? formatDate(nextRent.periodStart) : 'All paid'}</strong><small>{nextRent ? `${formatDate(nextRent.periodStart)} – ${formatDate(nextRent.periodEnd)}` : 'No outstanding periods'}</small></article>
      <article className="stat-card"><span className="icon water-icon">≈</span><p>Water outstanding</p><strong>{formatMoney(unpaidWater)}</strong><small>{waterStates.filter((item) => !item.paid).length} invoice{waterStates.filter((item) => !item.paid).length === 1 ? '' : 's'} awaiting payment</small></article>
      <article className="stat-card"><span className="icon paid-icon">✓</span><p>Payments recorded</p><strong>{rentStates.filter((item) => item.paid).length + waterStates.filter((item) => item.paid).length}</strong><small>{rentStates.filter((item) => item.paid).length} rent · {waterStates.filter((item) => item.paid).length} water</small></article>
    </section>
    <section className="panel attention"><div className="section-heading"><div><p className="eyebrow">ACTION NEEDED</p><h2>Open items</h2></div><span className="count">{attention.length}</span></div>
      {attention.length ? <div className="action-list">{attention.map((item, index) => <div className="action-row" key={`${item.type}-${index}`}><span className="action-icon">{item.type === 'Rent payment' ? '⌂' : '≈'}</span><div><strong>{item.type}</strong><p>{item.detail}</p></div><div className="action-right"><span>{formatDate(item.date)}</span><Status state={item.state} /></div></div>)}</div> : <p className="empty">Nothing is waiting for attention.</p>}
    </section>
  </>
}

function LedgerTable({ kind, rows, filter, setFilter }: { kind: 'rent' | 'water'; rows: RentRow[] | WaterRow[]; filter: 'all' | PaymentState; setFilter: (filter: 'all' | PaymentState) => void }) {
  const rent = kind === 'rent'
  return <section className="panel ledger-panel"><div className="section-heading"><div><p className="eyebrow">{rent ? 'WEEKLY SCHEDULE' : 'INVOICE HISTORY'}</p><h2>{rent ? 'Rent payments' : 'Water invoices'}</h2></div><div className="filters">{(['all', 'paid', 'upcoming', 'overdue'] as const).filter((option) => rent || option !== 'upcoming').map((option) => <button key={option} onClick={() => setFilter(option)} className={filter === option ? 'selected' : ''}>{option}</button>)}</div></div>
    <div className="table-wrap"><table><thead><tr>{rent ? <><th>Period</th><th>Due date</th><th>Paid date</th></> : <><th>Invoice date</th><th>Total</th><th>Fixed</th><th>Tenant usage</th></>}<th>Status</th></tr></thead><tbody>{rows.map((item) => 'periodStart' in item ? <tr key={item.periodStart}><td><strong>{formatDate(item.periodStart)}</strong><span>{formatDate(item.periodEnd)}</span></td><td>{formatDate(item.dueDate)}</td><td>{item.paidDate ? formatDate(item.paidDate) : '—'}</td><td><Status state={item.state} /></td></tr> : <tr key={item.invoiceDate}><td><strong>{formatDate(item.invoiceDate)}</strong></td><td>{formatMoney(item.total)}</td><td>{formatMoney(item.fixed)}</td><td className="tenant-charge">{formatMoney(item.tenantUsage)}</td><td><Status state={item.state} /></td></tr>)}</tbody></table></div>
    {!rows.length && <p className="empty">No entries match this filter.</p>}
  </section>
}

export default App
