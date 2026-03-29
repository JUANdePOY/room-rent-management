import { Bill, BillItem, Payment, Tenant, Room, BillingRate, ElectricReading } from '../types'

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
  const requiredItemTypes: Array<'room_rent' | 'electricity'> = ['room_rent', 'electricity']
  const itemTypes = items.map(item => item.item_type)
  
  return requiredItemTypes.every(type => itemTypes.includes(type as any))
}

// Function to calculate bill items with remaining balance from previous month
export const calculateBillItems = (
  billId: string,
  rentAmount: number,
  electricAmount: number,
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

// NEW: Calculate electric bill summary per room per month
export interface ElectricSummaryItem {
  room_number: string
  room_id: string
  tenant_name: string
  tenant_id: string
  month_year: string
  current_reading?: number
  previous_reading?: number
  usage_kwh?: number
  rate?: number
  electric_amount: number
  bill_status: 'paid' | 'partial' | 'pending' | 'overdue' | 'no_bill'
  bill_id?: string
  row_color: 'green' | 'yellow' | 'red' | 'gray'
}

export const calculateElectricSummary = (
  readings: ElectricReading[],
  rates: BillingRate[],
  rooms: Room[],
  tenants: Tenant[],
  bills: Bill[],
  payments: Payment[],
  billItems: BillItem[],
  monthYear: string
): ElectricSummaryItem[] => {
  const occupiedRooms = rooms.filter(room => room.status === 'occupied')
  const previousMonth = getPreviousMonth(monthYear) // Get previous month for calculation

  return occupiedRooms
    .sort((a, b) => parseInt(a.room_number) - parseInt(b.room_number))
    .map(room => {
      const tenant = tenants.find(t => t.room_id === room.id)
      if (!tenant) {
        return {
          room_number: room.room_number,
          room_id: room.id,
          tenant_name: 'No Tenant',
          tenant_id: '',
          month_year: monthYear,
          current_reading: undefined,
          previous_reading: undefined,
          usage_kwh: undefined,
          rate: undefined,
          electric_amount: 0,
          bill_status: 'no_bill' as const,
          row_color: 'gray' as const,
        }
      }

      // Try bill_items first (more accurate if bills generated)
      const electricItems = billItems.filter(item => 
        item.item_type === 'electricity' &&
        bills.some(bill => 
          bill.id === item.bill_id &&
          bill.room_id === room.id &&
          bill.description?.includes(monthYear)
        )
      )
      let electricAmount = electricItems.reduce((sum, item) => sum + item.amount, 0)

      // Fix for no tenant bill matching
      if (electricAmount === 0 && tenant) {
        const electricItemsTenant = billItems.filter(item => 
          item.item_type === 'electricity' &&
          bills.some(bill => 
            bill.id === item.bill_id &&
            bill.tenant_id === tenant.id &&
            bill.description?.includes(monthYear)
          )
        )
        electricAmount = electricItemsTenant.reduce((sum, item) => sum + item.amount, 0)
      }

      let billStatus: ElectricSummaryItem['bill_status'] = 'no_bill'
      let billId: string | undefined
      let rowColor: ElectricSummaryItem['row_color'] = 'gray'
      let currentReading: ElectricReading | undefined
      let previousReading: ElectricReading | undefined
      let rate: BillingRate | undefined
      let usageKwh: number | undefined

      // Get readings and rate for calculation (even if bills are generated)
      // Electric bill for month = current month reading - previous month reading
      currentReading = readings.find(r => r.room_id === room.id && r.month_year === monthYear)
      previousReading = readings.find(r => r.room_id === room.id && r.month_year === previousMonth)
      rate = rates.find(r => r.month_year === monthYear)

      if (currentReading && previousReading) {
        usageKwh = currentReading.reading - previousReading.reading
      }

      // Fallback to calculation if no bill items
      if (electricAmount === 0) {
        if (currentReading && previousReading && rate) {
          const usage = currentReading.reading - previousReading.reading
          electricAmount = usage * rate.electricity_rate
        }
      }

      // Find bill and status
      const roomBills = bills.filter(bill => 
        (bill.tenant_id === tenant.id || bill.room_id === room.id) && 
        bill.description?.includes(monthYear)
      )
      if (roomBills.length > 0) {
        const bill = roomBills[0]
        billId = bill.id
        
        // Custom logic for electric bill status: consider electric bill as paid if exact electric amount is paid
        // even if other bill types remain unpaid
        const electricBillItems = billItems.filter(item => 
          item.bill_id === bill.id && item.item_type === 'electricity'
        )
        const totalElectricAmount = electricBillItems.reduce((sum, item) => sum + item.amount, 0)
        
        // Get all accepted payments for this bill
        const billPayments = payments.filter(payment => 
          payment.bill_id === bill.id && payment.status === 'accepted'
        )
        const totalPaid = billPayments.reduce((sum, payment) => sum + payment.amount_paid, 0)
        
        // Check if total paid equals the electric bill amount
        if (totalPaid >= totalElectricAmount && totalElectricAmount > 0) {
          billStatus = 'paid'
          rowColor = 'green'
        } else if (totalPaid > 0) {
          billStatus = 'partial'
          rowColor = 'yellow'
        } else {
          // Check if bill is overdue
          const dueDate = new Date(bill.due_date)
          const now = new Date()
          billStatus = now > dueDate ? 'overdue' : 'pending'
          rowColor = billStatus === 'overdue' ? 'red' : 'red'
        }
      }

      return {
        room_number: room.room_number,
        room_id: room.id,
        tenant_name: tenant.name,
        tenant_id: tenant.id,
        month_year: monthYear,
        current_reading: currentReading?.reading,
        previous_reading: previousReading?.reading,
        usage_kwh: usageKwh,
        rate: rate?.electricity_rate,
        electric_amount: electricAmount,
        bill_status: billStatus,
        bill_id: billId,
        row_color: rowColor,
      }
    })
    .filter(item => item.electric_amount > 0 || item.bill_status !== 'no_bill')
}

// Helper function (copied from billing/page.tsx)
function getNextMonth(monthYear: string): string {
  const [year, month] = monthYear.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  date.setMonth(date.getMonth() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Helper function to get previous month
function getPreviousMonth(monthYear: string): string {
  const [year, month] = monthYear.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  date.setMonth(date.getMonth() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

