"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const DEFAULT_GREETING = "👋 Hi! How can I help you today?";

/**
 * Assistant replies come back as Markdown. Render a deliberately small subset so
 * the bubble stays compact and nothing can inject raw HTML (react-markdown does
 * not use dangerouslySetInnerHTML, and we render no `html` nodes).
 */
function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 [&_a]:underline [&_li]:ml-4 [&_li]:list-disc">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="space-y-1">{children}</ul>,
          ol: ({ children }) => (
            <ol className="space-y-1 [&_li]:list-decimal">{children}</ol>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-black/10 px-1 py-0.5 text-[12px]">{children}</code>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

export default function ChatWidget({
  tenantId,
  businessName,
  brandColor,
  logoUrl,
  greeting,
  starterQuestions,
}: {
  tenantId: string;
  businessName: string;
  brandColor: string;
  logoUrl: string | null;
  greeting: string | null;
  starterQuestions: string[];
}) {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  const [showLead, setShowLead] = useState(false);
  const [leadDone, setLeadDone] = useState(false);

  // One conversation per browser tab/session; visitorId persists across visits.
  const [ids] = useState(() => {
    if (typeof window === "undefined") return { conversationId: "", visitorId: "" };
    const newId = () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now());
    const convKey = `summitx_conv_${tenantId}`;
    const visKey = "summitx_visitor";
    let conversationId = sessionStorage.getItem(convKey) ?? "";
    if (!conversationId) {
      conversationId = newId();
      sessionStorage.setItem(convKey, conversationId);
    }
    let visitorId = localStorage.getItem(visKey) ?? "";
    if (!visitorId) {
      visitorId = newId();
      localStorage.setItem(visKey, visitorId);
    }
    return { conversationId, visitorId };
  });

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { tenantId, conversationId: ids.conversationId, visitorId: ids.visitorId },
    }),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";
  const userTurns = messages.filter((m) => m.role === "user").length;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy, showLead]);

  // Offer the lead form once the visitor is engaged (after a few exchanges),
  // unless they already submitted or dismissed it.
  useEffect(() => {
    if (!leadDone && !showLead && userTurns >= 3) setShowLead(true);
  }, [userTurns, leadDone, showLead]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  }

  async function rate(index: number, rating: "up" | "down") {
    if (feedback[index]) return;
    setFeedback((f) => ({ ...f, [index]: rating }));
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          conversationId: ids.conversationId,
          messageIndex: index,
          rating,
        }),
      });
    } catch {
      /* best-effort */
    }
  }

  return (
    <div
      className="flex h-full flex-col bg-white"
      style={{ ["--brand" as string]: brandColor }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 text-white"
        style={{ backgroundColor: "var(--brand)" }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={businessName}
            className="h-9 w-9 rounded-full bg-white object-cover ring-1 ring-white/40"
          />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-full bg-white/25 text-sm font-bold">
            {businessName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="leading-tight">
          <p className="text-sm font-semibold">{businessName}</p>
          <p className="text-xs text-white/80">AI assistant</p>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4">
        {messages.length === 0 && (
          <div className="mt-4">
            <div className="rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-700">
              {greeting?.trim() || `👋 Hi! Ask me anything about ${businessName}.` || DEFAULT_GREETING}
            </div>
            {starterQuestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {starterQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-zinc-50"
                    style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[85%]">
                <div
                  className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                    isUser
                      ? "rounded-br-sm text-white"
                      : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-800"
                  }`}
                  style={isUser ? { backgroundColor: "var(--brand)" } : undefined}
                >
                  {isUser ? messageText(m) : <Markdown>{messageText(m)}</Markdown>}
                </div>

                {/* Feedback on assistant replies (skip while still streaming) */}
                {!isUser && !(busy && i === messages.length - 1) && (
                  <div className="mt-1 flex gap-1.5 pl-1">
                    <button
                      onClick={() => rate(i, "up")}
                      aria-label="Helpful"
                      className={`text-xs transition ${
                        feedback[i] === "up" ? "opacity-100" : "opacity-40 hover:opacity-80"
                      }`}
                    >
                      👍
                    </button>
                    <button
                      onClick={() => rate(i, "down")}
                      aria-label="Not helpful"
                      className={`text-xs transition ${
                        feedback[i] === "down" ? "opacity-100" : "opacity-40 hover:opacity-80"
                      }`}
                    >
                      👎
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {busy && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-3.5 py-2.5">
              <span className="flex gap-1">
                <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
              </span>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="text-center text-xs text-red-500">
            Something went wrong. Please try again.
          </div>
        )}

        {showLead && !leadDone && (
          <LeadForm
            tenantId={tenantId}
            conversationId={ids.conversationId}
            onClose={() => setShowLead(false)}
            onDone={() => {
              setLeadDone(true);
              setShowLead(false);
            }}
          />
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-zinc-200">
        {!leadDone && messages.length > 0 && (
          <button
            onClick={() => setShowLead(true)}
            className="w-full py-1.5 text-center text-xs font-medium hover:underline"
            style={{ color: "var(--brand)" }}
          >
            📞 Request a callback
          </button>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 p-3 pt-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ backgroundColor: "var(--brand)" }}
          >
            Send
          </button>
        </form>
      </div>

      <p className="pb-2 text-center text-[10px] text-zinc-400">Powered by Summit X</p>
    </div>
  );
}

function LeadForm({
  tenantId,
  conversationId,
  onClose,
  onDone,
}: {
  tenantId: string;
  conversationId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      setErr("Please add an email or phone number.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, conversationId, name, email, phone }),
      });
      if (!res.ok) throw new Error();
      onDone();
    } catch {
      setErr("Couldn't send that. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-800">Want the team to follow up?</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="text-zinc-400 hover:text-zinc-600"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
        />
      </div>
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-2 w-full rounded-lg py-2 text-sm font-semibold text-white transition disabled:opacity-50"
        style={{ backgroundColor: "var(--brand)" }}
      >
        {busy ? "Sending…" : "Send my details"}
      </button>
    </form>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
      style={{ animationDelay: delay }}
    />
  );
}
