import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePostAuthRegister } from '../../api/endpoints/auth/auth';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { mutate: register, isPending, error } = usePostAuthRegister();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register(
      { data: { email, password } },
      {
        onSuccess: () => {
          navigate(`/verify?email=${encodeURIComponent(email)}`);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Create an account</h3>
        <p className="mt-1 text-sm text-gray-500">
          Sign up to manage your wardrobe and get AI styling recommendations.
        </p>
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
            {(error as any).response?.data?.message || (error as any).response?.data?.error || (error as any).message || 'Failed to register. Please check your details.'}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isPending ? 'Signing up...' : 'Sign up'}
        </button>
      </form>
      <div className="text-sm text-center">
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          Already have an account? Log in
        </Link>
      </div>
    </div>
  );
}
