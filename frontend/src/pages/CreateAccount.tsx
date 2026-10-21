import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Keep in sync with MIN_PASSWORD_LENGTH in backend/models.py (the server enforces it too).
const MIN_PASSWORD = 10

export default function CreateAccount() {
  const { user, signup } = useAuth()
  const navigate = useNavigate()
  // Only same-site paths, so a crafted link can't send people elsewhere after logging in.
  const next = useSearchParams()[0].get('next')
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const mismatch = form.confirm.length > 0 && form.password !== form.confirm

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`)
      return
    }
    if (form.password !== form.confirm) {
      setError("Passwords don't match.")
      return
    }
    setError(null)
    setBusy(true)
    try {
      await signup({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        password: form.password,
        confirm_password: form.confirm,
      })
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.')
      setForm((f) => ({ ...f, password: '', confirm: '' }))
    } finally {
      setBusy(false)
    }
  }

  if (user) {
    return (
      <div className="container page auth">
        <div className="auth__card">
          <p className="eyebrow">You're all set</p>
          <h1>Hi, {user.first_name}!</h1>
          <p className="muted">You're already logged in as {user.email}.</p>
          <Link to="/products" className="btn btn--primary btn--block">
            Start shopping
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container page auth">
      <form className="auth__card" onSubmit={handleSubmit}>
        <p className="eyebrow">Join Campus Customs</p>
        <h1>Create account</h1>

        <div className="field-row">
          <label className="field">
            <span>First name</span>
            <input
              autoComplete="given-name"
              required
              maxLength={50}
              value={form.firstName}
              onChange={update('firstName')}
            />
          </label>
          <label className="field">
            <span>Last name</span>
            <input
              autoComplete="family-name"
              required
              maxLength={50}
              value={form.lastName}
              onChange={update('lastName')}
            />
          </label>
        </div>

        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={form.email} onChange={update('email')} />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            maxLength={128}
            aria-describedby="password-hint"
            value={form.password}
            onChange={update('password')}
          />
          <small id="password-hint" className="muted">
            At least {MIN_PASSWORD} characters. A short phrase is easy to remember and hard to guess.
          </small>
        </label>

        <label className="field">
          <span>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
            aria-invalid={mismatch}
            aria-describedby="confirm-hint"
            value={form.confirm}
            onChange={update('confirm')}
          />
          {mismatch && (
            <small id="confirm-hint" className="field__error">
              Passwords don't match yet.
            </small>
          )}
        </label>

        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--block" disabled={busy || mismatch}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted auth__switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
