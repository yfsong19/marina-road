import { readFile, writeFile } from 'node:fs/promises'

const [periodStart, paidDate] = process.argv.slice(2)

if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart ?? '')) {
  throw new Error('Usage: node scripts/mark-rent-paid.mjs <period-start> <paid-date>')
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate ?? '')) {
  throw new Error('paid-date must use YYYY-MM-DD format')
}

const ledgerPath = new URL('../src/data/ledger.json', import.meta.url)
const ledgerText = await readFile(ledgerPath, 'utf8')
const ledger = JSON.parse(ledgerText)
const matchingPayments = ledger.rentPayments.filter(
  (payment) => payment.periodStart === periodStart,
)

if (matchingPayments.length === 0) {
  throw new Error(`No rent payment exists for periodStart ${periodStart}`)
}

if (matchingPayments.length > 1) {
  throw new Error(`More than one rent payment exists for periodStart ${periodStart}`)
}

if (matchingPayments[0].paid) {
  throw new Error(`Rent payment for periodStart ${periodStart} is already marked paid`)
}

const escapedPeriodStart = periodStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const paymentPattern = new RegExp(
  `\\{[^{}]*"periodStart":\\s*"${escapedPeriodStart}"[^{}]*\\}`,
)
const paymentText = ledgerText.match(paymentPattern)?.[0]

if (!paymentText) {
  throw new Error(`Could not locate rent payment text for periodStart ${periodStart}`)
}

const updatedPaymentText = paymentText
  .replace(/"paid":\s*false/, '"paid": true')
  .replace(/"paidDate":\s*null/, `"paidDate": "${paidDate}"`)

if (updatedPaymentText === paymentText) {
  throw new Error(`Could not update unpaid rent payment for periodStart ${periodStart}`)
}

await writeFile(ledgerPath, ledgerText.replace(paymentText, updatedPaymentText))
