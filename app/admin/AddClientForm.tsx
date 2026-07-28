"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createTenant } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
    >
      {pending ? "Adding…" : "Add client"}
    </button>
  );
}

export default function AddClientForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [color, setColor] = useState("#4f46e5");

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createTenant(formData);
        formRef.current?.reset();
        setColor("#4f46e5");
      }}
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-semibold">Add a client</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Business name
          </label>
          <input
            name="business_name"
            required
            placeholder="Acme Coffee Co."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="sm:col-span-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Brand color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="brand_color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-zinc-300 bg-white"
              aria-label="Brand color"
            />
            <span className="font-mono text-sm text-zinc-500">{color}</span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            System prompt{" "}
            <span className="font-normal text-zinc-400">
              (how the assistant should behave — leave blank for a sensible default)
            </span>
          </label>
          <textarea
            name="system_prompt"
            rows={3}
            placeholder="You are the assistant for Acme Coffee Co. Help visitors with menu, hours, and orders. Keep answers short and friendly."
            className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
