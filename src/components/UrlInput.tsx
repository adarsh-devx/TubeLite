import { Link, X } from "lucide-react";

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

const UrlInput = ({
  value,
  onChange,
  onClear,
  placeholder = "Paste YouTube link here...",
}: UrlInputProps) => {
  return (
    <div className="w-full bg-bg-card rounded-2xl flex items-center px-4 h-[56px] min-w-0">
      <Link className="w-5 h-5 text-text-secondary shrink-0" strokeWidth={2} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-text-primary text-[15px] ml-3 placeholder:text-text-secondary focus:outline-none"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {value.length > 0 && (
        <button
          onClick={onClear}
          className="shrink-0 p-1 -mr-1"
          aria-label="Clear URL"
        >
          <X className="w-4 h-4 text-text-secondary" />
        </button>
      )}
    </div>
  );
};

export default UrlInput;
