import { Bill, Payment } from '../types'

/**
 * Calculates the accurate total amount of all bills excluding remaining balance items
 * This includes only room rent, electricity, water, and WiFi charges
 */
export const calculateAccurateTotalAmount = (bills: Bill[]): number => {
  return bills.reduce((total, bill) => {
    if (!bill.items || bill.items.length === 0) {
      return total + bill.amount
    }
    
    // Calculate bill total excluding remaining balance items
    const billTotal = bill.items
      .filter(item => item.item_type !== 'remaining_balance')
      .reduce((sum, item) => sum + item.amount, 0)
    
    return total + billTotal
  }, 0)
}

/**
 * Calculates the total amount paid from accepted payments
 */
export const calculateTotalPaid = (payments: Payment[]): number => {
  return payments.filter(payment => payment.status === 'accepted').reduce((sum, payment) => sum + payment.amount_paid, 0)
}

/**
 * Calculates the accurate billing summary for admin overview
 * 
 * Total Amount: Sum of all bills excluding remaining balance items
 * Total Paid: Sum of all accepted payments
 * Remaining Balance: Total Amount - Total Paid
 */
export const calculateAccurateBillingSummary = (bills: Bill[], payments: Payment[]) => {
  const totalAmount = calculateAccurateTotalAmount(bills)
  const totalPaid = calculateTotalPaid(payments)
  const remainingBalance = totalAmount - totalPaid

  return {
    totalAmount,
    totalPaid,
    remainingBalance
  }
}
