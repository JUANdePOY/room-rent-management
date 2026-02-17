'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Bill, Payment, Tenant, Room, BillItem } from '@/types'
import * as XLSX from 'xlsx'
import { calculateRemainingBill } from '@/lib/billingUtils'

export default function AdminInvoicesPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filter options
  const [filterType, setFilterType] = useState<'all' | 'month' | 'year' | 'tenant'>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString())
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [selectedTenant, setSelectedTenant] = useState<string>('')

  useEffect(() => {
    const fetchData = async () => {
      const [billsData, paymentsData, tenantsData, roomsData, billItemsData] = await Promise.all([
        supabase.from('bills').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('tenants').select('*'),
        supabase.from('rooms').select('*'),
        supabase.from('bill_items').select('*'),
      ])

      if (billsData.data) {
        const billsWithItems = billsData.data.map(bill => {
          const items = billItemsData.data?.filter(item => item.bill_id === bill.id) || []
          return { ...bill, items }
        })
        setBills(billsWithItems)
      }
      if (paymentsData.data) setPayments(paymentsData.data)
      if (tenantsData.data) setTenants(tenantsData.data)
      if (roomsData.data) setRooms(roomsData.data)

      setLoading(false)
    }
    fetchData()
  }, [])

  const filteredBills = bills.filter(bill => {
    const billDate = new Date(bill.due_date)
    
    if (filterType === 'month') {
      const billMonth = billDate.getMonth() + 1
      const billYear = billDate.getFullYear()
      return billMonth === parseInt(selectedMonth) && billYear === parseInt(selectedYear)
    }

    if (filterType === 'year') {
      const billYear = billDate.getFullYear()
      return billYear === parseInt(selectedYear)
    }

    if (filterType === 'tenant') {
      return bill.tenant_id === selectedTenant
    }

    return true
  })

  const getTenantName = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId)
    return tenant ? tenant.name : 'Unknown Tenant'
  }

  const getRoomNumber = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId)
    return room ? room.room_number : 'Unknown Room'
  }

  const exportToExcel = () => {
    let data: any[] = []
    let wscols: any[] = []
    let sheetName = 'Invoices'

    if (filterType === 'month' || filterType === 'all') {
      // For month or all filters: room id, tenant name, wifi, water, electricity, rent, total bill
      const roomBillMap = new Map<string, any>()

      filteredBills.forEach(bill => {
        const tenant = tenants.find(t => t.id === bill.tenant_id)
        const room = rooms.find(r => r.id === bill.room_id)
        
        if (!roomBillMap.has(bill.room_id)) {
          const billItems = bill.items || []
          const wifiAmount = billItems.find((item: BillItem) => item.item_type === 'wifi')?.amount || 0
          const waterAmount = billItems.find((item: BillItem) => item.item_type === 'water')?.amount || 0
          const electricityAmount = billItems.find((item: BillItem) => item.item_type === 'electricity')?.amount || 0
          const rentAmount = billItems.find((item: BillItem) => item.item_type === 'room_rent')?.amount || 0

          roomBillMap.set(bill.room_id, {
            'Room ID': bill.room_id,
            'Tenant Name': getTenantName(bill.tenant_id),
            'Wifi': `₱₱{wifiAmount.toFixed(2)}`,
            'Water': `₱₱{waterAmount.toFixed(2)}`,
            'Electricity': `₱₱{electricityAmount.toFixed(2)}`,
            'Month Rent': `₱₱{rentAmount.toFixed(2)}`,
            'Total Bill (Current Month)': `₱₱{bill.amount.toFixed(2)}`
          })
        }
      })

      data = Array.from(roomBillMap.values())
      wscols = [
        { wch: 20 }, // Room ID
        { wch: 25 }, // Tenant Name
        { wch: 10 }, // Wifi
        { wch: 10 }, // Water
        { wch: 15 }, // Electricity
        { wch: 12 }, // Month Rent
        { wch: 20 }  // Total Bill
      ]
    } 
    else if (filterType === 'year') {
      // For year filter: room number, tenant name, months, total revenue
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      
      const roomYearMap = new Map<string, any>()

      filteredBills.forEach(bill => {
        const billDate = new Date(bill.due_date)
        const monthIndex = billDate.getMonth()
        const monthName = months[monthIndex]
        
        if (!roomYearMap.has(bill.room_id)) {
          const room = rooms.find(r => r.id === bill.room_id)
          const tenant = tenants.find(t => t.id === bill.tenant_id)
          const initialData: any = {
            'Room Number': getRoomNumber(bill.room_id),
            'Tenant Name': getTenantName(bill.tenant_id)
          }
          months.forEach(m => initialData[m] = '₱0.00')
          initialData['Total Revenue'] = '₱0.00'
          roomYearMap.set(bill.room_id, initialData)
        }

        const roomData = roomYearMap.get(bill.room_id)
        roomData[monthName] = `₱₱{bill.amount.toFixed(2)}`
        
        const currentTotal = parseFloat(roomData['Total Revenue'].replace('₱', ''))
        roomData['Total Revenue'] = `₱₱{(currentTotal + bill.amount).toFixed(2)}`
      })

      data = Array.from(roomYearMap.values())
      wscols = [
        { wch: 15 }, // Room Number
        { wch: 25 }, // Tenant Name
        ...months.map(() => ({ wch: 12 })), // Months
        { wch: 15 }  // Total Revenue
      ]
    } 
    else if (filterType === 'tenant') {
      // For tenant filter: months, wifi, water, electricity, rent, total bill
      const tenant = tenants.find(t => t.id === selectedTenant)
      if (!tenant) return

      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]

      const tenantMonths: any[] = []

      filteredBills.forEach(bill => {
        const billDate = new Date(bill.due_date)
        const monthName = months[billDate.getMonth()] + ' ' + billDate.getFullYear()
        
        const billItems = bill.items || []
        const wifiAmount = billItems.find((item: BillItem) => item.item_type === 'wifi')?.amount || 0
        const waterAmount = billItems.find((item: BillItem) => item.item_type === 'water')?.amount || 0
        const electricityAmount = billItems.find((item: BillItem) => item.item_type === 'electricity')?.amount || 0
        const rentAmount = billItems.find((item: BillItem) => item.item_type === 'room_rent')?.amount || 0

        tenantMonths.push({
          'Months': monthName,
          'Wifi': `₱₱{wifiAmount.toFixed(2)}`,
          'Water': `₱₱{waterAmount.toFixed(2)}`,
          'Electricity': `₱₱{electricityAmount.toFixed(2)}`,
          'Month Rent': `₱₱{rentAmount.toFixed(2)}`,
          'Total Bill': `₱₱{bill.amount.toFixed(2)}`
        })
      })

      // Add tenant details at the beginning of the data
      const tenantDetails = [
        {
          'Tenant Name': tenant.name,
          'Contact': tenant.contact,
          'Emergency Contact Name': tenant.emergency_contact_name,
          'Emergency Contact Number': tenant.emergency_contact_number,
          'Start Date': new Date(tenant.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        },
        {} // Empty row for separation
      ]

      data = [...tenantDetails, ...tenantMonths]
      wscols = [
        { wch: 20 }, // Months/Tenant Details
        { wch: 10 }, // Wifi
        { wch: 10 }, // Water
        { wch: 15 }, // Electricity
        { wch: 12 }, // Month Rent
        { wch: 15 }  // Total Bill
      ]
    }

    const worksheet = XLSX.utils.json_to_sheet(data)
    worksheet['!cols'] = wscols
    worksheet['!rows'] = data.map(() => ({ hpx: 20 }))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    
    let fileName = 'invoices'
    if (filterType === 'month') {
      const monthName = new Date(2024, parseInt(selectedMonth) - 1, 1).toLocaleString('default', { month: 'long' })
      fileName = `invoices-${monthName}-${selectedYear}`
    } else if (filterType === 'year') {
      fileName = `invoices-${selectedYear}`
    } else if (filterType === 'tenant') {
      const tenant = tenants.find(t => t.id === selectedTenant)
      fileName = `invoices-${tenant?.name.toLowerCase().replace(/\s+/g, '-')}`
    }
    
    XLSX.writeFile(workbook, `${fileName}.xlsx`)
  }

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString())
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString())

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Invoices Management</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Filter Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Invoices</option>
                <option value="month">By Month</option>
                <option value="year">By Year</option>
                <option value="tenant">By Tenant</option>
              </select>
            </div>

            {filterType === 'month' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {months.map(month => (
                      <option key={month} value={month}>
                        {new Date(2024, parseInt(month) - 1, 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {filterType === 'year' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}

            {filterType === 'tenant' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tenant</label>
                <select
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Tenant</option>
                  {tenants.map(tenant => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <button
            onClick={exportToExcel}
            disabled={filteredBills.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export to Excel ({filteredBills.length} invoices)</span>
          </button>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Filtered Invoices ({filteredBills.length})</h3>
          
          {filteredBills.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No invoices found for the selected filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBills.map(bill => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bill.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getTenantName(bill.tenant_id)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getRoomNumber(bill.room_id)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{bill.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(bill.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ₱{
                          bill.status === 'paid' ? 'bg-green-100 text-green-800' :
                          bill.status === 'overdue' ? 'bg-red-100 text-red-800' :
                          bill.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
