"use client";

import {
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Inbox,
  Keyboard,
  MessageSquareText,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import DefaultButton from "@/components/app_componentes/customButtons";
import { lpRequest } from "@/components/labPractice/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEt, formatPlainDate } from "@/lib/labPractice/dates";
import type { ReviewLabGroup, ReviewQueue, ReviewStepItem } from "@/lib/labPractice/review";
import { cn } from "@/lib/utils";

const fileUrl = (id: number) => `/api/lab-practice/files/${id}`;

/** "3h", "2d" — how long something has been waiting. */
function waited(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
}

type Photo = { id: number; name: string; caption: string };

// ─────────────────────────────────────────────
// Lightbox
// ─────────────────────────────────────────────
function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: Photo[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const photo = photos[index];
  const go = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, onIndex, photos.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!photo) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[min(96vw,80rem)] gap-3 p-3 sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate text-base">{photo.caption}</DialogTitle>
          <DialogDescription className="truncate text-xs">
            {photo.name} · {index + 1} of {photos.length} · ← → to browse
          </DialogDescription>
        </DialogHeader>
        <div className="relative flex min-h-[50vh] items-center justify-center rounded-lg bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- access-checked API image */}
          <img src={fileUrl(photo.id)} alt={photo.name} className="max-h-[75vh] w-auto max-w-full object-contain" />
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => go(-1)}
                className="absolute left-2 bg-black/60 text-white hover:bg-black/80"
                aria-label="Previous photo"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => go(1)}
                className="absolute right-2 bg-black/60 text-white hover:bg-black/80"
                aria-label="Next photo"
              >
                <ChevronRight />
              </Button>
            </>
          )}
        </div>
        <a
          href={fileUrl(photo.id)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 self-end text-xs text-white/60 hover:text-white"
        >
          Open full size <ExternalLink className="size-3" />
        </a>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Reject dialog
// ─────────────────────────────────────────────
function RejectDialog({
  step,
  onClose,
  onRejected,
}: {
  step: ReviewStepItem;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState("");
  const [alsoReset, setAlsoReset] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/lab-practice/enrollments/${step.enrollmentId}/steps/${step.stepId}/reject`;

  useEffect(() => {
    let cancelled = false;
    lpRequest<{ alsoResetStepIds: number[] }>(base).then((res) => {
      if (!cancelled) setAlsoReset(res?.alsoResetStepIds.length ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [base]);

  async function reject() {
    setBusy(true);
    const ok = await lpRequest(base, { method: "POST", json: { reason } });
    setBusy(false);
    if (ok) {
      toast.success("Sent back to the trainee.");
      onRejected();
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject “{step.stepTitle}”</DialogTitle>
          <DialogDescription>
            The step goes back to not done and the trainee sees your reason. Its photos are deleted.
          </DialogDescription>
        </DialogHeader>
        {alsoReset !== null && alsoReset > 0 && (
          <p className="rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
            {alsoReset} later {alsoReset === 1 ? "step" : "steps"} in this sequence will also be reset.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="review-reject-reason">Reason</Label>
          <Textarea
            id="review-reject-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && reason.trim().length >= 3) reject();
            }}
            rows={4}
            placeholder="What needs to be redone? (Ctrl+Enter to send)"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <DefaultButton onClick={reject} loading={busy} disabled={reason.trim().length < 3 || alsoReset === null}>
            Reject
          </DefaultButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Inbox
// ─────────────────────────────────────────────
export function ReviewInbox({
  queue,
  query,
  readOnlyReason,
}: {
  queue: ReviewQueue;
  /** Current filters (batch / scope), kept when switching trainee. */
  query: Record<string, string>;
  readOnlyReason?: string;
}) {
  const router = useRouter();
  const sel = queue.selected;
  const canAct = Boolean(sel?.canAct) && !readOnlyReason;

  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<ReviewStepItem | null>(null);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Reset local state when the selected trainee changes.
  const selKey = sel?.traineeId ?? 0;
  const [prevKey, setPrevKey] = useState(selKey);
  if (prevKey !== selKey) {
    setPrevKey(selKey);
    setDone(new Set());
    setFocus(0);
  }

  const hrefFor = useCallback(
    (traineeId: number) => `?${new URLSearchParams({ ...query, trainee: String(traineeId) })}`,
    [query],
  );

  const labs: ReviewLabGroup[] = useMemo(
    () =>
      (sel?.labs ?? [])
        .map((g) => ({ ...g, steps: g.steps.filter((s) => !done.has(`c:${s.completionId}`)) }))
        .filter((g) => g.steps.length > 0),
    [sel, done],
  );
  const comments = useMemo(() => (sel?.comments ?? []).filter((c) => !done.has(`s:${c.sessionId}`)), [sel, done]);
  const flatSteps = useMemo(() => labs.flatMap((g) => g.steps), [labs]);
  const photos: Photo[] = useMemo(
    () =>
      labs.flatMap((g) =>
        g.steps.flatMap((s) =>
          s.photos.map((p) => ({ id: p.id, name: p.name, caption: `Lab ${g.labNumber} · ${s.stepTitle}` })),
        ),
      ),
    [labs],
  );
  const focusIdx = Math.min(focus, Math.max(0, flatSteps.length - 1));
  const focused = flatSteps[focusIdx];
  const remaining = flatSteps.length + comments.length;

  const nextTrainee = useMemo(() => {
    if (!sel) return null;
    const others = queue.trainees.filter((t) => t.traineeId !== sel.traineeId);
    const i = queue.trainees.findIndex((t) => t.traineeId === sel.traineeId);
    return queue.trainees.slice(i + 1).find((t) => t.traineeId !== sel.traineeId) ?? others[0] ?? null;
  }, [queue.trainees, sel]);

  const afterChange = useCallback(
    (left: number) => {
      if (left === 0 && nextTrainee) router.push(hrefFor(nextTrainee.traineeId));
      else router.refresh();
    },
    [nextTrainee, router, hrefFor],
  );

  const approve = useCallback(
    async (completionIds: number[], sessionIds: number[], key: string) => {
      if (!canAct || (!completionIds.length && !sessionIds.length)) return;
      setBusy(key);
      const res = await lpRequest<{ steps: number; comments: number }>("/api/lab-practice/review", {
        method: "POST",
        json: { completionIds, sessionIds },
      });
      setBusy(null);
      if (!res) return;
      const next = new Set(done);
      completionIds.forEach((id) => next.add(`c:${id}`));
      sessionIds.forEach((id) => next.add(`s:${id}`));
      setDone(next);
      afterChange(remaining - completionIds.length - sessionIds.length);
    },
    [canAct, done, afterChange, remaining],
  );

  // Keyboard: J/K move · A approve · R reject · O photos · Shift+A approve all.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (lightbox !== null || rejecting || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.closest("input, textarea, select, [contenteditable=true]") || t.closest("[role=dialog]"))) return;
      const k = e.key.toLowerCase();
      if (k === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocus((i) => Math.min(flatSteps.length - 1, i + 1));
      } else if (k === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocus((i) => Math.max(0, i - 1));
      } else if (k === "a" && e.shiftKey) {
        approve(flatSteps.map((s) => s.completionId), comments.map((c) => c.sessionId), "all");
      } else if (k === "a" && focused) {
        approve([focused.completionId], [], `c:${focused.completionId}`);
      } else if (k === "r" && focused && canAct) {
        setRejecting(focused);
      } else if ((k === "o" || e.key === "Enter") && focused?.photos.length) {
        const first = photos.findIndex((p) => p.id === focused.photos[0].id);
        setLightbox(Math.max(0, first));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flatSteps, comments, focused, photos, approve, canAct, lightbox, rejecting]);

  useEffect(() => {
    if (focused) itemRefs.current.get(focused.completionId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused]);

  if (queue.trainees.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/15 px-6 py-16 text-center">
        <span className="rounded-full bg-itbd-blue/10 p-3 text-itbd-blue">
          <Inbox className="size-6" />
        </span>
        <p className="text-base font-semibold text-white">All caught up</p>
        <p className="max-w-sm text-sm text-white/55">
          New photo submissions and daily comments from your trainees will land here, oldest first.
        </p>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* ── Trainee queue ── */}
      <nav aria-label="Trainees waiting for review" className="lg:sticky lg:top-4">
        <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/2">
          {queue.trainees.map((t) => {
            const active = t.traineeId === sel?.traineeId;
            return (
              <li key={t.traineeId}>
                <Link
                  href={hrefFor(t.traineeId)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                    active ? "bg-itbd-blue/10" : "hover:bg-white/5",
                  )}
                >
                  <span className={cn("h-8 w-0.5 shrink-0 rounded-full", active ? "bg-itbd-blue" : "bg-transparent")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{t.name}</span>
                    <span className="flex items-center gap-2 text-xs text-white/50 tabular-nums">
                      {t.pendingSteps > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Camera className="size-3" /> {t.pendingSteps}
                        </span>
                      )}
                      {t.pendingComments > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquareText className="size-3" /> {t.pendingComments}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-white/40 tabular-nums" title={`Oldest waiting since ${formatEt(t.oldestAt)}`}>
                    {waited(t.oldestAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {queue.truncated && (
          <p className="mt-2 text-[11px] text-white/40">Showing the oldest 5,000 items — approve some to see the rest.</p>
        )}
      </nav>

      {/* ── Selected trainee ── */}
      {sel && (
        <section aria-label={`Submissions from ${sel.name}`} className="min-w-0 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-white">{sel.name}</h2>
              <p className="truncate text-xs text-white/50">
                {sel.email} · {remaining} waiting
              </p>
            </div>
            <div className="flex items-center gap-2">
              {labs[0] && (
                <Button asChild variant="ghost" size="sm" className="text-white/60 hover:text-white">
                  <Link href={`/dashboard/guided-labs/trainer/trainees/${labs[0].enrollmentId}`}>
                    Full progress <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              )}
              {canAct && remaining > 0 && (
                <DefaultButton
                  size="sm"
                  loading={busy === "all"}
                  onClick={() => approve(flatSteps.map((s) => s.completionId), comments.map((c) => c.sessionId), "all")}
                >
                  <CheckCheck className="size-4" /> Approve all ({remaining})
                </DefaultButton>
              )}
            </div>
          </header>

          {readOnlyReason && (
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">{readOnlyReason}</p>
          )}
          {!readOnlyReason && !sel.canAct && (
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
              Another trainer owns some of this trainee&rsquo;s modules — view only.
            </p>
          )}

          {remaining === 0 && (
            <p className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-white/50">
              Done with {sel.name}.{nextTrainee ? " Loading the next trainee…" : ""}
            </p>
          )}

          {labs.map((g) => (
            <article key={g.key} className="overflow-hidden rounded-xl border border-white/10 bg-white/2">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  {g.day != null && (
                    <Badge className="shrink-0 bg-itbd-blue/15 px-1.5 text-[11px] text-itbd-blue tabular-nums">Day {g.day}</Badge>
                  )}
                  <span className="min-w-0 truncate text-sm">
                    <span className="text-white/50">{g.moduleTitle} · Lab {g.labNumber} — </span>
                    <span className="font-medium text-white">{g.labTitle}</span>
                  </span>
                </div>
                {canAct && g.steps.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === g.key}
                    onClick={() => approve(g.steps.map((s) => s.completionId), [], g.key)}
                    className="h-7 text-xs text-white/70 hover:text-white"
                  >
                    <CheckCheck className="size-3.5" /> Approve lab ({g.steps.length})
                  </Button>
                )}
              </header>
              <ul className="divide-y divide-white/10">
                {g.steps.map((s) => {
                  const isFocused = focused?.completionId === s.completionId;
                  const key = `c:${s.completionId}`;
                  return (
                    <li
                      key={s.completionId}
                      ref={(el) => {
                        if (el) itemRefs.current.set(s.completionId, el);
                        else itemRefs.current.delete(s.completionId);
                      }}
                      onClick={() => setFocus(flatSteps.findIndex((x) => x.completionId === s.completionId))}
                      className={cn(
                        "grid gap-3 px-4 py-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto]",
                        isFocused ? "bg-itbd-blue/5 ring-1 ring-itbd-blue/40 ring-inset" : "",
                      )}
                    >
                      <div className="min-w-0 space-y-2">
                        <div>
                          <p className="text-sm font-medium text-white">{s.stepTitle}</p>
                          <p className="text-xs text-white/45">
                            {s.taskTitle} · done {formatEt(s.completedAt)}
                            {s.requiresPhoto && s.photos.length === 0 && (
                              <span className="text-white/70"> · photo required but missing</span>
                            )}
                          </p>
                        </div>
                        {s.photos.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {s.photos.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setLightbox(photos.findIndex((x) => x.id === p.id))}
                                className="group relative size-24 overflow-hidden rounded-md ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:size-28"
                                aria-label={`View ${p.name}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- access-checked API image */}
                                <img
                                  src={fileUrl(p.id)}
                                  alt={p.name}
                                  loading="lazy"
                                  className="size-full object-cover transition-transform group-hover:scale-105"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {canAct && (
                        <div className="flex items-start gap-2 sm:flex-col sm:items-stretch">
                          <DefaultButton
                            size="sm"
                            loading={busy === key}
                            onClick={(e) => {
                              e.stopPropagation();
                              approve([s.completionId], [], key);
                            }}
                          >
                            <Check className="size-4" /> Approve
                          </DefaultButton>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRejecting(s);
                            }}
                          >
                            <X className="size-4" /> Reject
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}

          {comments.length > 0 && (
            <article className="overflow-hidden rounded-xl border border-white/10 bg-white/2">
              <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/3 px-4 py-2.5">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                  <MessageSquareText className="size-4 text-itbd-blue" /> Daily comments
                </span>
                {canAct && comments.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === "comments"}
                    onClick={() => approve([], comments.map((c) => c.sessionId), "comments")}
                    className="h-7 text-xs text-white/70 hover:text-white"
                  >
                    <CheckCheck className="size-3.5" /> Mark all read
                  </Button>
                )}
              </header>
              <ul className="divide-y divide-white/10">
                {comments.map((c) => (
                  <li key={c.sessionId} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="text-xs text-white/45">
                        {formatPlainDate(c.practiceDate)} · {c.moduleTitle}
                      </p>
                      <p className="mt-1 text-sm whitespace-pre-wrap text-white/85">{c.comment}</p>
                    </div>
                    {canAct && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === `s:${c.sessionId}`}
                        onClick={() => approve([], [c.sessionId], `s:${c.sessionId}`)}
                      >
                        <Check className="size-4" /> Mark read
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          )}

          {canAct && flatSteps.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
              <Keyboard className="size-3.5" />
              <span><Kbd>J</Kbd>/<Kbd>K</Kbd> move</span>
              <span><Kbd>A</Kbd> approve</span>
              <span><Kbd>R</Kbd> reject</span>
              <span><Kbd>O</Kbd> photos</span>
              <span><Kbd>Shift</Kbd>+<Kbd>A</Kbd> approve all</span>
            </p>
          )}
        </section>
      )}

      {lightbox !== null && photos.length > 0 && (
        <Lightbox photos={photos} index={Math.min(lightbox, photos.length - 1)} onIndex={setLightbox} onClose={() => setLightbox(null)} />
      )}
      {rejecting && (
        <RejectDialog
          step={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={() => {
            const next = new Set(done).add(`c:${rejecting.completionId}`);
            setDone(next);
            setRejecting(null);
            afterChange(remaining - 1);
          }}
        />
      )}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-white/15 bg-white/5 px-1 font-sans text-[10px] text-white/60">{children}</kbd>;
}
