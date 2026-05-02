export default function MirrorPageSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="mt-1 h-4 bg-gray-200 rounded w-64" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="h-6 bg-gray-200 rounded w-28 mb-4" />
          <div className="bg-gray-200 rounded-lg h-40" />
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="h-6 bg-gray-200 rounded w-36 mb-4" />
          <div className="bg-gray-200 rounded-lg h-40" />
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="h-10 bg-gray-200 rounded-md w-full" />
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="h-6 bg-gray-200 rounded w-20 mb-4" />
          <div className="h-10 bg-gray-200 rounded-md w-full" />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="h-6 bg-gray-200 rounded w-16 mb-4" />
        <div className="bg-gray-200 rounded-lg h-80" />
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="h-6 bg-gray-200 rounded w-20 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-48" />
      </div>
    </div>
  );
}
