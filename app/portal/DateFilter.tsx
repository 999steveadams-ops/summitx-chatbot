"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Date filter in mm/dd/yyyy, with a native date picker for convenience. */
export default function DateFilter({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState(false);

  function apply(next: string) {
    const v = next.trim();
    if (!v) {
      setInvalid(false);
      router.push("/portal");
      return;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    router.push(`/portal?date=${encodeURIComponent(v)}`);
  }

  // <input type="date"> gives yyyy-mm-dd; convert to mm/dd/yyyy.
  function onPick(iso: string) {
    if (!iso) return;
    const [y, m, d] = iso.split("-");
    const mdy = `${m}/${d}/${y}`;
    setValue(mdy);
    apply(mdy);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Filter by date
          </label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply(value);
            }}
            placeholder="mm/dd/yyyy"
            inputMode="numeric"
            className="w-40 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Or pick
          </label>
          <input
            type="date"
            onChange={(e) => onPick(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
          />
        </div>

        <button
          onClick={() => apply(value)}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Apply
        </button>

        {value && (
          <button
            onClick={() => {
              setValue("");
              apply("");
            }}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400"
          >
            Clear
          </button>
        )}
      </div>

      {invalid && (
        <p className="mt-2 text-sm text-red-600">Use the format mm/dd/yyyy.</p>
      )}
    </div>
  );
}
