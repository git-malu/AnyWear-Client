import WeatherWidget from '../../components/dashboard/WeatherWidget';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Weather Widget — top of dashboard */}
      <WeatherWidget />

      {/* Existing dashboard content */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-5 sm:px-6">
          <p className="text-sm font-medium text-indigo-700">A little more prepared</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">Today</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Weather and clothing guidance for your day.
          </p>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-gray-700">Your wardrobe is ready for what comes next.</p>
          <Link to="/wardrobe" className="inline-flex w-fit items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2">Explore your wardrobe</Link>
        </div>
      </div>
    </div>
  );
}
