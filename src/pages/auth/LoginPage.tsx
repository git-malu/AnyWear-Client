import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn, fetchAuthSession, signOut } from 'aws-amplify/auth';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../lib/errors';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  
  // Ensure Amplify is signed out if we are on the login page
  // This prevents "There is already a signed in user" error if local state was cleared but Amplify wasn't
  useEffect(() => {
    signOut().catch(() => {
      // Ignore errors if no user was signed in
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setAuthError(null);
    
    try {
      const { isSignedIn, nextStep } = await signIn({
        username: email,
        password,
      });

      if (isSignedIn) {
        // 1. Get the session to extract the JWT Access Token
        const session = await fetchAuthSession();
        const token = session.tokens?.accessToken?.toString();
        
        if (token) {
          // 2. Set authenticated in Zustand store
          // This will trigger the ProtectedRoute in App.tsx to mount and fetch the profile
          setAuthenticated(true);
          
          // 3. Redirect to dashboard
          navigate('/dashboard');
        } else {
          setAuthError('Authentication successful, but could not retrieve session tokens.');
        }
      } else if (nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        navigate(`/verify?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      // If we still get the already signed in error despite the useEffect, try one more time
      if (getErrorMessage(err, '') === 'There is already a signed in user.') {
        try {
          await signOut();
          const retryResult = await signIn({ username: email, password });
          if (retryResult.isSignedIn) {
            const session = await fetchAuthSession();
            const token = session.tokens?.accessToken?.toString();
            if (token) {
              setAuthenticated(true);
              navigate('/dashboard');
              return;
            }
          } else if (retryResult.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
            navigate(`/verify?email=${encodeURIComponent(email)}`);
            return;
          }
        } catch (retryErr) {
          setAuthError(getErrorMessage(retryErr, 'Invalid email or password.'));
        }
      } else {
        setAuthError(getErrorMessage(err, 'Invalid email or password.'));
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-indigo-700">Your personal wardrobe</p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight leading-6 text-gray-900">Sign in</h3>
        <p className="mt-1 text-sm text-gray-500">Welcome back to AnyWear</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">Password</label>
          <div className="relative mt-1">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pr-10 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
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
