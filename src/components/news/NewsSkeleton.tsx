interface NewsSkeletonProps {
  count?: number;
}

export default function NewsSkeleton({ count = 6 }: NewsSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200"
        >
          {/* Image placeholder */}
          <div className="aspect-w-16 aspect-h-9 animate-pulse bg-gray-200" />
          {/* Content placeholder */}
          <div className="p-3 space-y-2.5">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
            <div className="flex items-center justify-between pt-1">
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3" />
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
