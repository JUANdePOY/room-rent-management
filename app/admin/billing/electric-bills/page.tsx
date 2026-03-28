'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { 
  BillingRate, 
  ElectricReading, 
  Tenant, 
  Room, 
  Bill, 
  BillItem, 
  Payment
} from '../../../../types'
import type { ElectricSummaryItem } from '../../../../lib/billingUtils'
import { 
  calculateElectricSummary
} from '../../../../lib/billingUtils'
import Link from 'next/link'

export default function ElectricBillsPage() {
  const [billingRates, setBillingRates] = useState<BillingRate[]>([])
  const [electricReadings, setElectricReadings] = useState<ElectricReading[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [summary, setSummary] = useState<ElectricSummaryItem[]>([])
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [loading, setLoading] = useState(true)
  const [showBillingModal, setShowBillingModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ElectricSummaryItem | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    method: 'gcash',
    referenceNumber: '',
    receivedBy: '',
    amountPaid: 0,
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (billingRates.length > 0 && electricReadings.length > 0) {
      const calculatedSummary = calculateElectricSummary(
        electricReadings,
        billingRates,
        rooms,
        tenants,
        bills,
        payments,
        billItems,
        selectedMonth
      )
      setSummary(calculatedSummary)
    }
  }, [selectedMonth, billingRates, electricReadings, rooms, tenants, bills, payments, billItems])

  const fetchData = async () => {
    try {
      const [ratesData, readingsData, tenantsData, roomsData, billsData, paymentsData, billItemsData] = await Promise.all([
        supabase.from('billing_rates').select('*'),
        supabase.from('electric_readings').select('*'),
        supabase.from('tenants').select('*'),
        supabase.from('rooms').select('*'),
        supabase.from('bills').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('bill_items').select('*'),
      ])

      if (ratesData.data) setBillingRates(ratesData.data)
      if (readingsData.data) setElectricReadings(readingsData.data)
      if (tenantsData.data) setTenants(tenantsData.data)
      if (roomsData.data) {
        const sortedRooms = [...roomsData.data].sort((a, b) => parseInt(a.room_number) - parseInt(b.room_number))
        setRooms(sortedRooms)
      }
      if (billsData.data) setBills(billsData.data)
      if (paymentsData.data) setPayments(paymentsData.data)
      if (billItemsData.data) setBillItems(billItemsData.data)
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: ElectricSummaryItem['bill_status']) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      case 'pending': 
      case 'overdue': return 'bg-red-100 text-red-800'
      case 'no_bill': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRowColor = (color: ElectricSummaryItem['row_color']) => {
    switch (color) {
      case 'green': return 'bg-green-50 hover:bg-green-100 border-l-4 border-green-500'
      case 'yellow': return 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-500'
      case 'red': return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500'
      case 'gray': return 'bg-gray-50 hover:bg-gray-100 border-l-4 border-gray-500'
      default: return 'bg-gray-50 hover:bg-gray-100 border-l-4 border-gray-500'
    }
  }

  const handleRowClick = (item: ElectricSummaryItem) => {
    setSelectedItem(item)
    setShowBillingModal(true)
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || !selectedItem.bill_id) {
      alert('No bill found for this item')
      return
    }

    try {
      const bill = bills.find(b => b.id === selectedItem.bill_id)
      if (!bill) {
        alert('Bill not found')
        return
      }

      const { data, error } = await supabase.from('payments').insert([
        {
          bill_id: selectedItem.bill_id,
          tenant_id: selectedItem.tenant_id,
          amount_paid: paymentForm.amountPaid,
          payment_date: new Date().toISOString(),
          method: paymentForm.method,
          reference_number: paymentForm.referenceNumber,
          received_by: paymentForm.receivedBy,
          status: 'accepted',
        },
      ]).select()

      if (error) {
        throw error
      }

      // Refresh data
      await fetchData()
      setShowBillingModal(false)
      setSelectedItem(null)
      setPaymentForm({
        method: 'gcash',
        referenceNumber: '',
        receivedBy: '',
        amountPaid: 0,
      })

      alert('Payment added successfully!')
    } catch (error) {
      console.error('Error adding payment:', error)
      alert('Failed to add payment. Please try again.')
    }
  }

  const totals = summary.reduce((acc, item) => {
    acc.totalAmount += item.electric_amount
    switch (item.bill_status) {
      case 'paid': acc.paidCount++; break
      case 'partial': acc.partialCount++; break
      case 'pending': 
      case 'overdue': acc.unpaidCount++; break
    }
    return acc
  }, { totalAmount: 0, paidCount: 0, partialCount: 0, unpaidCount: 0 })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link href="/admin/billing" className="text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base">
              ← Back to Billing
            </Link>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Electric Bills Summary</h1>
          </div>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Track electricity usage and payment status for all rooms per month
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex items-center space-x-2">
            <label className="text-xs sm:text-sm font-medium text-gray-700">Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="card bg-green-50 border-l-4 border-green-400 p-3 sm:p-6">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900">Total Electric</h3>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">₱{totals.totalAmount.toFixed(2)}</p>
        </div>
        <div className="card bg-green-50 border-l-4 border-green-400 p-3 sm:p-6">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900">Paid</h3>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{totals.paidCount}</p>
        </div>
        <div className="card bg-yellow-50 border-l-4 border-yellow-400 p-3 sm:p-6">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900">Partial</h3>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-600">{totals.partialCount}</p>
        </div>
        <div className="card bg-red-50 border-l-4 border-red-400 p-3 sm:p-6">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900">Unpaid</h3>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600">{totals.unpaidCount}</p>
        </div>
      </div>

      {/* Electric Bills Table */}
      <div className="card">
        <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 text-gray-900">
          Rooms Electric Bills - {formatMonth(selectedMonth)}
        </h3>
        
        {/* Mobile Card View (< 768px) */}
        <div className="block md:hidden space-y-3">
          {summary.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No electric bill data for {formatMonth(selectedMonth)}.
              Add readings or generate bills first.
            </div>
          ) : (
            summary.map((item, index) => (
              <div
                key={index}
                className={`${getRowColor(item.row_color)} rounded-lg p-4 cursor-pointer transition-all duration-200 shadow-sm`}
                onClick={() => handleRowClick(item)}
                onKeyDown={(e) => e.key === 'Enter' && handleRowClick(item)}
                tabIndex={0}
                role="button"
                aria-label={`View billing details for Room ${item.room_number}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg">Room {item.room_number}</h4>
                    <p className="text-sm text-gray-600">{item.tenant_name || 'No tenant'}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.bill_status)}`}>
                    {item.bill_status.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Current:</span>
                    <span className="ml-1 font-medium">{item.current_reading || '--'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Next:</span>
                    <span className="ml-1 font-medium">{item.next_reading || '--'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Usage:</span>
                    <span className="ml-1 font-medium">{item.usage_kwh ? `${item.usage_kwh.toFixed(2)} kWh` : '-- kWh'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rate:</span>
                    <span className="ml-1 font-medium">{item.rate ? `₱${item.rate.toFixed(2)}/kWh` : '--'}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Amount</span>
                  <span className="font-bold text-xl text-blue-600">₱{item.electric_amount.toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
          {summary.length > 0 && (
            <div className="bg-gray-100 rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">TOTAL</span>
                <span className="font-bold text-2xl text-blue-600">₱{totals.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Table View (>= 768px) */}
        <div className="hidden md:block">
          <table className="w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Room</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Tenant</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell w-24">Current</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell w-24">Next</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Usage (kWh)</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell w-24">Rate</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>No electric bill data for {formatMonth(selectedMonth)}.</p>
                      <p className="text-sm">Add readings or generate bills first.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                summary.map((item, index) => (
                  <tr
                    key={index}
                    className={`${getRowColor(item.row_color)} cursor-pointer transition-all duration-200 hover:shadow-md`}
                    onClick={() => handleRowClick(item)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRowClick(item)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View billing details for Room ${item.room_number}`}
                  >
                    <td className="px-3 py-4 font-medium text-gray-900 truncate">
                      Room {item.room_number}
                    </td>
                    <td className="px-3 py-4 text-gray-900 truncate">
                      {item.tenant_name}
                    </td>
                    <td className="px-3 py-4 text-gray-500 hidden lg:table-cell truncate">
                      {item.current_reading || '--'}
                    </td>
                    <td className="px-3 py-4 text-gray-500 hidden lg:table-cell truncate">
                      {item.next_reading || '--'}
                    </td>
                    <td className="px-3 py-4 text-gray-500 truncate">
                      {item.usage_kwh ? `${item.usage_kwh.toFixed(2)} kWh` : '-- kWh'}
                    </td>
                    <td className="px-3 py-4 text-gray-500 hidden xl:table-cell truncate">
                      {item.rate ? `₱${item.rate.toFixed(2)}/kWh` : '--'}
                    </td>
                    <td className="px-3 py-4 font-semibold text-gray-900 truncate">
                      ₱{item.electric_amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.bill_status)}`}>
                        {item.bill_status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {summary.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={5} className="px-3 py-4 text-right font-semibold text-gray-900 hidden lg:table-cell">
                    TOTAL:
                  </td>
                  <td colSpan={3} className="px-3 py-4 text-right font-semibold text-gray-900 lg:hidden">
                    TOTAL:
                  </td>
                  <td className="px-3 py-4 font-bold text-xl text-blue-600 truncate">
                    ₱{totals.totalAmount.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Billing Details Modal */}
      {showBillingModal && selectedItem && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full max-w-[calc(100%-1rem)] sm:max-w-lg mx-2 sm:mx-4 my-2 sm:my-4 max-h-[85vh] sm:max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Billing Details - Room {selectedItem.room_number}
              </h3>
              <button
                onClick={() => {
                  setShowBillingModal(false)
                  setSelectedItem(null)
                  setPaymentForm({
                    method: 'gcash',
                    referenceNumber: '',
                    receivedBy: '',
                    amountPaid: 0,
                  })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Billing Information */}
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 sm:p-4 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Tenant</span>
                  <span className="text-base sm:text-lg font-bold text-gray-900">{selectedItem.tenant_name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 sm:mt-1 gap-1 sm:gap-0">
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Month</span>
                  <span className="text-base sm:text-lg font-bold text-gray-900">{formatMonth(selectedItem.month_year)}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 sm:mt-1 gap-1 sm:gap-0">
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Electric Amount</span>
                  <span className="text-base sm:text-lg font-bold text-green-600">₱{selectedItem.electric_amount.toFixed(2)}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 sm:mt-1 gap-1 sm:gap-0">
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Status</span>
                  <span className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedItem.bill_status)} self-start sm:self-auto`}>
                    {selectedItem.bill_status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Usage Details */}
              {(selectedItem.usage_kwh || selectedItem.current_reading || selectedItem.next_reading) && (
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Usage Details</h4>
                  {selectedItem.current_reading && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs sm:text-sm gap-1 sm:gap-0">
                      <span className="text-gray-700">Current Reading:</span>
                      <span className="font-medium">{selectedItem.current_reading}</span>
                    </div>
                  )}
                  {selectedItem.next_reading && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs sm:text-sm gap-1 sm:gap-0 mt-2 sm:mt-0">
                      <span className="text-gray-700">Next Reading:</span>
                      <span className="font-medium">{selectedItem.next_reading}</span>
                    </div>
                  )}
                  {selectedItem.usage_kwh && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs sm:text-sm gap-1 sm:gap-0 mt-2 sm:mt-0">
                      <span className="text-gray-700">Usage (kWh):</span>
                      <span className="font-medium">{selectedItem.usage_kwh.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedItem.rate && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs sm:text-sm gap-1 sm:gap-0 mt-2 sm:mt-0">
                      <span className="text-gray-700">Rate (₱/kWh):</span>
                      <span className="font-medium">{selectedItem.rate.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Form */}
              {selectedItem.bill_id && selectedItem.bill_status !== 'paid' && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Add Payment</h4>
                  <form onSubmit={handlePaymentSubmit} className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Amount to Pay</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paymentForm.amountPaid || ''}
                        onChange={(e) => setPaymentForm(prev => ({
                          ...prev,
                          amountPaid: e.target.value ? parseFloat(e.target.value) : 0
                        }))}
                        className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        placeholder="Enter amount"
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                      <div className="space-y-2">
                        {[
                          { value: 'gcash', label: 'GCash' },
                          { value: 'bank', label: 'Bank Transfer' },
                          { value: 'in_person', label: 'In Person' },
                        ].map((method) => (
                          <label key={method.value} className="flex items-center">
                            <input
                              type="radio"
                              name="method"
                              value={method.value}
                              checked={paymentForm.method === method.value}
                              onChange={() => setPaymentForm(prev => ({ ...prev, method: method.value as any }))}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              required
                            />
                            <span className="ml-2 sm:ml-3 text-xs sm:text-sm text-gray-700">{method.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {paymentForm.method === 'gcash' && (
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                        <input
                          type="text"
                          value={paymentForm.referenceNumber}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
                          className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                          placeholder="Enter GCash reference number"
                        />
                      </div>
                    )}

                    {paymentForm.method === 'bank' && (
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                        <input
                          type="text"
                          value={paymentForm.referenceNumber}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
                          className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                          placeholder="Enter bank reference number"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Received By</label>
                      <input
                        type="text"
                        value={paymentForm.receivedBy}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, receivedBy: e.target.value }))}
                        className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        placeholder="Enter receiver's name"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-3 sm:pt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 text-white px-4 py-2 text-sm sm:text-base rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Add Payment
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowBillingModal(false)
                          setSelectedItem(null)
                          setPaymentForm({
                            method: 'gcash',
                            referenceNumber: '',
                            receivedBy: '',
                            amountPaid: 0,
                          })
                        }}
                        className="px-4 py-2 text-sm sm:text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getCurrentMonth(): string {
  const now = new Date()
  return now.toISOString().slice(0, 7)
}

function formatMonth(monthYear: string): string {
  const [year, month] = monthYear.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
