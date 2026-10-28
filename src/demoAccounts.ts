export type DemoRole = 'customer' | 'supplier'
export type DemoOrder = {
  id: string
  bookedAt: string
  status: 'pending' | 'booked' | 'accepted' | 'preparing_for_dispatch' | 'assigned' | 'dispatched' | 'delivered' | 'cancelled'
  expectedAmount: number
  expectedDeliveryAt: string | null
  paymentMethod: 'cash_on_delivery'
  gasProvider: 'Indane' | 'HP Gas' | 'Bharatgas'
}

export type DemoAccount = {
  email: string
  role: DemoRole
  fullName: string
  phone: string
  village: string
  customerId: string
  orders: DemoOrder[]
  passwordSalt: string
  passwordHash: string
}

const accountsKey = 'blueflame:demo-accounts'

export function readDemoAccounts(): DemoAccount[] {
  const saved = localStorage.getItem(accountsKey)
  if (!saved) return []
  try {
    const accounts: unknown = JSON.parse(saved)
    if (!Array.isArray(accounts)) throw new Error('Stored demo accounts are not a list.')
    return accounts.map(value => {
      if (!value || typeof value !== 'object') throw new Error('A stored demo account is invalid.')
      const account = value as DemoAccount
      return {
        ...account,
        orders: Array.isArray(account.orders)
          ? account.orders.map(order => ({ ...order, gasProvider: order.gasProvider ?? 'Indane' }))
          : [],
      }
    })
  } catch (error) {
    throw new Error(`Could not read local demo accounts: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function writeDemoAccounts(accounts: DemoAccount[]) {
  localStorage.setItem(accountsKey, JSON.stringify(accounts))
}

export function setDemoSession(email: string | null) {
  if (email) localStorage.setItem('blueflame:demo-session', email)
  else localStorage.removeItem('blueflame:demo-session')
}

export function makeCustomerId() {
  return `C-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

export function makeBookingId() {
  return `BK-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

export async function hashDemoPassword(password: string, salt: string) {
  if (!crypto.subtle) throw new Error('Password hashing is unavailable in this browser context. Open the app on localhost or HTTPS.')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), char => char.charCodeAt(0)), iterations: 120_000 },
    key,
    256,
  )
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}
