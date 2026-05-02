import { useState } from 'react';

interface RatingWidgetProps {
  rating: number | null;
  onChange: (rating: number) => void;
  readonly?: boolean;
}

const STAR_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
  </svg>
);

export default function RatingWidget({ rating, onChange, readonly }: RatingWidgetProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const displayValue = hoverIndex ?? rating ?? 0;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={`transition-transform ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
            onClick={() => !readonly && onChange(star)}
            onMouseEnter={() => !readonly && setHoverIndex(star)}
            onMouseLeave={() => !readonly && setHoverIndex(null)}
          >
            {filled ? (
              <span className="text-indigo-500">{STAR_SVG}</span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6 text-gray-300">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" />
              </svg>
            )}
          </button>
        );
      })}
      <span className="ml-2 text-sm text-gray-600">
        {rating == null ? 'Rate this result' : `Your rating: ${rating}/5`}
      </span>
    </div>
  );
}
