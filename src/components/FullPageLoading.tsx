export default function FullPageLoading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-50 z-50">
      <div className="relative">
        {/* Outer Spinner */}
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
      <h2 className="mt-4 text-xl font-semibold text-gray-700">AnyWear</h2>
      <p className="mt-2 text-sm text-gray-500 animate-pulse">Setting up your wardrobe...</p>
    </div>
  );
}
