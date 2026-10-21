import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()
  // Only same-site paths, so a crafted link can't send people elsewhere after logging in.
  const next = useSearchParams()[0].get('next')
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log you in.')
    } finally {
      setPassword('')
      setBusy(false)
    }
  }

  if (user) {
    return (
      <div className="container page auth">
        <div className="auth__card">
          <p className="eyebrow">Welcome back</p>
          <h1>Hi, {user.first_name}!</h1>
          <p className="muted">You're logged in as {user.email}.</p>
          <Link to="/products" className="btn btn--primary btn--block">
            Keep shopping
          </Link>
          <button className="btn btn--ghost btn--block" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container page auth">
      <form className="auth__card" onSubmit={handleSubmit}>
        <p className="eyebrow">Welcome back</p>
        <h1>Log in</h1>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="muted auth__switch">
          New here? <Link to={next ? `/create-account?next=${encodeURIComponent(destination)}` : '/create-account'}>Create an account</Link>
        </p>
      </form>
    </div>
  )
}
