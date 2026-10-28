import { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { readDemoAccounts, writeDemoAccounts } from './demoAccounts'
import type { DemoAccount, DemoOrder } from './demoAccounts'

type SupplierBooking = DemoOrder & {
  customerEmail: string
  customerName: string
  customerPhone: string
  customerAddress: string
  customerVillage: string
}

const nextStatus: Partial<Record<DemoOrder['status'], { value: DemoOrder['status']; label: string }>> = {
  pending: { value: 'accepted', label: 'Accept booking' },
  booked: { value: 'accepted', label: 'Accept booking' },
  accepted: { value: 'preparing_for_dispatch', label: 'Start preparing' },
  preparing_for_dispatch: { value: 'dispatched', label: 'Mark dispatched' },
  dispatched: { value: 'delivered', label: 'Mark delivered' },
}

const titleCase = (status: DemoOrder['status']) => status.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')

export default function SupplierBookingsPanel(_props: { tenantId?: string }) {
  const [bookings, setBookings] = useState<SupplierBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [busyBooking, setBusyBooking] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(() => {
    try {
      const accounts = readDemoAccounts()
      setBookings(accounts
        .filter(account => account.role === 'customer')
        .flatMap(account => account.orders.map(order => ({
          ...order,
          customerEmail: account.email,
          customerName: account.fullName,
          customerPhone: account.phone || '—',
          customerAddress: '',
          customerVillage: account.village || 'Village not listed',
        })))
        .sort((left, right) => new Date(right.bookedAt).getTime() - new Date(left.bookedAt).getTime()))
      setError('')
    } catch (reason) {
      setError(`Could not load local customer bookings: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = window.setInterval(refresh, 3000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  function advance(booking: SupplierBooking) {
    const next = nextStatus[booking.status]
    if (!next) return
    setBusyBooking(booking.id)
    setError('')
    setMessage('')
    try {
      const accounts: DemoAccount[] = readDemoAccounts()
      const customer = accounts.find(account => account.email === booking.customerEmail && account.role === 'customer')
      if (!customer || !customer.orders.some(order => order.id === booking.id)) {
        setError(`Could not update ${booking.id}: registered customer booking was not found.`)
        return
      }
      const updatedAccounts = accounts.map(account => account.email !== customer.email ? account : {
        ...account,
        orders: account.orders.map(order => order.id === booking.id ? { ...order, status: next.value } : order),
      })
      writeDemoAccounts(updatedAccounts)
      setMessage(`${booking.id} updated to ${titleCase(next.value)}.`)
      refresh()
    } catch (reason) {
      setError(`Could not update ${booking.id}: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setBusyBooking('')
    }
  }

  return <section className="panel supplier-bookings-panel">
    <div className="supplier-bookings-heading"><div><span className="customer-eyebrow">REGISTERED ACCOUNTS · LOCAL</span><h2>Incoming & pending bookings</h2><p>Customer bookings saved in this browser</p></div><button className="btn tiny secondary" onClick={refresh} disabled={loading}><RefreshCw size={14}/>Refresh</button></div>
    {error && <div className="customer-alert" role="alert">{error}</div>}
    {message && <div className="customer-success" role="status">{message}</div>}
    {loading ? <p className="supplier-bookings-empty">Loading bookings…</p> : bookings.length === 0 ? <p className="supplier-bookings-empty">No registered customer bookings have been placed yet.</p> : <div className="supplier-bookings-list">
      {bookings.map(booking => {
        const next = nextStatus[booking.status]
        return <article className="supplier-booking-row" key={`${booking.customerEmail}:${booking.id}`}>
          <div className="supplier-booking-primary"><span className="supplier-booking-id">{booking.id}</span><span className="customer-status">{titleCase(booking.status)}</span><b>{booking.gasProvider}</b></div>
          <div className="supplier-booking-details"><span><small>Customer</small><b>{booking.customerName}</b><a href={`mailto:${booking.customerEmail}`}>{booking.customerEmail}</a><a href={`tel:${booking.customerPhone}`}>{booking.customerPhone}</a></span><span><small>Fulfilment address</small><b>{booking.customerVillage}</b><span>{booking.customerAddress || 'Address not provided'}</span></span><span><small>Booking time</small><b>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(booking.bookedAt))}</b></span><span><small>Payment</small><b>Cash on Delivery (COD)</b><span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(booking.expectedAmount)}</span></span></div>
          {next && <button className="btn primary supplier-booking-action" disabled={busyBooking === booking.id} onClick={() => advance(booking)}>{busyBooking === booking.id ? 'Updating…' : next.label}<Check size={15}/></button>}
        </article>
      })}
    </div>}
    <p className="supplier-bookings-empty">Local demo accounts are stored in browser storage and do not provide server-side role security.</p>
  </section>
}
