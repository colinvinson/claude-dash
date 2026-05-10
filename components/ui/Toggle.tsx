"use client";

interface Props {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

export default function Toggle({ options, value, onChange }: Props) {
  return (
    <div className="flex bg-zinc-800 rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 text-xs font-semibold py-1.5 px-3 rounded-md transition-all ${
            value === opt
              ? "bg-zinc-600 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
