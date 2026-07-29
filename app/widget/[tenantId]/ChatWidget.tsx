"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

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
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="rounded bg-black/10 px-1 py-0.5 text-[12px]">
              {children}
            </code>
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
}: {
  tenantId: string;
  businessName: string;
  brandColor: string;
}) {
  const [input, setInput] = useState("");

  // One conversation per browser tab/session; visitorId persists across visits so
  // the portal can tell repeat visitors apart. Created lazily on the client only.
  const [ids] = useState(() => {
    if (typeof window === "undefined") {
      return { conversationId: "", visitorId: "" };
    }
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
      body: {
        tenantId,
        conversationId: ids.conversationId,
        visitorId: ids.visitorId,
      },
    }),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
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
        <div className="grid h-8 w-8 place-items-center rounded-full bg-white/25 text-sm font-bold">
          {businessName.charAt(0).toUpperCase()}
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">{businessName}</p>
          <p className="text-xs text-white/80">AI assistant</p>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4">
        {messages.length === 0 && (
          <div className="mt-6 text-center text-sm text-zinc-500">
            👋 Hi! Ask me anything about {businessName}.
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  isUser
                    ? "rounded-br-sm text-white"
                    : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-800"
                }`}
                style={isUser ? { backgroundColor: "var(--brand)" } : undefined}
              >
                {isUser ? (
                  messageText(m)
                ) : (
                  <Markdown>{messageText(m)}</Markdown>
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
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-200 p-3">
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

      <p className="pb-2 text-center text-[10px] text-zinc-400">
        Powered by SummitX ChatBot
      </p>
    </div>
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
