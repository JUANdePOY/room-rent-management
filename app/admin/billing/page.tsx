'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { BillingRate, ElectricReading, Tenant, Room, Bill, BillItem, Payment } from '../../../types'
import { 
  calculateBillItems, 
  calculateTotalBill, 
  calculateRemainingBill,
  calculateTotalPaid,
  calculateBillStatus
} from '../../../lib/billingUtils'

export default function BillingPage() {
  const [billingRates, setBillingRates] = useState<BillingRate[]>([])
  const [electricReadings, setElectricReadings] = useState<ElectricReading[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form states
  const [rateForm, setRateForm] = useState({
    month_year: '',
    electricity_rate: '',
    water_rate: '',
    wifi_rate: '',
  })
  
  const [readingForm, setReadingForm] = useState({
    room_id: '',
    month_year: '',
    reading: '',
  })
  
  // Modal states
  const [showRateModal, setShowRateModal] = useState(false)
  const [showReadingModal, setShowReadingModal] = useState(false)
  const [showBulkReadingModal, setShowBulkReadingModal] = useState(false)
  const [showMonthReadingsModal, setShowMonthReadingsModal] = useState(false)
  const [editingRate, setEditingRate] = useState<BillingRate | null>(null)
  const [editingReading, setEditingReading] = useState<ElectricReading | null>(null)
  const [selectedMonthReadings, setSelectedMonthReadings] = useState<{
    monthYear: string
    readings: ElectricReading[]
  }>({
    monthYear: '',
    readings: [],
  })
  
  // Bulk readings state
  const [bulkReadingsForm, setBulkReadingsForm] = useState<{
    month_year: string
    readings: { room_id: string; room_number: string; reading: string }[]
  }>({
    month_year: '',
    readings: [],
  })
  
  // Generate bills state
  const [generateMonth, setGenerateMonth] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [ratesData, readingsData, tenantsData, roomsData] = await Promise.all([
        supabase.from('billing_rates').select('*'),
        supabase.from('electric_readings').select('*'),
        supabase.from('tenants').select('*'),
        supabase.from('rooms').select('*'),
      ])

      if (ratesData.error) {
        console.error('Error fetching billing rates:', ratesData.error)
        alert('Failed to fetch billing rates: ' + ratesData.error.message)
      } else if (ratesData.data) {
        setBillingRates(ratesData.data)
      }

      if (readingsData.error) {
        console.error('Error fetching electric readings:', readingsData.error)
        alert('Failed to fetch electric readings: ' + readingsData.error.message)
      } else if (readingsData.data) {
        setElectricReadings(readingsData.data)
      }

      if (tenantsData.error) {
        console.error('Error fetching tenants:', tenantsData.error)
        alert('Failed to fetch tenants: ' + tenantsData.error.message)
      } else if (tenantsData.data) {
        setTenants(tenantsData.data)
      }

      if (roomsData.error) {
        console.error('Error fetching rooms:', roomsData.error)
        alert('Failed to fetch rooms: ' + roomsData.error.message)
      } else if (roomsData.data) {
        setRooms(roomsData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Failed to fetch data: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { month_year, electricity_rate, water_rate, wifi_rate } = rateForm

    try {
      if (editingRate) {
        const { error } = await supabase
          .from('billing_rates')
          .update({
            electricity_rate: parseFloat(electricity_rate),
            water_rate: parseFloat(water_rate),
            wifi_rate: parseFloat(wifi_rate),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRate.id)
          
        if (error) {
          console.error('Error updating rate:', error)
          alert('Failed to update billing rate: ' + error.message)
          return
        }
      } else {
        const { error } = await supabase.from('billing_rates').insert({
          month_year,
          electricity_rate: parseFloat(electricity_rate),
          water_rate: parseFloat(water_rate),
          wifi_rate: parseFloat(wifi_rate),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        
        if (error) {
          console.error('Error creating rate:', error)
          alert('Failed to create billing rate: ' + error.message)
          return
        }
      }

      setShowRateModal(false)
      setEditingRate(null)
      resetRateForm()
      fetchData()
    } catch (error) {
      console.error('Error handling rate submission:', error)
      alert('An unexpected error occurred: ' + (error as Error).message)
    }
  }

  const handleReadingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { room_id, month_year, reading } = readingForm

    try {
      if (editingReading) {
        const { error } = await supabase
          .from('electric_readings')
          .update({
            room_id,
            month_year,
            reading: parseFloat(reading),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingReading.id)
          
        if (error) {
          console.error('Error updating reading:', error)
          alert('Failed to update electric reading: ' + error.message)
          return
        }
      } else {
        const { error } = await supabase.from('electric_readings').insert({
          room_id,
          month_year,
          reading: parseFloat(reading),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        
        if (error) {
          console.error('Error creating reading:', error)
          alert('Failed to create electric reading: ' + error.message)
          return
        }
      }

      setShowReadingModal(false)
      setEditingReading(null)
      resetReadingForm()
      fetchData()
    } catch (error) {
      console.error('Error handling reading submission:', error)
      alert('An unexpected error occurred: ' + (error as Error).message)
    }
  }

  const generateBills = async () => {
    if (!generateMonth) {
      alert('Please select a month')
      return
    }

    const billingRate = billingRates.find(r => r.month_year === generateMonth)
    if (!billingRate) {
      alert('Billing rates not found for selected month')
      return
    }

    // Check if bills for this month have already been generated
    const existingBills = await supabase
      .from('bills')
      .select('id')
      .ilike('description', `%${generateMonth}%`)
    
    if (existingBills.data && existingBills.data.length > 0) {
      alert(`Bills for ${generateMonth} have already been generated!`)
      return
    }

    const occupiedTenants = tenants.filter(t => {
      const room = rooms.find(r => r.id === t.room_id)
      return room?.status === 'occupied'
    })

    try {
      for (const tenant of occupiedTenants) {
        const room = rooms.find(r => r.id === tenant.room_id)
        if (!room) continue

        const currentReading = electricReadings.find(r => 
          r.room_id === room.id && r.month_year === generateMonth
        )
        
        const previousMonth = getPreviousMonth(generateMonth)
        const previousReading = electricReadings.find(r => 
          r.room_id === room.id && r.month_year === previousMonth
        )

        if (!currentReading) {
          console.warn(`No electric reading for room ${room.room_number} in ${generateMonth}`)
          continue
        }

        const electricUsage = previousReading 
          ? currentReading.reading - previousReading.reading 
          : 0
        
         const electricAmount = electricUsage * billingRate.electricity_rate
         const waterAmount = billingRate.water_rate
         const wifiAmount = billingRate.wifi_rate
         const rentAmount = room.rent_amount
         
            const prevMonth = getPreviousMonth(generateMonth)
            let remainingBalance = 0
            // Get previous month's bill specifically
            const previousBills = await supabase
              .from('bills')
              .select('*')
              .eq('tenant_id', tenant.id)
              .ilike('description', `%${prevMonth}%`)
            
            if (previousBills.data && previousBills.data.length > 0) {
              const previousBill = previousBills.data[0]
              console.log('Previous bill found:', previousBill)
              
              // Get bill items for previous bill to calculate accurate remaining balance
              const previousBillItems = await supabase
                .from('bill_items')
                .select('*')
                .eq('bill_id', previousBill.id)
              
              // Get all accepted payments for previous bill
              const previousBillPayments = await supabase
                .from('payments')
                .select('*')
                .eq('bill_id', previousBill.id)
                .eq('status', 'accepted')
              
              console.log('Previous bill payments:', previousBillPayments.data)
              
              // Calculate remaining balance using enhanced function
              const billWithItems = {
                ...previousBill,
                items: previousBillItems.data || []
              }
              
               remainingBalance = calculateRemainingBill(billWithItems, previousBillPayments.data || [])
               const totalBillFromItems = calculateTotalBill(billWithItems.items)
               const totalPaid = calculateTotalPaid(billWithItems, previousBillPayments.data || [])
               console.log('=== Previous Bill Details ===')
               console.log('Bill ID:', previousBill.id)
               console.log('Bill Amount:', previousBill.amount)
               console.log('Total Bill from Items:', totalBillFromItems)
               console.log('Total Paid:', totalPaid)
               console.log('Remaining Balance:', remainingBalance)
               console.log('Bill Items:', billWithItems.items)
            } else {
              console.log('No previous bill found for tenant:', tenant.id, 'in month:', prevMonth)
            }
          
           const totalAmount = wifiAmount + waterAmount + electricAmount + rentAmount + remainingBalance
            const calculatedBillItems = calculateBillItems('temp', rentAmount, electricAmount, waterAmount, wifiAmount, remainingBalance)
            const calculatedTotalFromItems = calculateTotalBill(calculatedBillItems)
            console.log('Calculated total bill amount:', {
              wifi: wifiAmount,
              water: waterAmount,
              electricity: electricAmount,
              rent: rentAmount,
              remainingBalance,
              totalFromCalculation: totalAmount,
              totalFromItems: calculatedTotalFromItems,
              billItems: calculatedBillItems
            })

        const dueDate = new Date(generateMonth + '-01')
        dueDate.setMonth(dueDate.getMonth() + 1)
        dueDate.setDate(dueDate.getDate() - 5)

          const { data: billData, error: billError } = await supabase
           .from('bills')
           .insert({
             tenant_id: tenant.id,
             room_id: room.id,
             amount: totalAmount,
             due_date: dueDate.toISOString(),
             status: 'pending',
             description: `Monthly Bill - ${generateMonth}`,
             created_at: new Date().toISOString(),
             updated_at: new Date().toISOString(),
           })
           .select()

        if (billError) {
          console.error('Error creating bill:', billError)
          alert('Failed to create bill: ' + billError.message)
          continue
        }

        if (billData && billData.length > 0) {
          const billId = billData[0].id
          
           // Calculate bill items using centralized function
          let billItems: Omit<BillItem, 'id' | 'created_at'>[] = calculateBillItems(
            billId,
            rentAmount,
            electricAmount,
            waterAmount,
            wifiAmount,
            remainingBalance
          )
          
          console.log('=== Bill Items Generation ===')
          console.log('Remaining Balance Passed to calculateBillItems:', remainingBalance)
          console.log('Generated Bill Items:', billItems)

           // Update item details with specific information
            billItems = billItems.map(item => {
              if (item.item_type === 'room_rent') {
                return { ...item, details: `Room Rent: ${room.room_number}` }
              } else if (item.item_type === 'electricity') {
                return { ...item, details: `Electricity: ${electricUsage.toFixed(2)} kWh × ₱${billingRate.electricity_rate.toFixed(4)}/kWh` }
              } else if (item.item_type === 'remaining_balance') {
                const isCredit = item.amount < 0
                return { 
                  ...item, 
                  details: isCredit 
                    ? `Credit from Overpayment in ${prevMonth}` 
                    : `Remaining Balance from ${prevMonth}` 
                }
              }
              return item
            })

          const { error: itemsError } = await supabase
            .from('bill_items')
            .insert(billItems)

          if (itemsError) {
            console.error('Error creating bill items:', itemsError)
            alert('Failed to create bill items: ' + itemsError.message)
          }
        }
      }

      alert('Bills generated successfully!')
      setGenerateMonth('')
    } catch (error) {
      console.error('Error generating bills:', error)
      alert('An unexpected error occurred: ' + (error as Error).message)
    }
  }

  const getPreviousMonth = (monthYear: string): string => {
    const [year, month] = monthYear.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    date.setMonth(date.getMonth() - 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  const resetRateForm = () => {
    setRateForm({
      month_year: '',
      electricity_rate: '',
      water_rate: '',
      wifi_rate: '',
    })
  }

  const resetReadingForm = () => {
    setReadingForm({
      room_id: '',
      month_year: '',
      reading: '',
    })
  }

  const handleBulkReadingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const { month_year, readings } = bulkReadingsForm
    const validReadings = readings.filter(r => r.reading.trim() !== '')
    
    if (validReadings.length === 0) {
      alert('Please enter at least one reading')
      return
    }

    try {
      const promises = validReadings.map(async ({ room_id, reading }) => {
        // Check if reading exists for this room and month
        const existingReading = electricReadings.find(
          r => r.room_id === room_id && r.month_year === month_year
        )
        
        if (existingReading) {
          // Update existing reading
          return supabase
            .from('electric_readings')
            .update({
              reading: parseFloat(reading),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingReading.id)
        } else {
          // Create new reading
          return supabase
            .from('electric_readings')
            .insert({
              room_id,
              month_year,
              reading: parseFloat(reading),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
        }
      })

      const results = await Promise.all(promises)
      
      // Check for errors
      const errors = results.filter(result => result.error)
      if (errors.length > 0) {
        console.error('Errors during bulk reading submission:', errors)
        alert('Some readings failed to save. Please try again.')
        return
      }

      alert('Readings saved successfully!')
      setShowBulkReadingModal(false)
      resetBulkReadingsForm()
      fetchData()
    } catch (error) {
      console.error('Error handling bulk readings submission:', error)
      alert('An unexpected error occurred: ' + (error as Error).message)
    }
  }

  const resetBulkReadingsForm = () => {
    setBulkReadingsForm({
      month_year: '',
      readings: [],
    })
  }

  const handleViewMonthReadings = (monthYear: string) => {
    const monthReadings = electricReadings.filter(r => r.month_year === monthYear)
    setSelectedMonthReadings({
      monthYear,
      readings: monthReadings,
    })
    setShowMonthReadingsModal(true)
  }

  const handleDeleteReading = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reading?')) return
    
    try {
      const { error } = await supabase
        .from('electric_readings')
        .delete()
        .eq('id', id)
        
      if (error) {
        console.error('Error deleting reading:', error)
        alert('Failed to delete reading: ' + error.message)
        return
      }
      
      // Update local state
      setSelectedMonthReadings(prev => ({
        ...prev,
        readings: prev.readings.filter(r => r.id !== id),
      }))
      
      // Close modals if open
      setShowReadingModal(false)
      setEditingReading(null)
      resetReadingForm()
      
      fetchData()
    } catch (error) {
      console.error('Error deleting reading:', error)
      alert('An unexpected error occurred: ' + (error as Error).message)
    }
  }

  const handleBulkReadingsMonthChange = (monthYear: string) => {
    const occupiedRooms = rooms.filter(room => room.status === 'occupied')
    
    // Get existing readings for this month
    const existingReadings = electricReadings.filter(r => r.month_year === monthYear)
    
    setBulkReadingsForm({
      month_year: monthYear,
      readings: occupiedRooms.map(room => {
        const existingReading = existingReadings.find(r => r.room_id === room.id)
        return {
          room_id: room.id,
          room_number: room.room_number,
          reading: existingReading ? existingReading.reading.toString() : '',
        }
      }),
    })
  }

  const handleBulkReadingChange = (index: number, value: string) => {
    const updatedReadings = [...bulkReadingsForm.readings]
    updatedReadings[index].reading = value
    setBulkReadingsForm({
      ...bulkReadingsForm,
      readings: updatedReadings,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Generate Bills Section */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Generate Monthly Bills</h3>
        <div className="flex space-x-4">
          <input
            type="month"
            value={generateMonth}
            onChange={(e) => setGenerateMonth(e.target.value)}
            className="input-field"
          />
          <button
            onClick={generateBills}
            className="btn-primary"
          >
            Generate Bills
          </button>
        </div>
      </div>

      {/* Billing Rates Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Billing Rates</h3>
          <button
            onClick={() => setShowRateModal(true)}
            className="btn-primary"
          >
            Add Rate
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Month
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Electricity Rate (per kWh)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Water Bill
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  WiFi Bill
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {billingRates.map((rate) => (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const [year, month] = rate.month_year.split('-').map(Number)
                      const date = new Date(year, month - 1, 1)
                      return date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        year: 'numeric' 
                      })
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">₱{rate.electricity_rate.toFixed(4)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">₱{rate.water_rate.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">₱{rate.wifi_rate.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => {
                        setEditingRate(rate)
                        setRateForm({
                          month_year: rate.month_year,
                          electricity_rate: rate.electricity_rate.toString(),
                          water_rate: rate.water_rate.toString(),
                          wifi_rate: rate.wifi_rate.toString(),
                        })
                        setShowRateModal(true)
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Electric Readings Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Electric Readings</h3>
          <div className="space-x-2">
            <input
              type="month"
              value={generateMonth}
              onChange={(e) => setGenerateMonth(e.target.value)}
              className="input-field"
            />
            <button
              onClick={() => setShowReadingModal(true)}
              className="btn-primary"
            >
              Add Reading
            </button>
            <button
              onClick={() => {
                // Initialize with current month and occupied rooms
                const currentMonth = new Date().toISOString().slice(0, 7)
                handleBulkReadingsMonthChange(currentMonth)
                setShowBulkReadingModal(true)
              }}
              className="btn-secondary"
            >
              Bulk Entry
            </button>
          </div>
        </div>

        {/* Monthly Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }, (_, index) => {
            const year = new Date().getFullYear()
            const monthYear = `${year}-${String(index + 1).padStart(2, '0')}`
            const monthDate = new Date(year, index, 1)
            const monthName = monthDate.toLocaleDateString('en-US', { 
              month: 'short', 
              year: 'numeric' 
            })
            
            // Get all readings for this month
            const monthReadings = electricReadings.filter(r => r.month_year === monthYear)
            
            return (
              <div key={monthYear} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col items-center text-center">
                  <h4 className="text-md font-semibold text-gray-900 mb-2">{monthName}</h4>
                  <div className="mb-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      monthReadings.length > 0 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {monthReadings.length} Reading{monthReadings.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => handleViewMonthReadings(monthYear)}
                    className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    See Details
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Month Readings Modal */}
      {showMonthReadingsModal && (
         <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50 p-4">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-2xl sm:max-w-2xl mx-4 my-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Electric Readings - {(() => {
                const [year, month] = selectedMonthReadings.monthYear.split('-').map(Number)
                const date = new Date(year, month - 1, 1)
                return date.toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })
              })()}
            </h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Room
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reading (kWh)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedMonthReadings.readings.map((reading) => {
                    const room = rooms.find(r => r.id === reading.room_id)
                    return (
                      <tr key={reading.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">{room?.room_number}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{reading.reading.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(reading.updated_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => {
                              setEditingReading(reading)
                              setReadingForm({
                                room_id: reading.room_id,
                                month_year: reading.month_year,
                                reading: reading.reading.toString(),
                              })
                              setShowReadingModal(true)
                              setShowMonthReadingsModal(false)
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteReading(reading.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  
                  {selectedMonthReadings.readings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No readings for this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setShowMonthReadingsModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleBulkReadingsMonthChange(selectedMonthReadings.monthYear)
                  setShowMonthReadingsModal(false)
                  setShowBulkReadingModal(true)
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Bulk Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Readings Modal */}
      {showBulkReadingModal && (
         <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50 p-4">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-4xl sm:max-w-4xl mx-4 my-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Bulk Electric Readings
            </h3>
            <form onSubmit={handleBulkReadingsSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month/Year</label>
                <input
                  type="month"
                  value={bulkReadingsForm.month_year}
                  onChange={(e) => handleBulkReadingsMonthChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {bulkReadingsForm.readings.length > 0 && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-2">Rooms</h4>
                  <div className="space-y-2">
                    {bulkReadingsForm.readings.map((roomReading, index) => (
                      <div key={roomReading.room_id} className="flex space-x-4 items-center p-3 bg-gray-50 rounded-md">
                        <div className="w-20 text-sm font-medium text-gray-900">
                          Room {roomReading.room_number}
                        </div>
                        <div className="flex-1">
                          <input
                            type="number"
                            step="0.01"
                            value={roomReading.reading}
                            onChange={(e) => handleBulkReadingChange(index, e.target.value)}
                            placeholder="Enter reading"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="w-12 text-sm text-gray-500">
                          kWh
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkReadingModal(false)
                    resetBulkReadingsForm()
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  Save Readings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Billing Rates Modal */}
      {showRateModal && (
         <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-md sm:max-w-md mx-4 my-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              {editingRate ? 'Edit Billing Rate' : 'Add Billing Rate'}
            </h3>
            <form onSubmit={handleRateSubmit} className="space-y-4">
              <div>
                <label className="label">Month/Year</label>
                <input
                  type="month"
                  value={rateForm.month_year}
                  onChange={(e) => setRateForm({ ...rateForm, month_year: e.target.value })}
                  className="input-field"
                  required
                  disabled={!!editingRate}
                />
              </div>
              <div>
                <label className="label">Electricity Rate (per kWh)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={rateForm.electricity_rate}
                  onChange={(e) => setRateForm({ ...rateForm, electricity_rate: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Water Bill</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateForm.water_rate}
                  onChange={(e) => setRateForm({ ...rateForm, water_rate: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">WiFi Bill</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateForm.wifi_rate}
                  onChange={(e) => setRateForm({ ...rateForm, wifi_rate: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRateModal(false)
                    setEditingRate(null)
                    resetRateForm()
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingRate ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Electric Readings Modal */}
      {showReadingModal && (
         <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end justify-center sm:items-center z-50">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full max-w-md sm:max-w-md mx-4 my-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              {editingReading ? 'Edit Electric Reading' : 'Add Electric Reading'}
            </h3>
            <form onSubmit={handleReadingSubmit} className="space-y-4">
              <div>
                <label className="label">Room</label>
                <select
                  value={readingForm.room_id}
                  onChange={(e) => setReadingForm({ ...readingForm, room_id: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select Room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Month/Year</label>
                <input
                  type="month"
                  value={readingForm.month_year}
                  onChange={(e) => setReadingForm({ ...readingForm, month_year: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Reading (kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  value={readingForm.reading}
                  onChange={(e) => setReadingForm({ ...readingForm, reading: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                {editingReading && (
                  <button
                    type="button"
                    onClick={() => handleDeleteReading(editingReading.id)}
                    className="btn-danger"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowReadingModal(false)
                    setEditingReading(null)
                    resetReadingForm()
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingReading ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
