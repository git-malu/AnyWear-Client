import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePostAuthVerify } from '../../api/endpoints/auth/auth';

export default function VerifyEmailPage() {
  const [code, setCode] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  const { mutate: verify, isPending, error } = usePostAuthVerify();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verify(
      { data: { email, code } },
      {
        onSuccess: () => {
          navigate('/login');
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Verify your email</h3>
        <p className="mt-1 text-sm text-gray-500">
          We sent a 6-digit code to {email}. Enter it below to verify your account.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Verification Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        {error ? (
          <div className="text-red-500 text-sm">
            Invalid verification code.
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isPending ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  );
}
