interface StylePromptInputProps {
  value: string;
  onChange: (val: string) => void;
}

const MAX_LENGTH = 500;

export default function StylePromptInput({ value, onChange }: StylePromptInputProps) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_LENGTH}
        placeholder="e.g., Studio lighting, white background, editorial style"
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <p className="text-right text-xs text-gray-400 mt-1">{value.length}/{MAX_LENGTH}</p>
    </div>
  );
}
