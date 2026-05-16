"use client";

import { useState } from "react";
import { MessageSquare, Plus, X, ExternalLink, Trash2 } from "lucide-react";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import Button from "@/components/ui/Button";
import {
  useLinkedChats,
  type ChatSource,
  type LinkedChat,
} from "@/hooks/useLinkedChats";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";

// Linked chats panel — drops into BusinessDetail or GoalWidget. Pass
// exactly one of `businessId` or `goalId` and that scope drives both
// the list filter AND the default association for newly added rows.
//
// Conversations from claude.ai / chatgpt that Sir owns externally
// surface here as cards with title + source + summary + an open-in-
// new-tab link. The point: the chat that did the heavy lifting on a
// business is one tap away from the business itself.

const SOURCE_LABEL: Record<ChatSource, string> = {
  claude:  "Claude",
  chatgpt: "ChatGPT",
  jarvis:  "Jarvis",
  other:   "Other",
};

const SOURCE_COLOR: Record<ChatSource, string> = {
  claude:  PALETTE.celebration,  // amber-300 — Anthropic's signature warmth
  chatgpt: PALETTE.success,      // emerald
  jarvis:  PALETTE.info,         // sky
  other:   PALETTE.dim,
};

function timeSinceShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)   return "just now";
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7)   return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function LinkedChats({
  businessId,
  goalId,
}: {
  businessId?: string | null;
  goalId?:     string | null;
}) {
  const { chats, addChat, archiveChat } = useLinkedChats({ businessId, goalId });
  const [adding, setAdding]     = useState(false);
  const [title, setTitle]       = useState("");
  const [url, setUrl]           = useState("");
  const [source, setSource]     = useState<ChatSource>("claude");
  const [summary, setSummary]   = useState("");
  const [busy, setBusy]         = useState(false);

  function resetForm() {
    setTitle(""); setUrl(""); setSource("claude"); setSummary(""); setAdding(false);
  }

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const row = await addChat({ title, url, source, summary });
    setBusy(false);
    if (row) resetForm();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <FormLabel className="mb-0">Linked chats</FormLabel>
        {!adding && chats.length > 0 && (
          <button
            onClick={() => setAdding(true)}
            className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-zinc-300 -m-2 p-2 flex items-center gap-1"
          >
            <Plus size={ICON.xs} /> Link
          </button>
        )}
      </div>

      {chats.length === 0 && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-xs font-semibold hover:border-zinc-700 hover:text-zinc-300 transition-colors"
        >
          <MessageSquare size={ICON.sm} />
          Link an existing Claude chat
        </button>
      )}

      {chats.length > 0 && (
        <div className="space-y-1.5">
          {chats.map((c) => (
            <ChatRow key={c.id} chat={c} onArchive={() => archiveChat(c.id)} />
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className={TYPE.label}>Link a chat</span>
            <button onClick={resetForm} aria-label="Cancel" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2">
              <X size={ICON.sm} />
            </button>
          </div>
          <div className="flex gap-2">
            <FormInput
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. SaaS v2 pricing research)"
              className="flex-1"
            />
            <FormSelect
              value={source}
              onChange={(e) => setSource(e.target.value as ChatSource)}
              className="w-28"
            >
              {(Object.keys(SOURCE_LABEL) as ChatSource[]).map((s) => (
                <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
              ))}
            </FormSelect>
          </div>
          <FormInput
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (claude.ai/chat/... or any link)"
          />
          <FormTextarea
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What did this chat work on? (optional — Jarvis reads this for context)"
          />
          <Button variant="primary" size="md" fullWidth onClick={submit} loading={busy} disabled={!title.trim()}>
            Link chat
          </Button>
        </div>
      )}
    </div>
  );
}

function ChatRow({
  chat,
  onArchive,
}: {
  chat: LinkedChat;
  onArchive: () => void;
}) {
  const color = SOURCE_COLOR[chat.source];
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 group">
      <MessageSquare size={ICON.xs} style={{ color }} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-zinc-100 truncate">{chat.title}</span>
          <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color }}>
            {SOURCE_LABEL[chat.source]}
          </span>
          <span className="text-[10px] text-zinc-600 tabular-nums ml-auto">{timeSinceShort(chat.created_at)}</span>
        </div>
        {chat.summary && (
          <p className="text-[11px] text-zinc-500 leading-snug mt-0.5 line-clamp-2">{chat.summary}</p>
        )}
      </div>
      {chat.url && (
        <a
          href={chat.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open chat"
          className="flex-shrink-0 text-zinc-500 hover:text-zinc-200 -m-2 p-2"
        >
          <ExternalLink size={ICON.xs} />
        </a>
      )}
      <button
        onClick={() => { if (confirm(`Remove "${chat.title}" link?`)) onArchive(); }}
        aria-label="Remove"
        className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity -m-2 p-2"
      >
        <Trash2 size={ICON.xs} />
      </button>
    </div>
  );
}
