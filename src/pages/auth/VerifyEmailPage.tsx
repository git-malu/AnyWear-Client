import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmSignUp } from 'aws-amplify/auth';
import { getErrorMessage } from '../../lib/errors';

export default function VerifyEmailPage() {
  const [code, setCode] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  
  const [isPending, setIsPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setAuthError(null);
    
    try {
      const { isSignUpComplete } = await confirmSignUp({
        username: email,
        confirmationCode: code
      });
      
      if (isSignUpComplete) {
        navigate('/login');
      }
    } catch (err) {
      setAuthError(getErrorMessage(err, 'Invalid verification code.'));
    } finally {
      setIsPending(false);
    }
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

        {authError ? (
          <div className="text-red-500 text-sm">
            {authError}
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
