import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LockKeyhole, Store, UserRound } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/common/Toast';
import { useAuth } from '../contexts/AuthContext';
import { isEmail } from '../utils/validators';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [values, setValues] = useState({ username: '', email: '', password: '', role: 'customer' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!values.username.trim()) {
      setError('Enter your name or business name.');
      return;
    }
    if (!isEmail(values.email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (values.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    await login(values);
    setLoading(false);
    navigate(values.role === 'seller' ? '/dashboard' : '/products');
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <Link to="/" className="flex items-center gap-3 font-semibold text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-sm text-white">F</span>
          <span>Farm2Homez</span>
        </Link>
        <div className="mt-8">
          <LockKeyhole className="h-6 w-6 text-accent" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-semibold text-ink">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Continue as a customer or seller.</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { value: 'customer', label: 'Customer', icon: UserRound },
            { value: 'seller', label: 'Seller', icon: Store },
          ].map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setValues((current) => ({ ...current, role: option.value }))}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-semibold transition ${
                  values.role === option.value ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:bg-surface'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <Toast type="error" message={error} />
          <Input id="username" name="username" label={values.role === 'seller' ? 'Business name' : 'Name'} value={values.username} onChange={updateField} autoComplete="name" required />
          <Input id="email" name="email" label="Email" type="email" value={values.email} onChange={updateField} autoComplete="email" required />
          <Input id="password" name="password" label="Password" value={values.password} onChange={updateField} type="password" autoComplete="current-password" required />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : values.role === 'seller' ? 'Enter seller dashboard' : 'Continue shopping'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
