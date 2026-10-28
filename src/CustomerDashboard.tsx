import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Flame, LogOut, MapPin, Package, Truck, Wallet, X } from 'lucide-react'
import { readDemoAccounts, writeDemoAccounts } from './demoAccounts'
import type { DemoAccount, DemoOrder } from './demoAccounts'

const trackerSteps = ['Village', 'LPG Distributor/Warehouse', 'Dispatch', 'In Transit', "Customer's Village", 'Delivered']
const progress: Record<DemoOrder['status'], number> = {
  pending: 0,
  booked: 0,
  accepted: 1,
  assigned: 1,
  preparing_for_dispatch: 2,
  dispatched: 3,
  delivered: 5,
  cancelled: -1,
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled yet'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not scheduled yet' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function displayStatus(status: DemoOrder['status']) {
  return status.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
}

function CustomerTracker({ booking }: { booking: DemoOrder }) {
  const activeStep = progress[booking.status]
  return <div className="delivery-tracker" aria-label={`Delivery progress for ${booking.id}`}>
    {trackerSteps.map((step, index) => {
      const complete = activeStep >= 0 && index <= activeStep
      const current = index === activeStep
      return <div className={`tracker-step${complete ? ' complete' : ''}${current ? ' current' : ''}`} key={step}>
        <span className="tracker-node">{complete ? <Check size={14}/> : index === 3 ? <Truck size={14}/> : index === 0 || index === 4 ? <MapPin size={14}/> : <Package size={14}/>}</span>
        <span className="tracker-label">{step}</span>
        {index < trackerSteps.length - 1 && <span className="tracker-connector"/>}
      </div>
    })}
  </div>
}

export default function CustomerDashboard({ account: initialAccount, onSignOut }: { account: DemoAccount; onSignOut: () => void }) {
  const [account, setAccount] = useState(initialAccount)
  const [saving, setSaving] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<DemoOrder | null>(null)
  const bookings = account.orders

  function refreshAccount() {
    try {
      const latest = readDemoAccounts().find(item => item.email === account.email && item.role === 'customer')
      if (latest) setAccount(latest)
    } catch (reason) {
      setError(`Could not load your local bookings: ${reason instanceof Error ? reason.message : String(reason)}`)
    }
  }

  useEffect(() => {
    const interval = window.setInterval(refreshAccount, 3000)
    window.addEventListener('focus', refreshAccount)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshAccount)
    }
  }, [account.email])

  const currentBooking = useMemo(() => bookings.find(booking => !['delivered', 'cancelled'].includes(booking.status)) ?? null, [bookings])
  const lastOrder = useMemo(() => bookings.find(booking => booking.status === 'delivered') ?? null, [bookings])

  function createBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    setSuccess(null)

    try {
      const form = new FormData(event.currentTarget)
      const bookingId = String(form.get('bookingId')).trim()
      const gasProvider = String(form.get('gasProvider'))
      const paymentMethod = String(form.get('paymentMethod'))
      if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/.test(bookingId)) {
        setError('Enter a booking ID using 3–40 letters, numbers, or hyphens.')
        return
      }
      if (!['Indane', 'HP Gas', 'Bharatgas'].includes(gasProvider) || paymentMethod !== 'cash_on_delivery') {
        setError('Choose a listed gas provider and Cash on Delivery.')
        return
      }

      const accounts = readDemoAccounts()
      if (accounts.some(item => item.orders.some(order => order.id.toLowerCase() === bookingId.toLowerCase()))) {
        setError('That booking ID already exists. Enter a different booking ID.')
        return
      }
      const savedAccount = accounts.find(item => item.email === account.email && item.role === 'customer')
      if (!savedAccount) {
        setError('Your registered account could not be found in this browser. Sign in again before booking.')
        return
      }

      const booking: DemoOrder = {
        id: bookingId,
        bookedAt: new Date().toISOString(),
        status: 'booked',
        expectedAmount: 950,
        expectedDeliveryAt: null,
        paymentMethod: 'cash_on_delivery',
        gasProvider: gasProvider as DemoOrder['gasProvider'],
      }
      const updatedAccount = { ...savedAccount, orders: [booking, ...savedAccount.orders] }
      writeDemoAccounts(accounts.map(item => item.email === updatedAccount.email ? updatedAccount : item))
      setAccount(updatedAccount)
      setBookingOpen(false)
      setSuccess(booking)
    } catch (reason) {
      setError(`Booking could not be saved in this browser: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setSaving(false)
    }
  }

  const activeCount = bookings.filter(booking => !['delivered', 'cancelled'].includes(booking.status)).length

  return <main className="customer-shell">
    <header className="customer-topbar"><div className="portal-brand"><span className="brand-mark"><Flame size={21} fill="currentColor"/></span><span><b>BLUE FLAME</b><small>CUSTOMER PORTAL · LOCAL MODE</small></span></div><div className="customer-account"><span>{account.email}</span><button className="btn secondary" onClick={onSignOut}><LogOut size={15}/>Sign out</button></div></header>
    <div className="customer-content">
      <div className="customer-welcome"><div><span className="customer-eyebrow">CUSTOMER DASHBOARD</span><h1>Hello, {account.fullName}</h1><p>Your registered profile and bookings saved in this browser.</p></div><button className="btn primary book-now" onClick={() => { setError(''); setBookingOpen(true) }}><Package size={17}/>Book Now</button></div>
      <div className="supplier-demo-notice"><b>Local demo mode.</b> This profile and its bookings are stored in this browser and are not synced with a server.</div>
      {error && <div className="customer-alert" role="alert">{error}</div>}
      {notice && <div className="customer-success" role="status">{notice}</div>}
      {success && <div className="booking-success" role="status">
        <button className="booking-success-close" aria-label="Dismiss booking notification" onClick={() => setSuccess(null)}><X size={17}/></button>
        <strong>Booking Successful! Your LPG cylinder booking has been placed.</strong>
        <div><span>Booking ID<b>{success.id}</b></span><span>Gas provider<b>{success.gasProvider}</b></span><span>Payment method<b>Cash on Delivery</b></span><span>Booking status<b>{displayStatus(success.status)}</b></span></div>
      </div>}
      <>
        <section className="customer-profile-card">
          <div className="customer-profile-avatar">{account.fullName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</div>
          <div className="customer-profile-main"><span className="customer-eyebrow">YOUR PROFILE</span><h2>{account.fullName}</h2><p>{account.phone} <span>·</span> {account.village}</p></div>
          <div className="customer-identifiers"><span>Customer ID<b>{account.customerId}</b></span><span>Registered phone<b>{account.phone}</b></span></div>
        </section>
        <section className="customer-summary-grid">
          <article className="customer-summary-card"><span className="summary-icon blue"><Package size={18}/></span><span>Current order<b>{currentBooking?.id ?? 'No active order'}</b></span><small>{currentBooking ? displayStatus(currentBooking.status) : 'You are all caught up'}</small></article>
          <article className="customer-summary-card"><span className="summary-icon teal"><Check size={18}/></span><span>Last order<b>{lastOrder?.id ?? 'No completed orders'}</b></span><small>{lastOrder ? formatDate(lastOrder.bookedAt) : 'Completed orders will appear here'}</small></article>
          <article className="customer-summary-card"><span className="summary-icon amber"><Truck size={18}/></span><span>Active bookings<b>{activeCount}</b></span><small>{currentBooking ? `Expected ${formatDate(currentBooking.expectedDeliveryAt)}` : 'No delivery in progress'}</small></article>
        </section>
        {currentBooking && <section className="customer-order-card">
          <div className="customer-section-heading"><div><span className="customer-eyebrow">CURRENT ORDER</span><h2>Booking {currentBooking.id}</h2></div><span className="customer-status">{displayStatus(currentBooking.status)}</span></div>
          <div className="customer-order-facts"><span>Gas provider<b>{currentBooking.gasProvider}</b></span><span>Booking date<b>{formatDate(currentBooking.bookedAt)}</b></span><span>Expected delivery<b>{formatDate(currentBooking.expectedDeliveryAt)}</b></span><span>Payment method<b>Cash on Delivery</b></span></div>
          <div className="customer-tracker-heading"><div><h3>LPG delivery tracking</h3><p>Follow your order from the distributor to your village.</p></div><Truck size={19}/></div>
          <CustomerTracker booking={currentBooking}/>
          <button className="btn primary customer-pay" onClick={() => setNotice('Cash on Delivery is selected. Payment will be collected when the order arrives.')}><Wallet size={16}/>Pay · Cash on Delivery</button>
        </section>}
        <section className="customer-order-list">
          <div className="customer-section-heading"><div><span className="customer-eyebrow">ORDER HISTORY</span><h2>Your orders</h2></div></div>
          {bookings.length === 0 ? <p className="customer-empty-inline">No bookings are linked to your account yet. Select Book Now to place your first booking.</p> : bookings.map(booking => <article className="customer-history-row" key={booking.id}><div><b>{booking.id}</b><small>{booking.gasProvider} · Booked {formatDate(booking.bookedAt)}</small></div><span className="customer-status">{displayStatus(booking.status)}</span><b>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(booking.expectedAmount)}</b></article>)}
        </section>
      </>
    </div>
    {bookingOpen && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setBookingOpen(false)}><section className="modal booking-modal"><header><div><h2>Book an LPG cylinder</h2><p>Booking for {account.fullName}</p></div><button className="icon-btn" onClick={() => setBookingOpen(false)} aria-label="Close booking form"><X size={18}/></button></header><form className="form-grid" onSubmit={createBooking}>
      <label>Gas Provider<select name="gasProvider" required defaultValue="Indane"><option>Indane</option><option>HP Gas</option><option>Bharatgas</option></select></label>
      <label>Booking ID<input name="bookingId" required minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,39}" title="Enter 3–40 letters, numbers, or hyphens." placeholder="e.g. BK-2026-1043"/></label>
      <label>Payment Method<select name="paymentMethod" required defaultValue="cash_on_delivery"><option value="cash_on_delivery">Cash on Delivery (COD)</option></select></label>
      {error && <div className="customer-alert" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="btn secondary" onClick={() => setBookingOpen(false)}>Cancel</button><button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving booking…' : 'Confirm Booking'}</button></div>
    </form></section></div>}
  </main>
}
