import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePostAuthLogin } from '../../api/endpoints/auth/auth';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);
  const { mutate: login, isPending, error } = usePostAuthLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(
      { data: { email, password } },
      {
        onSuccess: (res: any) => {
          if (res.accessToken) {
            setToken(res.accessToken);
            navigate('/dashboard');
          } else if (res.data?.accessToken) {
            setToken(res.data.accessToken);
            navigate('/dashboard');
          }
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Sign in</h3>
        <p className="mt-1 text-sm text-gray-500">Welcome back to AnyWear</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        {error ? (
          <div className="text-red-500 text-sm">
            Invalid email or password.
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isPending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <div className="text-sm text-center">
        <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
          Don't have an account? Sign up
        </Link>
      </div>
    </div>
  );
}
