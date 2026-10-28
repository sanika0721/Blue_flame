import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Flame, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import CustomerDashboard from './CustomerDashboard'
import { SupplierERP } from './App'
import { hashDemoPassword, makeCustomerId, readDemoAccounts, setDemoSession, writeDemoAccounts } from './demoAccounts'
import type { DemoAccount, DemoRole } from './demoAccounts'

export default function Portal() {
  const [portal, setPortal] = useState<DemoRole>(() => localStorage.getItem('blueflame:portal') === 'supplier' ? 'supplier' : 'customer')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [account, setAccount] = useState<DemoAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    try {
      const email = localStorage.getItem('blueflame:demo-session')
      if (email) {
        const savedAccount = readDemoAccounts().find(item => item.email === email)
        if (savedAccount) {
          setPortal(savedAccount.role)
          setAccount(savedAccount)
        } else {
          setDemoSession(null)
        }
      }
    } catch (reason) {
      setError(`Could not restore your local account: ${reason instanceof Error ? reason.message : String(reason)}`)
    }
    setLoading(false)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email')).trim().toLowerCase()
    const password = String(form.get('password'))

    try {
      const accounts = readDemoAccounts()
      if (mode === 'login') {
        const existing = accounts.find(item => item.email === email && item.role === portal)
        if (!existing || await hashDemoPassword(password, existing.passwordSalt) !== existing.passwordHash) {
          setError(`No matching ${portal} account was found. Check your email and password or register first.`)
          return
        }
        setDemoSession(existing.email)
        localStorage.setItem('blueflame:portal', existing.role)
        setAccount(existing)
        return
      }

      const fullName = String(form.get('fullName')).trim()
      const phone = String(form.get('phone') ?? '').trim()
      const village = String(form.get('village') ?? '').trim()
      if (accounts.some(item => item.email === email)) {
        setError('An account with this email is already registered. Choose Login instead.')
        return
      }
      if (!fullName || portal === 'customer' && (!phone || !village)) {
        setError('Enter your name and complete all required customer details.')
        return
      }

      const saltBytes = crypto.getRandomValues(new Uint8Array(16))
      const passwordSalt = btoa(String.fromCharCode(...saltBytes))
      const nextAccount: DemoAccount = {
        email,
        role: portal,
        fullName,
        phone,
        village,
        customerId: portal === 'customer' ? makeCustomerId() : '',
        orders: [],
        passwordSalt,
        passwordHash: await hashDemoPassword(password, passwordSalt),
      }
      const updatedAccounts = [...accounts, nextAccount]
      writeDemoAccounts(updatedAccounts)
      setDemoSession(email)
      localStorage.setItem('blueflame:portal', portal)
      setAccount(nextAccount)
    } catch (reason) {
      setError(`Could not complete local account sign-in: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  function signOut() {
    setDemoSession(null)
    setAccount(null)
    setError('')
    setNotice('')
  }

  if (loading) return <main className="portal-loading"><div className="brand-mark"><Flame size={21}/></div><p>Loading your account…</p></main>

  if (account) {
    return account.role === 'customer'
      ? <CustomerDashboard account={account} onSignOut={signOut}/>
      : <SupplierERP email={account.email} onSignOut={signOut}/>
  }

  return <main className="portal-shell">
    <section className="portal-card">
      <div className="portal-brand"><span className="brand-mark"><Flame size={22} fill="currentColor"/></span><span><b>BLUE FLAME</b><small>LPG DISTRIBUTION</small></span></div>
      <div className="portal-heading"><span className="portal-icon"><LockKeyhole size={20}/></span><h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p>Use an account registered in this browser.</p></div>
      <div className="portal-tabs" aria-label="Choose account type">
        <button type="button" className={portal === 'customer' ? 'selected' : ''} onClick={() => { setPortal('customer'); localStorage.setItem('blueflame:portal', 'customer'); setError('') }}><UserRound size={16}/>Customer</button>
        <button type="button" className={portal === 'supplier' ? 'selected' : ''} onClick={() => { setPortal('supplier'); localStorage.setItem('blueflame:portal', 'supplier'); setError('') }}><ShieldCheck size={16}/>Supplier</button>
      </div>
      <div className="auth-mode-tabs" aria-label="Choose sign-in mode">
        <button type="button" className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError('') }}>Login</button>
        <button type="button" className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError('') }}>Register</button>
      </div>
      <form className="portal-form" onSubmit={event => void submit(event)}>
        {mode === 'register' && <>
          <label>Full name<input name="fullName" autoComplete="name" required/></label>
          {portal === 'customer' && <><label>Phone number<input name="phone" type="tel" autoComplete="tel" required/></label><label>Village<input name="village" autoComplete="address-level2" required/></label></>}
        </>}
        <label>Email address<input name="email" type="email" autoComplete="username" required/></label>
        <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required/></label>
        {error && <div role="alert" className="portal-error">{error}</div>}
        {notice && <div role="status" className="portal-notice">{notice}</div>}
        <button className="btn primary portal-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : `${mode === 'login' ? 'Login' : 'Register'} as ${portal}`}<ArrowRight size={16}/></button>
      </form>
      <div className="auth-divider"><span>or</span></div>
      <button className="google-login" type="button" onClick={() => setNotice('Google sign-in is not connected in local mode. Register or log in with your email and password.')}><span className="google-mark">G</span>Continue with Google</button>
      <p className="portal-footnote">Local demo accounts and bookings are stored in this browser only. They are not shared across browsers or devices and are not secure for real customer data.</p>
    </section>
  </main>
}
