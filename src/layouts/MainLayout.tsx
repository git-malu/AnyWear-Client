import { Outlet, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function MainLayout() {
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold">AnyWear</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/dashboard"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  to="/wardrobe"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Wardrobe
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={logout}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      
      {/* Mobile Bottom Navigation */}
      <div className="sm:hidden fixed bottom-0 w-full bg-white border-t border-gray-200">
        <div className="flex justify-around py-3">
          <Link to="/dashboard" className="text-gray-500 hover:text-gray-900">
            <span className="text-xs">Dashboard</span>
          </Link>
          <Link to="/wardrobe" className="text-gray-500 hover:text-gray-900">
            <span className="text-xs">Wardrobe</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
