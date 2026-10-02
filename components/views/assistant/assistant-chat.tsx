"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { ChatMessage, ChatReply } from "@/server/assistant/schema";

/**
 * Minimal chat client for POST /api/assistant/chat.
 * TODO(step 11): consume a streamed response instead of a single JSON payload.
 */
export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;

    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const reply = (await res.json()) as ChatReply;
      setMessages([...next, reply.message]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card padding="none" className="flex min-h-[28rem] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center py-12 text-center">
            <div>
              <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-primary-fixed/50 text-primary">
                <Icon name="sparkles" size={22} />
              </span>
              <p className="font-headline text-headline-sm text-on-surface">Ask Style Studio anything</p>
              <p className="mt-1 text-body-sm text-secondary">“How busy is Downtown tomorrow?” · “Which products are running low?”</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[80%] rounded-control px-4 py-3 text-body-sm",
                m.role === "user" ? "bg-inverse-surface text-inverse-on-surface" : "bg-surface-container-low text-on-surface",
              )}
            >
              {m.content}
            </p>
          </div>
        ))}
        {pending && <p className="text-body-sm text-secondary">Thinking…</p>}
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
      </div>
      <form onSubmit={send} className="flex items-center gap-3 border-t border-outline-variant/20 p-4">
        <label htmlFor="assistant-input" className="sr-only">
          Message
        </label>
        <input
          id="assistant-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message Style Studio…"
          className="h-11 flex-1 rounded-control border-[1.5px] border-transparent bg-surface-container-low px-4 text-body-sm focus:border-primary-container focus:bg-surface-container-lowest focus:outline-none"
        />
        <Button type="submit" variant="accent" icon="send" disabled={pending || !draft.trim()}>
          Send
        </Button>
      </form>
    </Card>
  );
}
