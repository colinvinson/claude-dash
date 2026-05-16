"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Flag } from "lucide-react";
import CompletionToggle from "@/components/ui/CompletionToggle";
import { FormInput } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import { useBusinessTasks, type BusinessTask } from "@/hooks/useBusinessTasks";
import { PALETTE, ICON } from "@/lib/design-tokens";

// Per-business task checklist. The main work surface in BusinessDetail —
// "what am I doing for this business right now." Open tasks first by
// priority, completed tasks collapse into a "done" pill at the bottom.

function priorityColor(p: -1 | 0 | 1): string {
  if (p === 1)  return PALETTE.celebration;  // high — amber
  if (p === -1) return PALETTE.dim;          // low — zinc-500
  return "rgb(161 161 170)";                  // normal — zinc-400
}

function nextPriority(p: -1 | 0 | 1): -1 | 0 | 1 {
  if (p === 0)  return 1;
  if (p === 1)  return -1;
  return 0;
}

function dueChip(due: string | null): string | null {
  if (!due) return null;
  const d  = new Date(due + "T00:00:00");
  const ms = d.getTime() - Date.now();
  const day = Math.round(ms / 86400000);
  if (day < 0)  return `${-day}d overdue`;
  if (day === 0) return "today";
  if (day === 1) return "tomorrow";
  if (day < 7)   return `${day}d`;
  return due;
}

export default function BusinessTasks({ businessId }: { businessId: string }) {
  const { openTasks, doneTasks, addTask, toggleTask, updateTask, deleteTask } = useBusinessTasks(businessId);
  const [draft, setDraft]           = useState("");
  const [showDone, setShowDone]     = useState(false);
  const [busy, setBusy]             = useState(false);

  async function submit() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    await addTask({ title: draft });
    setBusy(false);
    setDraft("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <FormLabel className="mb-0">Tasks</FormLabel>
        <span className="text-[10px] text-zinc-600 tabular-nums">
          {openTasks.length} open
        </span>
      </div>

      {/* Open tasks */}
      {openTasks.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {openTasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => toggleTask(t.id, true)}
              onCyclePriority={() => updateTask(t.id, { priority: nextPriority(t.priority) })}
              onDelete={() => deleteTask(t.id)}
              onEdit={(title) => updateTask(t.id, { title })}
            />
          ))}
        </div>
      )}

      {/* Add new task */}
      <div className="flex items-center gap-2">
        <FormInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          placeholder={openTasks.length === 0 ? "Add the first task — what needs to happen?" : "Add a task and press enter"}
          className="flex-1"
        />
        <button
          onClick={submit}
          disabled={!draft.trim() || busy}
          aria-label="Add task"
          className="flex-shrink-0 px-3 py-2.5 rounded-xl bg-white text-zinc-900 text-xs font-bold disabled:opacity-40 flex items-center gap-1"
        >
          <Plus size={ICON.sm} />
        </button>
      </div>

      {/* Done tasks — collapsed by default */}
      {doneTasks.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowDone((s) => !s)}
            className="text-[10px] uppercase tracking-widest text-zinc-600 hover:text-zinc-400 flex items-center gap-1 -m-1 p-1"
          >
            {showDone
              ? <ChevronUp   size={ICON.xs} />
              : <ChevronDown size={ICON.xs} />}
            {doneTasks.length} done
          </button>
          {showDone && (
            <div className="space-y-1.5 mt-2">
              {doneTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={() => toggleTask(t.id, false)}
                  onCyclePriority={() => updateTask(t.id, { priority: nextPriority(t.priority) })}
                  onDelete={() => deleteTask(t.id)}
                  onEdit={(title) => updateTask(t.id, { title })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task, onToggle, onCyclePriority, onDelete, onEdit,
}: {
  task: BusinessTask;
  onToggle: () => void;
  onCyclePriority: () => void;
  onDelete: () => void;
  onEdit: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(task.title);
  const due = dueChip(task.due_date);

  function commit() {
    if (draft.trim() && draft !== task.title) onEdit(draft.trim());
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 group">
      <CompletionToggle done={task.is_complete} onToggle={onToggle} mode="small" />

      {/* Priority flag — tap to cycle low/normal/high */}
      <button
        onClick={onCyclePriority}
        aria-label="Cycle priority"
        className="flex-shrink-0 -m-1 p-1"
      >
        <Flag
          size={ICON.xs}
          fill={task.priority === 1 ? priorityColor(task.priority) : "transparent"}
          style={{ color: priorityColor(task.priority) }}
        />
      </button>

      {editing ? (
        <FormInput
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter")  commit();
            if (e.key === "Escape") { setDraft(task.title); setEditing(false); }
          }}
          className="flex-1 text-sm"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={`flex-1 text-left text-sm truncate ${task.is_complete ? "line-through text-zinc-600" : "text-zinc-100"}`}
        >
          {task.title}
        </button>
      )}

      {due && !task.is_complete && (
        <span className="text-[10px] text-zinc-500 tabular-nums flex-shrink-0">{due}</span>
      )}

      <button
        onClick={onDelete}
        aria-label="Delete task"
        className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity -m-2 p-2"
      >
        <Trash2 size={ICON.xs} />
      </button>
    </div>
  );
}
