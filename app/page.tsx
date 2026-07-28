import Link from "next/link";

const steps = [
  {
    title: "Add a client",
    body: "Create a tenant with their business name, a custom system prompt, and a brand color.",
  },
  {
    title: "Copy the snippet",
    body: "Each client gets a one-line <script> embed tag generated automatically.",
  },
  {
    title: "Ship the widget",
    body: "Paste it on their site. A branded AI chat bubble goes live instantly — powered by Gemini.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white text-zinc-900">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            SX
          </span>
          SummitX&nbsp;ChatBot
        </div>
        <Link
          href="/admin"
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          Admin dashboard
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
        <section className="flex flex-col items-center gap-6 py-20 text-center">
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1 text-sm font-medium text-indigo-700">
            Multi-tenant · Gemini-powered · One script tag
          </span>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Branded AI chat widgets for every client you manage.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-zinc-600">
            Spin up a custom-trained chatbot per client in seconds. Set their prompt,
            match their brand, and hand them a single embed snippet. You keep control of
            the prompts — visitors just chat.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/admin"
              className="rounded-full bg-indigo-600 px-7 py-3 text-base font-semibold text-white transition hover:bg-indigo-500"
            >
              Open the dashboard
            </Link>
            <a
              href="#how"
              className="rounded-full border border-zinc-300 px-7 py-3 text-base font-semibold text-zinc-800 transition hover:border-zinc-400"
            >
              How it works
            </a>
          </div>
        </section>

        <section id="how" className="grid gap-6 pb-24 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
            >
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {i + 1}
              </div>
              <h3 className="mb-1 text-lg font-semibold">{s.title}</h3>
              <p className="text-sm leading-6 text-zinc-600">{s.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500">
        SummitX ChatBot — internal micro-SaaS.
      </footer>
    </div>
  );
}
