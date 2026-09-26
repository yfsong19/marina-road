import rawLedger from './ledger.json'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function validateLedger(data: unknown) {
  const ledger = data as typeof rawLedger
  assert(ledger?.property?.currency, 'property.currency is required')
  assert(Array.isArray(ledger.rentPayments), 'rentPayments must be an array')
  assert(Array.isArray(ledger.waterInvoices), 'waterInvoices must be an array')
  ledger.rentPayments.forEach((payment, index) => {
    assert(ISO_DATE.test(payment.periodStart), `Rent entry ${index + 1} needs an ISO period start date`)
    assert(payment.paidDate === null || ISO_DATE.test(payment.paidDate), `Rent entry ${index + 1} needs an ISO paid date or null`)
  })
  ledger.waterInvoices.forEach((invoice, index) => {
    assert(ISO_DATE.test(invoice.invoiceDate) && ISO_DATE.test(invoice.dueDate), `Water invoice ${index + 1} needs ISO invoice and due dates`)
    ;['total', 'fixed'].forEach((field) => assert(typeof invoice[field as keyof typeof invoice] === 'number', `Water invoice ${index + 1} needs a numeric ${field}`))
    assert(invoice.total >= invoice.fixed, `Water invoice ${index + 1} total must be at least its fixed charge`)
    assert(invoice.tenantPaidDate === null || ISO_DATE.test(invoice.tenantPaidDate), `Water invoice ${index + 1} needs an ISO tenant paid date or null`)
  })
  return ledger
}

export const ledger = validateLedger(rawLedger)
