import { Bill, BillItem, Payment } from '../types'

// Centralized function to calculate total bill from bill items
export const calculateTotalBill = (items: BillItem[]): number => {
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