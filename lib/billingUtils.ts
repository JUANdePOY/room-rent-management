import { Bill, BillItem, Payment, Tenant, Room } from '../types'

// Centralized function to calculate total bill from bill items
export const calculateTotalBill = (items: Array<{ amount: number }>): number => {
  return items.reduce((sum, item) => sum + item.amount, 0)
}

// Centralized function to calculate remaining bill
export const calculateRemainingBill = (bill: Bill, payments: Payment[]): number => {
  // Get all accepted payments for this bill
  const billPayments = payments.filter(payment => 
    payment.bill_id === bill.id && payment.status === 'accepted'
  )
  
  const totalPaid = billPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
  
  // Calculate total bill from items if available, otherwise use bill.amount
  const totalBill = bill.items && bill.items.length > 0 
    ? calculateTotalBill(bill.items) 
    : bill.amount
  
  return totalBill - totalPaid
}

// Centralized function to calculate total paid
export const calculateTotalPaid = (bill: Bill, payments: Payment[]): number => {
  const billPayments = payments.filter(payment => 
    payment.bill_id === bill.id && payment.status === 'accepted'
  )
  
  return billPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
}

// Function to validate bill items structure
export const validateBillItems = (items: BillItem[]): boolean => {
  const requiredItemTypes: Array<'room_rent' | 'electricity' | 'water' | 'wifi'> = ['room_rent', 'electricity', 'water', 'wifi']
  const itemTypes = items.map(item => item.item_type)
  
  return requiredItemTypes.every(type => itemTypes.includes(type as any))
}

// Function to calculate bill items with remaining balance from previous month
export const calculateBillItems = (
  billId: string,
  rentAmount: number,
  electricAmount: number,
  waterAmount: number,
  wifiAmount: number,
  remainingBalance: number
): Omit<BillItem, 'id' | 'created_at'>[] => {
  const items: Omit<BillItem, 'id' | 'created_at'>[] = [
    {
      bill_id: billId,
      item_type: 'room_rent',
      amount: rentAmount,
      details: 'Room Rent',
    },
    {
      bill_id: billId,
      item_type: 'electricity',
      amount: electricAmount,
      details: 'Electricity Bill',
    },
    {
      bill_id: billId,
      item_type: 'water',
      amount: waterAmount,
      details: 'Water Bill',
    },
    {
      bill_id: billId,
      item_type: 'wifi',
      amount: wifiAmount,
      details: 'WiFi Bill',
    },
  ]

  if (remainingBalance > 0) {
    items.push({
      bill_id: billId,
      item_type: 'remaining_balance',
      amount: remainingBalance,
      details: 'Remaining Balance from Previous Month',
    })
  } else if (remainingBalance < 0) {
    // Handle overpayment (negative remaining balance) as a credit
    items.push({
      bill_id: billId,
      item_type: 'remaining_balance',
      amount: remainingBalance, // This will be negative, subtracting from total
      details: 'Credit from Overpayment Last Month',
    })
  }

  return items
}

// Enhanced admin billing summary functions
export const calculateAdminBillingSummary = (bills: Bill[], payments: Payment[]): {
  totalBills: number
  totalAmount: number
  totalPaid: number
  totalRemaining: number
  statusCounts: { paid: number; partial: number; pending: number; overdue: number }
} => {
  const totalBills = bills.length
  const totalAmount = bills.reduce((sum, bill) => {
    const billTotal = bill.items && bill.items.length > 0 ? calculateTotalBill(bill.items) : bill.amount
    return sum + billTotal
  }, 0)

  const totalPaid = payments.filter(p => p.status === 'accepted').reduce((sum, payment) => sum + payment.amount_paid, 0)
  
  const totalRemaining = totalAmount - totalPaid

  const statusCounts = bills.reduce((acc, bill) => {
    acc[bill.status]++
    return acc
  }, { paid: 0, partial: 0, pending: 0, overdue: 0 })

  return {
    totalBills,
    totalAmount,
    totalPaid,
    totalRemaining,
    statusCounts,
  }
}

// Calculate monthly billing summary for admin
export const calculateMonthlyAdminSummary = (
  bills: Bill[],
  payments: Payment[],
  monthKey: string
): {
  monthKey: string
  monthName: string
  totalBills: number
  totalAmount: number
  totalPaid: number
  totalRemaining: number
  statusCounts: { paid: number; partial: number; pending: number; overdue: number }
  revenue: number
} => {
  const [year, month] = monthKey.split('-').map(Number)
  const monthDate = new Date(year, month - 1, 1)
  const monthName = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  const monthBills = bills.filter(bill => {
    const billDate = new Date(bill.due_date)
    const billMonthKey = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`
    return billMonthKey === monthKey
  })

  const monthPayments = payments.filter(payment => {
    if (payment.status !== 'accepted') return false
    const paymentDate = new Date(payment.payment_date)
    const paymentMonthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`
    return paymentMonthKey === monthKey
  })

  const totalBills = monthBills.length
  const totalAmount = monthBills.reduce((sum, bill) => {
    const billTotal = bill.items && bill.items.length > 0 ? calculateTotalBill(bill.items) : bill.amount
    return sum + billTotal
  }, 0)

  const totalPaid = monthPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
  const totalRemaining = totalAmount - totalPaid

  const statusCounts = monthBills.reduce((acc, bill) => {
    acc[bill.status]++
    return acc
  }, { paid: 0, partial: 0, pending: 0, overdue: 0 })

  return {
    monthKey,
    monthName,
    totalBills,
    totalAmount,
    totalPaid,
    totalRemaining,
    statusCounts,
    revenue: totalPaid,
  }
}

// Calculate detailed bill breakdown by item type
export const calculateBillBreakdown = (items: BillItem[]) => {
  const breakdown = {
    room_rent: 0,
    electricity: 0,
    water: 0,
    wifi: 0,
    remaining_balance: 0,
    other: 0,
  }

  items.forEach(item => {
    if (breakdown.hasOwnProperty(item.item_type)) {
      breakdown[item.item_type as keyof typeof breakdown] += item.amount
    } else {
      breakdown.other += item.amount
    }
  })

  return breakdown
}

// Calculate bill status based on payments and due date
export const calculateBillStatus = (bill: Bill, payments: Payment[]): 'paid' | 'partial' | 'pending' | 'overdue' => {
  const now = new Date()
  const dueDate = new Date(bill.due_date)
  const totalPaid = calculateTotalPaid(bill, payments)
  const totalBill = bill.items && bill.items.length > 0 ? calculateTotalBill(bill.items) : bill.amount

  if (totalPaid >= totalBill) {
    return 'paid'
  } else if (totalPaid > 0) {
    return 'partial'
  } else if (now > dueDate) {
    return 'overdue'
  } else {
    return 'pending'
  }
}

// Calculate average bill amount per tenant
export const calculateAverageBillPerTenant = (bills: Bill[], tenants: Tenant[]): number => {
  if (tenants.length === 0 || bills.length === 0) return 0

  const totalBillAmount = bills.reduce((sum, bill) => {
    const billTotal = bill.items && bill.items.length > 0 ? calculateTotalBill(bill.items) : bill.amount
    return sum + billTotal
  }, 0)

  return totalBillAmount / tenants.length
}