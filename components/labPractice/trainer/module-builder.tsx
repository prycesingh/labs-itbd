"use client";

import { ArrowDown, ArrowUp, Camera, ChevronRight, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import { lpRequest, MODE_HELP, MODE_LABELS } from "@/components/labPractice/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ProgressionMode } from "@/DB/labPracticeSchema";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Types (plain, serialisable — built by the page from loadModuleTree)
// ─────────────────────────────────────────────
export type BuilderStep = {
  id: number;
  title: string;
  instructions: string | null;
  requiresPhoto: boolean;
  isActive: boolean;
};
export type BuilderTask = {
  id: number;
  title: string;
  description: string | null;
  isActive: boolean;
  steps: BuilderStep[];
};
export type BuilderLab = {
  id: number;
  title: string;
  details: string | null;
  isActive: boolean;
  tasks: BuilderTask[];
};
export type BuilderModule = {
  id: number;
  title: string;
  info: string | null;
  progressionMode: ProgressionMode;
  isActive: boolean;
  labs: BuilderLab[];
};

type Level = "lab" | "task" | "step";

const API = {
  item: (level: Level, id: number) => `/api/lab-practice/${level}s/${id}`,
  children: (level: Level, parentId: number) =>
    level === "lab"
      ? `/api/lab-practice/modules/${parentId}/labs`
      : level === "task"
        ? `/api/lab-practice/labs/${parentId}/tasks`
        : `/api/lab-practice/tasks/${parentId}/steps`,
};

const TEXT_FIELD: Record<Level, { key: string; label: string }> = {
  lab: { key: "details", label: "Details" },
  task: { key: "description", label: "Description" },
  step: { key: "instructions", label: "Instructions" },
};

// ─────────────────────────────────────────────
// Module settings
// ─────────────────────────────────────────────
function ModuleSettings({ mod }: { mod: BuilderModule }) {
  const router = useRouter();
  const [title, setTitle] = useState(mod.title);
  const [info, setInfo] = useState(mod.info ?? "");
  const [mode, setMode] = useState<ProgressionMode>(mod.progressionMode);
  const [isActive, setIsActive] = useState(mod.isActive);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await lpRequest(`/api/lab-practice/modules/${mod.id}`, {
      method: "PATCH",
      json: { title, info: info || null, progressionMode: mode, isActive },
    });
    setSaving(false);
    if (ok) {
      toast.success("Module saved.");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="mod-title" className="text-white/70">Title</Label>
        <Input id="mod-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mod-info" className="text-white/70">Info</Label>
        <Textarea id="mod-info" value={info} onChange={(e) => setInfo(e.target.value)} rows={3} />
      </div>
      <div className="space-y-2">
        <Label className="text-white/70">Progression mode</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as ProgressionMode)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MODE_LABELS) as ProgressionMode[]).map((m) => (
              <SelectItem key={m} value={m}>
                {MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-white/50">{MODE_HELP[mode]}</p>
      </div>
      <label className="flex items-center justify-between text-sm text-white/70">
        Module active
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </label>
      <DefaultButton size="sm" onClick={save} loading={saving}>
        Save module
      </DefaultButton>
    </div>
  );
}

// ─────────────────────────────────────────────
// Edit dialog (title + level text + requiresPhoto for steps)
// ─────────────────────────────────────────────
function EditItemDialog({
  level,
  id,
  initial,
  open,
  onOpenChange,
}: {
  level: Level;
  id: number;
  initial: { title: string; text: string | null; requiresPhoto?: boolean };
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text ?? "");
  const [requiresPhoto, setRequiresPhoto] = useState(Boolean(initial.requiresPhoto));
  const [saving, setSaving] = useState(false);
  const field = TEXT_FIELD[level];

  async function save() {
    setSaving(true);
    const json: Record<string, unknown> = { title, [field.key]: text || null };
    if (level === "step") json.requiresPhoto = requiresPhoto;
    const ok = await lpRequest(API.item(level, id), { method: "PATCH", json });
    setSaving(false);
    if (ok) {
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="capitalize">Edit {level}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-${level}-title`}>Title</Label>
            <Input
              id={`edit-${level}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-${level}-text`}>{field.label}</Label>
            <Textarea
              id={`edit-${level}-text`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
            />
          </div>
          {level === "step" && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={requiresPhoto} onCheckedChange={(v) => setRequiresPhoto(v === true)} />
              Requires at least one photo to complete
            </label>
          )}
        </div>
        <DialogFooter>
          <DefaultButton size="sm" onClick={save} loading={saving}>
            Save
          </DefaultButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Generic row + inline add
// ─────────────────────────────────────────────
function useReorder(level: Level, parentId: number, siblingIds: number[]) {
  const router = useRouter();
  return async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= siblingIds.length) return;
    const ordered = [...siblingIds];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const ok = await lpRequest(API.children(level, parentId), {
      method: "PUT",
      json: { orderedIds: ordered },
    });
    if (ok) router.refresh();
  };
}

function ItemRow({
  level,
  id,
  index,
  count,
  title,
  text,
  isActive,
  requiresPhoto,
  onMove,
  meta,
  children,
}: {
  level: Level;
  id: number;
  index: number;
  count: number;
  title: string;
  text: string | null;
  isActive: boolean;
  requiresPhoto?: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(level === "lab");

  async function toggleActive(v: boolean) {
    const ok = await lpRequest(API.item(level, id), { method: "PATCH", json: { isActive: v } });
    if (ok) router.refresh();
  }

  const header = (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-2",
        level === "lab" ? "bg-white/5" : "hover:bg-white/5",
        !isActive && "opacity-50",
      )}
    >
      {children !== undefined ? (
        <CollapsibleTrigger asChild>
          <button type="button" className="text-white/50 hover:text-white" aria-label={`Toggle ${title}`}>
            <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
          </button>
        </CollapsibleTrigger>
      ) : (
        <span className="w-4 text-center text-xs text-white/40">{index + 1}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {children !== undefined && <span className="mr-1 text-white/40">{index + 1}.</span>}
          {title}
          {requiresPhoto && <Camera className="ml-2 inline size-3.5 text-itbd-blue" aria-label="Photo required" />}
          {!isActive && (
            <Badge variant="outline" className="ml-2 text-white/60">
              Inactive
            </Badge>
          )}
        </p>
        {meta}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label="Move up">
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={index === count - 1} onClick={() => onMove(index, 1)} aria-label="Move down">
          <ArrowDown />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Edit ${title}`}>
          <Pencil />
        </Button>
        <Switch checked={isActive} onCheckedChange={toggleActive} aria-label={`${title} active`} />
      </div>
      {editing && (
        <EditItemDialog
          level={level}
          id={id}
          initial={{ title, text, requiresPhoto }}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
    </div>
  );

  if (children === undefined) return header;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {header}
      <CollapsibleContent className="ml-5 border-l border-white/10 pl-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function AddInline({ level, parentId }: { level: Level; parentId: number }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    const json: Record<string, unknown> = { title: title.trim() };
    if (level === "step") json.requiresPhoto = requiresPhoto;
    const ok = await lpRequest(API.children(level, parentId), { method: "POST", json });
    setBusy(false);
    if (ok) {
      setTitle("");
      setRequiresPhoto(false);
      router.refresh();
    }
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`New ${level} title`}
        maxLength={200}
        className="h-8 min-w-48 flex-1"
        aria-label={`New ${level} title`}
      />
      {level === "step" && (
        <label className="flex items-center gap-1.5 text-xs text-white/60">
          <Checkbox checked={requiresPhoto} onCheckedChange={(v) => setRequiresPhoto(v === true)} />
          Photo required
        </label>
      )}
      <DefaultButton type="submit" size="sm" loading={busy} disabled={!title.trim()}>
        <Plus className="size-4" /> Add {level}
      </DefaultButton>
    </form>
  );
}

// ─────────────────────────────────────────────
// Tree
// ─────────────────────────────────────────────
function StepList({ task }: { task: BuilderTask }) {
  const move = useReorder("step", task.id, task.steps.map((s) => s.id));
  return (
    <div>
      {task.steps.map((s, i) => (
        <ItemRow
          key={s.id}
          level="step"
          id={s.id}
          index={i}
          count={task.steps.length}
          title={s.title}
          text={s.instructions}
          isActive={s.isActive}
          requiresPhoto={s.requiresPhoto}
          onMove={move}
        />
      ))}
      <AddInline level="step" parentId={task.id} />
    </div>
  );
}

function TaskList({ lab }: { lab: BuilderLab }) {
  const move = useReorder("task", lab.id, lab.tasks.map((t) => t.id));
  return (
    <div>
      {lab.tasks.map((t, i) => (
        <ItemRow
          key={t.id}
          level="task"
          id={t.id}
          index={i}
          count={lab.tasks.length}
          title={t.title}
          text={t.description}
          isActive={t.isActive}
          onMove={move}
          meta={<p className="text-xs text-white/40">{t.steps.length} steps</p>}
        >
          <StepList task={t} />
        </ItemRow>
      ))}
      <AddInline level="task" parentId={lab.id} />
    </div>
  );
}

/** Module settings form (title, info, progression mode, active). */
export const ModuleSettingsCard = ModuleSettings;

/** Lab → Task → Step curriculum tree with add / edit / reorder / activate. */
export function ModuleTreeCard({ mod }: { mod: BuilderModule }) {
  const move = useReorder("lab", mod.id, mod.labs.map((l) => l.id));
  return (
    <div className="space-y-2">
      {mod.labs.length === 0 && (
        <p className="text-sm text-white/50">No labs yet — add the first one below.</p>
      )}
      {mod.labs.map((l, i) => (
        <ItemRow
          key={l.id}
          level="lab"
          id={l.id}
          index={i}
          count={mod.labs.length}
          title={l.title}
          text={l.details}
          isActive={l.isActive}
          onMove={move}
          meta={<p className="text-xs text-white/40">{l.tasks.length} tasks</p>}
        >
          <TaskList lab={l} />
        </ItemRow>
      ))}
      <AddInline level="lab" parentId={mod.id} />
    </div>
  );
}
