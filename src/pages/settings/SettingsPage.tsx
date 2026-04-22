import { useState, useCallback } from 'react';
import { useGetUsersMe, usePutUsersProfile } from '../../api/endpoints/users/users';
import { useGetWeatherCityLookup, useGetWeatherTopCities } from '../../api/endpoints/weather/weather';
import { useQueryClient } from '@tanstack/react-query';
import { getGetWeatherCurrentQueryKey } from '../../api/endpoints/weather/weather';
import type { GetWeatherCityLookup200LocationsItem } from '../../api/model';

export default function SettingsPage() {
  const { data: user } = useGetUsersMe();
  const updateProfile = usePutUsersProfile();
  const queryClient = useQueryClient();

  const { data: topCities } = useGetWeatherTopCities({
    query: {
      staleTime: Infinity, // These don't change often
    },
  });

  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [geoError, setGeoError] = useState('');

  // City search state
  const [cityQuery, setCityQuery] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const { data: cityResults, isLoading: cityLoading } = useGetWeatherCityLookup(
    { q: cityQuery },
    {
      query: {
        enabled: searchEnabled && cityQuery.length >= 2,
        staleTime: 30_000,
      },
    },
  );

  const invalidateWeather = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetWeatherCurrentQueryKey() });
  }, [queryClient]);

  // --- Device Geolocation (Primary) ---
  function handleAutoDetect() {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoError('Geolocation is not supported by your device.');
      return;
    }

    setGeoStatus('loading');
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateProfile.mutate(
          {
            data: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          },
          {
            onSuccess: () => {
              setGeoStatus('success');
              invalidateWeather();
              // Refetch user profile to update displayed location
              queryClient.invalidateQueries({ queryKey: ['/users/me'] });
            },
            onError: () => {
              setGeoStatus('error');
              setGeoError('Failed to update location on server.');
            },
          },
        );
      },
      (err) => {
        setGeoStatus('error');
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please use the city search below instead.'
            : 'Could not determine your location. Please use the city search below.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // --- Manual City Search (Fallback) ---
  function handleCitySearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchEnabled(true);
  }

  function handleSelectCity(city: GetWeatherCityLookup200LocationsItem) {
    updateProfile.mutate(
      {
        data: {
          locationId: city.id,
          locationName: `${city.name}, ${city.adm1}`,
          latitude: parseFloat(city.lat),
          longitude: parseFloat(city.lon),
        },
      },
      {
        onSuccess: () => {
          setCityQuery('');
          setSearchEnabled(false);
          invalidateWeather();
          queryClient.invalidateQueries({ queryKey: ['/users/me'] });
        },
      },
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Location Settings</h2>

        {/* Current location display */}
        {user?.locationName && (
          <p className="text-sm text-gray-600 mb-4">
            Current location: <span className="font-medium text-gray-900">{user.locationName}</span>
          </p>
        )}

        {/* Auto-detect button */}
        <div className="mb-6">
          <button
            onClick={handleAutoDetect}
            disabled={geoStatus === 'loading' || updateProfile.isPending}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {geoStatus === 'loading' ? 'Detecting...' : 'Auto-Detect My Location'}
          </button>
          {geoStatus === 'success' && (
            <p className="mt-2 text-sm text-green-600">Location updated successfully.</p>
          )}
          {geoStatus === 'error' && (
            <p className="mt-2 text-sm text-red-500">{geoError}</p>
          )}
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or search manually</span>
          </div>
        </div>

        {/* Top Cities Quick Select */}
        {topCities?.locations && topCities.locations.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Popular Cities
            </p>
            <div className="flex flex-wrap gap-2">
              {topCities.locations.slice(0, 10).map((city) => (
                <button
                  key={city.id}
                  onClick={() => handleSelectCity(city)}
                  disabled={updateProfile.isPending}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hover:bg-blue-100 hover:text-blue-800 transition-colors border border-gray-200 disabled:opacity-50"
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* City search form */}
        <form onSubmit={handleCitySearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              setSearchEnabled(false);
            }}
            placeholder="Search for a city..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={cityQuery.length < 2}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50"
          >
            Search
          </button>
        </form>

        {/* City results */}
        {cityLoading && (
          <p className="text-sm text-gray-400">Searching...</p>
        )}
        {cityResults?.locations && cityResults.locations.length > 0 && (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md max-h-60 overflow-y-auto">
            {cityResults.locations.map((city) => (
              <li key={city.id}>
                <button
                  onClick={() => handleSelectCity(city)}
                  disabled={updateProfile.isPending}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm transition-colors disabled:opacity-50"
                >
                  <span className="font-medium text-gray-900">{city.name}</span>
                  <span className="text-gray-500 ml-1">
                    {city.adm1}, {city.country}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searchEnabled && cityResults?.locations?.length === 0 && (
          <p className="text-sm text-gray-400">No cities found. Try a different search.</p>
        )}
      </div>
    </div>
  );
}
