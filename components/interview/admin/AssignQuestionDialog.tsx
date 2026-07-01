"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type BankQuestionOption = {
  id: string;
  promptText: string;
  isActive: boolean;
  promptAudioPath?: string | null;
  promptTranscript?: string | null;
  assignmentCount?: number;
};

type ModuleQuestionAssignment = {
  id: string;
  moduleId: string;
  questionId: string;
  questionOrder: number;
  isActive: boolean;
  question: {
    id: string;
    promptText: string;
    promptAudioPath: string | null;
    promptTranscript: string | null;
    isActive: boolean;
  };
};

interface AssignQuestionDialogProps {
  moduleId: string;
  onSuccess?: () => void | Promise<void>;
}

export function AssignQuestionDialog({
  moduleId,
  onSuccess,
}: AssignQuestionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [refreshingQuestions, setRefreshingQuestions] = useState(false);
  const [assigningMany, setAssigningMany] = useState(false);
  const [creating, setCreating] = useState(false);
  const [unassigningAssignmentId, setUnassigningAssignmentId] = useState<
    string | null
  >(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(
    null,
  );
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [createPromptText, setCreatePromptText] = useState("");
  const [createAudioFile, setCreateAudioFile] = useState<File | null>(null);
  const [editPromptText, setEditPromptText] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("active");
  const [search, setSearch] = useState("");
  const [questions, setQuestions] = useState<BankQuestionOption[]>([]);
  const [assignedQuestions, setAssignedQuestions] = useState<
    ModuleQuestionAssignment[]
  >([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const selectedQuestionIdSet = useMemo(
    () => new Set(selectedQuestionIds),
    [selectedQuestionIds],
  );

  const assignedQuestionIdSet = useMemo(
    () => new Set(assignedQuestions.map((assignment) => assignment.questionId)),
    [assignedQuestions],
  );

  const fetchQuestions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshingQuestions(true);
      } else {
        setLoadingQuestions(true);
      }

      const res = await fetch(
        `/api/interview/admin/question-bank?page=1&limit=250`,
      );

      if (!res.ok) {
        throw new Error("Failed to fetch question bank");
      }

      const payload = (await res.json()) as {
        questions: BankQuestionOption[];
      };

      setQuestions(payload.questions ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load questions";
      toast.error("Unable to load question bank", { description: message });
    } finally {
      if (isRefresh) {
        setRefreshingQuestions(false);
      } else {
        setLoadingQuestions(false);
      }
    }
  }, []);

  const fetchAssignedQuestions = useCallback(async () => {
    try {
      setLoadingAssigned(true);

      const res = await fetch(
        `/api/interview/admin/modules/${moduleId}/questions`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch assigned questions");
      }

      const payload = (await res.json()) as ModuleQuestionAssignment[];
      setAssignedQuestions(payload ?? []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load assigned questions";
      toast.error("Unable to load assigned questions", {
        description: message,
      });
    } finally {
      setLoadingAssigned(false);
    }
  }, [moduleId]);

  useEffect(() => {
    if (!open) return;

    void Promise.all([fetchQuestions(), fetchAssignedQuestions()]);
  }, [open, fetchAssignedQuestions, fetchQuestions]);

  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byStatus = questions.filter((question) => {
      if (statusFilter === "all") return true;
      return statusFilter === "active" ? question.isActive : !question.isActive;
    });

    if (!term) return byStatus;

    return byStatus.filter((question) =>
      question.promptText.toLowerCase().includes(term),
    );
  }, [questions, search, statusFilter]);

  const selectedQuestions = useMemo(
    () =>
      questions.filter(
        (question) =>
          selectedQuestionIdSet.has(question.id) &&
          !assignedQuestionIdSet.has(question.id),
      ),
    [questions, selectedQuestionIdSet, assignedQuestionIdSet],
  );

  const assignableVisibleQuestionIds = useMemo(
    () =>
      filteredQuestions
        .filter(
          (question) =>
            question.isActive && !assignedQuestionIdSet.has(question.id),
        )
        .map((q) => q.id),
    [filteredQuestions, assignedQuestionIdSet],
  );

  const allVisibleSelected =
    assignableVisibleQuestionIds.length > 0 &&
    assignableVisibleQuestionIds.every((id) => selectedQuestionIdSet.has(id));

  useEffect(() => {
    setSelectedQuestionIds((prev) =>
      prev.filter((id) => !assignedQuestionIdSet.has(id)),
    );
  }, [assignedQuestionIdSet]);

  const toggleSelectQuestion = (questionId: string, shouldSelect: boolean) => {
    setSelectedQuestionIds((prev) => {
      if (shouldSelect) {
        if (prev.includes(questionId)) return prev;
        return [...prev, questionId];
      }
      return prev.filter((id) => id !== questionId);
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedQuestionIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !assignableVisibleQuestionIds.includes(id));
      }

      const merged = new Set(prev);
      for (const id of assignableVisibleQuestionIds) {
        merged.add(id);
      }
      return Array.from(merged);
    });
  };

  const createQuestion = async () => {
    const trimmedPrompt = createPromptText.trim();

    if (!trimmedPrompt) {
      toast.warning("Enter question text first");
      return;
    }

    try {
      setCreating(true);

      const payload = new FormData();
      payload.append("promptText", trimmedPrompt);
      if (createAudioFile) {
        payload.append("promptAudio", createAudioFile);
      }

      const res = await fetch("/api/interview/admin/question-bank", {
        method: "POST",
        body: payload,
      });

      const responsePayload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(responsePayload?.error || "Failed to create question");
      }

      const createdQuestion = responsePayload as BankQuestionOption;
      setQuestions((prev) => [createdQuestion, ...prev]);
      setCreatePromptText("");
      setCreateAudioFile(null);
      setSelectedQuestionIds((prev) =>
        prev.includes(createdQuestion.id)
          ? prev
          : [...prev, createdQuestion.id],
      );
      setStatusFilter("all");

      toast.success("Question added to bank");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create question";
      toast.error("Unable to create question", { description: message });
    } finally {
      setCreating(false);
    }
  };

  const startEditingQuestion = (question: BankQuestionOption) => {
    setEditingQuestionId(question.id);
    setEditPromptText(question.promptText);
  };

  const saveQuestionTitle = async () => {
    if (!editingQuestionId) return;

    const trimmedPrompt = editPromptText.trim();
    if (!trimmedPrompt) {
      toast.warning("Question title cannot be empty");
      return;
    }

    try {
      setSavingQuestionId(editingQuestionId);

      const res = await fetch(
        `/api/interview/admin/question-bank/${editingQuestionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptText: trimmedPrompt }),
        },
      );

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update question title");
      }

      setQuestions((prev) =>
        prev.map((question) =>
          question.id === editingQuestionId
            ? {
                ...question,
                promptText: trimmedPrompt,
              }
            : question,
        ),
      );

      setAssignedQuestions((prev) =>
        prev.map((assignment) =>
          assignment.question.id === editingQuestionId
            ? {
                ...assignment,
                question: {
                  ...assignment.question,
                  promptText: trimmedPrompt,
                },
              }
            : assignment,
        ),
      );

      setEditingQuestionId(null);
      setEditPromptText("");
      toast.success("Question title updated");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update question title";
      toast.error("Unable to update question title", { description: message });
    } finally {
      setSavingQuestionId(null);
    }
  };

  const deleteQuestion = async (question: BankQuestionOption) => {
    if (
      !confirm(`Delete this question from the bank?\n\n${question.promptText}`)
    ) {
      return;
    }

    try {
      setDeletingQuestionId(question.id);
      const res = await fetch(
        `/api/interview/admin/question-bank/${question.id}`,
        {
          method: "DELETE",
        },
      );

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 409 && Array.isArray(payload?.assignments)) {
          const moduleNames = payload.assignments
            .slice(0, 3)
            .map((assignment: { moduleName: string }) => assignment.moduleName)
            .join(", ");
          const extraCount = payload.assignments.length - 3;
          const suffix = extraCount > 0 ? ` and ${extraCount} more` : "";
          throw new Error(
            `Question is still assigned to ${payload.assignments.length} module(s): ${moduleNames}${suffix}. Unassign it first.`,
          );
        }

        throw new Error(payload?.error || "Failed to delete question");
      }

      setQuestions((prev) => prev.filter((entry) => entry.id !== question.id));
      setSelectedQuestionIds((prev) => prev.filter((id) => id !== question.id));
      if (editingQuestionId === question.id) {
        setEditingQuestionId(null);
        setEditPromptText("");
      }

      toast.success("Question deleted from bank");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete question";
      toast.error("Unable to delete question", { description: message });
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const assignSelectedQuestions = async () => {
    if (selectedQuestionIds.length === 0) {
      toast.warning("Select at least one question to assign");
      return;
    }

    try {
      setAssigningMany(true);

      let assignedCount = 0;
      let alreadyAssignedCount = 0;
      let failedCount = 0;
      const processedIds = new Set<string>();
      let firstFailureMessage = "";

      for (const questionId of selectedQuestionIds) {
        const res = await fetch(
          `/api/interview/admin/modules/${moduleId}/questions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId }),
          },
        );

        const payload = await res.json().catch(() => null);

        if (res.ok) {
          assignedCount += 1;
          processedIds.add(questionId);
          continue;
        }

        if (res.status === 409) {
          alreadyAssignedCount += 1;
          processedIds.add(questionId);
          continue;
        }

        failedCount += 1;
        if (!firstFailureMessage) {
          firstFailureMessage = payload?.error || "Failed to assign questions";
        }
      }

      if (assignedCount > 0) {
        toast.success(`Assigned ${assignedCount} question(s) to module`);
      }

      if (alreadyAssignedCount > 0) {
        toast.info(`${alreadyAssignedCount} question(s) were already assigned`);
      }

      if (failedCount > 0) {
        toast.error(`Failed to assign ${failedCount} question(s)`, {
          description: firstFailureMessage,
        });
      }

      if (processedIds.size > 0) {
        setSelectedQuestionIds((prev) =>
          prev.filter((questionId) => !processedIds.has(questionId)),
        );
      }

      await Promise.all([fetchQuestions(true), fetchAssignedQuestions()]);

      if (onSuccess && (assignedCount > 0 || alreadyAssignedCount > 0)) {
        await onSuccess();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to assign questions";
      toast.error("Assignment failed", { description: message });
    } finally {
      setAssigningMany(false);
    }
  };

  const unassignQuestion = async (assignmentId: string) => {
    try {
      setUnassigningAssignmentId(assignmentId);

      const res = await fetch(
        `/api/interview/admin/modules/${moduleId}/questions/${assignmentId}`,
        {
          method: "DELETE",
        },
      );

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to unassign question");
      }

      toast.success("Question unassigned from module", {
        description: payload?.moduleDeactivated
          ? "Module was auto-deactivated because active question count is now below requirement."
          : undefined,
      });

      setAssignedQuestions((prev) =>
        prev
          .filter((assignment) => assignment.id !== assignmentId)
          .map((assignment, index) => ({
            ...assignment,
            questionOrder: index,
          })),
      );

      setQuestions((prev) =>
        prev.map((question) => {
          if (question.assignmentCount === undefined) {
            return question;
          }

          const matching = assignedQuestions.find(
            (assignment) =>
              assignment.id === assignmentId &&
              assignment.questionId === question.id,
          );

          if (!matching) {
            return question;
          }

          return {
            ...question,
            assignmentCount: Math.max(0, question.assignmentCount - 1),
          };
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to unassign question";
      toast.error("Unable to unassign question", { description: message });
    } finally {
      setUnassigningAssignmentId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Assign From Question Bank</Button>
      </DialogTrigger>

      <DialogContent className="min-w-[70dvw] max-w-6xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6">
          <DialogTitle className="font-light text-2xl">
            Assign Question
          </DialogTitle>
          <DialogDescription>
            Manage your question bank and quickly assign any question to this
            module without leaving this screen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[82vh] gap-0 overflow-hidden lg:grid-cols-[1.2fr_0.8fr]">
          <section className="border-b border-border/60 p-4 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search question text"
                className="min-w-55 flex-1"
              />
              <Button
                type="button"
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              <Button
                type="button"
                variant={statusFilter === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("active")}
              >
                Active
              </Button>
              <Button
                type="button"
                variant={statusFilter === "inactive" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("inactive")}
              >
                Inactive
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchQuestions(true)}
                disabled={refreshingQuestions || loadingQuestions}
              >
                {refreshingQuestions ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing
                  </>
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
              {loadingQuestions
                ? "Loading question bank..."
                : `${filteredQuestions.length} question(s) visible`}
            </p>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={toggleSelectAllVisible}
                disabled={assignableVisibleQuestionIds.length === 0}
              >
                {allVisibleSelected ? "Unselect Visible" : "Select Visible"}
              </Button>
              <p className="text-xs text-muted-foreground">
                {selectedQuestionIds.length} selected
              </p>
            </div>

            <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              {loadingQuestions ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching questions...
                </div>
              ) : filteredQuestions.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No questions found for this filter.
                </p>
              ) : (
                filteredQuestions.map((question) => {
                  const isSelected = selectedQuestionIdSet.has(question.id);
                  const isEditing = editingQuestionId === question.id;
                  const isAlreadyAssigned = assignedQuestionIdSet.has(
                    question.id,
                  );
                  const cannotSelect = !question.isActive || isAlreadyAssigned;

                  return (
                    <div
                      key={question.id}
                      className={`rounded-md border p-3 ${
                        isSelected
                          ? "border-cyan-500/70 bg-cyan-500/10"
                          : "border-border/60"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <Textarea
                              value={editPromptText}
                              onChange={(event) =>
                                setEditPromptText(event.target.value)
                              }
                              rows={3}
                              maxLength={2000}
                            />
                          ) : (
                            <p className="text-sm leading-relaxed wrap-break-word">
                              {question.promptText}
                            </p>
                          )}

                          {question.promptAudioPath && (
                            <div className="mt-2">
                              <p className="mb-1 text-xs text-muted-foreground">
                                Attached audio
                              </p>
                              <audio
                                key={question.promptAudioPath}
                                controls
                                preload="metadata"
                                className="h-9 w-full"
                                src={question.promptAudioPath}
                              >
                                Your browser does not support the audio element.
                              </audio>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0">
                          <Badge
                            variant={
                              question.isActive ? "default" : "secondary"
                            }
                            className={
                              question.isActive
                                ? "bg-emerald-600/80"
                                : "bg-zinc-600/80"
                            }
                          >
                            {question.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {isAlreadyAssigned && (
                            <Badge variant="secondary" className="mt-1">
                              Assigned
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 rounded-md">
                          <Checkbox
                            id={`select-question-${question.id}`}
                            checked={isSelected || cannotSelect}
                            disabled={cannotSelect}
                            onCheckedChange={(checked) =>
                              toggleSelectQuestion(
                                question.id,
                                checked === true,
                              )
                            }
                          />
                          <Label htmlFor={`select-question-${question.id}`}>
                            <span className="text-sm">
                              {isSelected || cannotSelect
                                ? "Selected"
                                : "Select question"}
                            </span>
                          </Label>
                        </div>

                        {!question.isActive && (
                          <Badge variant="secondary">Activate to assign</Badge>
                        )}

                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Save question title"
                              title="Save"
                              onClick={() => void saveQuestionTitle()}
                              disabled={savingQuestionId === question.id}
                            >
                              {savingQuestionId === question.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Cancel edit"
                              title="Cancel"
                              onClick={() => {
                                setEditingQuestionId(null);
                                setEditPromptText("");
                              }}
                              disabled={savingQuestionId === question.id}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Edit title"
                            title="Edit title"
                            onClick={() => startEditingQuestion(question)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Delete question"
                          title="Delete question"
                          onClick={() => void deleteQuestion(question)}
                          disabled={deletingQuestionId === question.id}
                          className="text-destructive hover:text-destructive"
                        >
                          {deletingQuestionId === question.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="p-4">
            <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <h4 className="text-md">Quick Add To Bank</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a new question and optionally upload audio in one step.
                </p>

                <div className="mt-3 space-y-2">
                  <Label htmlFor="new-question-title">Question title</Label>
                  <Textarea
                    id="new-question-title"
                    value={createPromptText}
                    onChange={(event) =>
                      setCreatePromptText(event.target.value)
                    }
                    rows={4}
                    maxLength={2000}
                    placeholder="Enter a clear interview question"
                  />
                </div>

                <div className="mt-3 space-y-2">
                  <Label htmlFor="new-question-audio">
                    Question audio (optional)
                  </Label>
                  <Input
                    id="new-question-audio"
                    type="file"
                    accept="audio/*"
                    onChange={(event) =>
                      setCreateAudioFile(event.target.files?.[0] ?? null)
                    }
                  />
                </div>

                <Button
                  type="button"
                  className="mt-3"
                  onClick={() => void createQuestion()}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Question
                    </>
                  )}
                </Button>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <h4 className="text-sm">Assign To Module</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selected questions are shown below. Assign all in one click.
                </p>

                <div className="mt-3 space-y-2">
                  {selectedQuestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No questions selected yet.
                    </p>
                  ) : (
                    selectedQuestions.map((question) => (
                      <div
                        key={question.id}
                        className="rounded-md border border-border/60 bg-background/40 p-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm">{question.promptText}</p>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Remove from selected"
                            title="Remove from selected"
                            onClick={() =>
                              toggleSelectQuestion(question.id, false)
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Button
                  type="button"
                  className="mt-3"
                  onClick={() => void assignSelectedQuestions()}
                  disabled={assigningMany || selectedQuestions.length === 0}
                >
                  {assigningMany ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    `Assign Selected (${selectedQuestions.length})`
                  )}
                </Button>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <h4 className="text-sm">Assigned Questions</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Unassign directly from this list.
                </p>

                <div className="mt-3 space-y-2">
                  {loadingAssigned ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading assigned questions...
                    </div>
                  ) : assignedQuestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No questions assigned to this module yet.
                    </p>
                  ) : (
                    assignedQuestions.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="rounded-md border border-border/60 bg-background/40 p-2"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm">
                              Q{assignment.questionOrder + 1}.{" "}
                              {assignment.question.promptText}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Assignment ID: {assignment.id}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Unassign question"
                            title="Unassign question"
                            onClick={() => void unassignQuestion(assignment.id)}
                            disabled={unassigningAssignmentId === assignment.id}
                          >
                            {unassigningAssignmentId === assignment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        {assignment.question.promptAudioPath && (
                          <audio
                            key={assignment.question.promptAudioPath}
                            controls
                            preload="metadata"
                            className="h-9 w-full"
                            src={assignment.question.promptAudioPath}
                          >
                            Your browser does not support the audio element.
                          </audio>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={assigningMany}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
