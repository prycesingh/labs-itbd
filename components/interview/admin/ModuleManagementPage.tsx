"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  Loader2,
  Pencil,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { isAdminRole, type Role } from "@/lib/rbac";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AssignQuestionDialog } from "./AssignQuestionDialog";
import { CreateModuleForm } from "./CreateModuleForm";
import { StandardResponsesForm } from "./StandardResponsesForm";

interface InterviewModule {
  id: string;
  name: string;
  interviewType: string;
  questionDisplayCount: number;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    questions?: number;
  };
}

interface ModuleQuestionAssignment {
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
}

export default function ModuleManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [modules, setModules] = useState<InterviewModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isResponsesDeleteOpen, setIsResponsesDeleteOpen] = useState(false);
  const [modulePendingDelete, setModulePendingDelete] =
    useState<InterviewModule | null>(null);
  const [modulePendingResponsesDelete, setModulePendingResponsesDelete] =
    useState<InterviewModule | null>(null);
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [deletingResponsesModuleId, setDeletingResponsesModuleId] = useState<
    string | null
  >(null);
  const [questions, setQuestions] = useState<ModuleQuestionAssignment[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionAudioFiles, setQuestionAudioFiles] = useState<
    Record<string, File | null>
  >({});
  const [updatingQuestionId, setUpdatingQuestionId] = useState<string | null>(
    null,
  );
  const [removingAssignmentId, setRemovingAssignmentId] = useState<
    string | null
  >(null);
  const [moduleSearch, setModuleSearch] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [editingPromptText, setEditingPromptText] = useState("");
  const [savingQuestionTitleId, setSavingQuestionTitleId] = useState<
    string | null
  >(null);

  useEffect(() => {
    // Only act once the session is fully resolved. `authenticated` with a role
    // present avoids a race where `role` is briefly undefined right after the
    // status flips (which used to fire a false "access denied"). The page is
    // also protected server-side by the proxy + requireAdminPage(); this client
    // check is just UX. Uses isAdminRole so executive (and future admin roles)
    // are allowed, not only devAdmin.
    if (status !== "authenticated") return;
    const role = session?.user?.role;
    if (role && !isAdminRole(role as Role)) {
      router.push("/dashboard");
      toast.error("Access denied. Administrator role required.");
    }
  }, [session, status, router]);

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/interview/admin/modules");
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Failed to fetch modules");
      }
      const data = await res.json();
      setModules(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load modules";
      toast.error("Failed to load modules", { description: message });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchModules();
  }, [fetchModules]);

  const fetchQuestionsForModule = useCallback(async (moduleId: string) => {
    try {
      setLoadingQuestions(true);
      const res = await fetch(
        `/api/interview/admin/modules/${moduleId}/questions`,
      );

      if (!res.ok) {
        throw new Error("Failed to fetch questions");
      }

      const data = (await res.json()) as ModuleQuestionAssignment[];
      setQuestions(data);
    } catch (error) {
      setQuestions([]);
      toast.error("Failed to load questions for selected module");
      console.error(error);
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedModuleId) {
      setQuestions([]);
      return;
    }

    void fetchQuestionsForModule(selectedModuleId);
  }, [fetchQuestionsForModule, selectedModuleId]);

  const readErrorMessage = async (res: Response) => {
    try {
      const payload = await res.json();
      return payload?.error || payload?.details?.reason || "Request failed";
    } catch {
      return "Request failed";
    }
  };

  const toggleModuleStatus = async (moduleId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/interview/admin/modules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: moduleId, isActive: !isActive }),
      });

      if (!res.ok) {
        const message = await readErrorMessage(res);
        throw new Error(message);
      }

      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId ? { ...m, isActive: !isActive } : m,
        ),
      );

      toast.success(
        `Module ${!isActive ? "activated" : "deactivated"} successfully`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update module";
      toast.error("Failed to update module status", { description: message });
      console.error(error);
    }
  };

  const deleteModule = async () => {
    if (!modulePendingDelete) return;

    const moduleId = modulePendingDelete.id;

    setDeletingModuleId(moduleId);

    try {
      const res = await fetch(`/api/interview/admin/modules/${moduleId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const message = await readErrorMessage(res);
        throw new Error(message);
      }

      setModules((prev) => prev.filter((m) => m.id !== moduleId));
      if (selectedModuleId === moduleId) {
        setSelectedModuleId(null);
        setQuestions([]);
      }
      toast.success("Module deleted successfully");
      setIsDeleteOpen(false);
      setModulePendingDelete(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete module";
      toast.error("Failed to delete module", { description: message });
      console.error(error);
    } finally {
      setDeletingModuleId(null);
    }
  };

  const deleteModuleResponses = async () => {
    if (!modulePendingResponsesDelete) return;

    const moduleId = modulePendingResponsesDelete.id;

    setDeletingResponsesModuleId(moduleId);

    try {
      const res = await fetch(
        `/api/interview/admin/modules/${moduleId}/responses`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const message = await readErrorMessage(res);
        throw new Error(message);
      }

      const payload = await res.json().catch(() => null);

      toast.success("Module responses deleted successfully", {
        description: payload?.deleted
          ? `${payload.deleted.sessionsDeleted ?? 0} sessions, ${payload.deleted.answersDeleted ?? 0} answers, and related evaluations were removed.`
          : "All module response data and related evaluations were removed.",
      });

      setIsResponsesDeleteOpen(false);
      setModulePendingResponsesDelete(null);
      if (selectedModuleId === moduleId) {
        setQuestions([]);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete responses";
      toast.error("Failed to delete module responses", {
        description: message,
      });
      console.error(error);
    } finally {
      setDeletingResponsesModuleId(null);
    }
  };

  const selectedModule = useMemo(
    () => modules.find((module) => module.id === selectedModuleId) ?? null,
    [modules, selectedModuleId],
  );

  const filteredModules = useMemo(() => {
    const term = moduleSearch.trim().toLowerCase();
    if (!term) return modules;
    return modules.filter((module) => module.name.toLowerCase().includes(term));
  }, [moduleSearch, modules]);

  const moduleStats = useMemo(() => {
    const activeCount = modules.filter((module) => module.isActive).length;
    const totalQuestions = modules.reduce(
      (sum, module) => sum + (module._count?.questions ?? 0),
      0,
    );

    return {
      totalModules: modules.length,
      activeCount,
      inactiveCount: modules.length - activeCount,
      totalQuestions,
    };
  }, [modules]);

  const handleQuestionCreated = async () => {
    await fetchModules();
    if (selectedModuleId) {
      await fetchQuestionsForModule(selectedModuleId);
    }
  };

  const handleQuestionAudioFileSelect = (
    questionId: string,
    file: File | null,
  ) => {
    setQuestionAudioFiles((prev) => ({
      ...prev,
      [questionId]: file,
    }));
  };

  const updateQuestionAudio = async (questionId: string) => {
    const file = questionAudioFiles[questionId];

    if (!file) {
      toast.warning("Select an audio file first");
      return;
    }

    setUpdatingQuestionId(questionId);

    try {
      const payload = new FormData();
      payload.append("promptAudio", file);

      const response = await fetch(
        `/api/interview/admin/question-bank/${questionId}`,
        {
          method: "PATCH",
          body: payload,
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error || "Failed to update question audio");
      }

      setQuestionAudioFiles((prev) => ({
        ...prev,
        [questionId]: null,
      }));

      toast.success("Question audio and transcript updated");

      if (selectedModuleId) {
        await fetchQuestionsForModule(selectedModuleId);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update question audio";
      toast.error("Unable to update question audio", { description: message });
    } finally {
      setUpdatingQuestionId(null);
    }
  };

  const startEditingQuestionTitle = (
    questionId: string,
    currentPromptText: string,
  ) => {
    setEditingQuestionId(questionId);
    setEditingPromptText(currentPromptText);
  };

  const saveQuestionTitle = async (questionId: string) => {
    const promptText = editingPromptText.trim();

    if (!promptText) {
      toast.warning("Question title cannot be empty");
      return;
    }

    try {
      setSavingQuestionTitleId(questionId);

      const res = await fetch(
        `/api/interview/admin/question-bank/${questionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptText }),
        },
      );

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update question title");
      }

      setQuestions((prev) =>
        prev.map((entry) =>
          entry.question.id === questionId
            ? {
                ...entry,
                question: {
                  ...entry.question,
                  promptText,
                },
              }
            : entry,
        ),
      );

      toast.success("Question title updated");
      setEditingQuestionId(null);
      setEditingPromptText("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update question title";
      toast.error("Unable to update question title", { description: message });
    } finally {
      setSavingQuestionTitleId(null);
    }
  };

  const unassignQuestion = async (assignmentId: string) => {
    if (!selectedModuleId) return;

    try {
      setRemovingAssignmentId(assignmentId);
      const res = await fetch(
        `/api/interview/admin/modules/${selectedModuleId}/questions/${assignmentId}`,
        {
          method: "DELETE",
        },
      );

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to unassign question");
      }

      toast.success("Question unassigned", {
        description: payload?.moduleDeactivated
          ? "Module was auto-deactivated because active questions fell below the display requirement."
          : undefined,
      });

      await Promise.all([
        fetchModules(),
        fetchQuestionsForModule(selectedModuleId),
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to unassign question";
      toast.error("Unable to unassign question", { description: message });
    } finally {
      setRemovingAssignmentId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <main className="flex w-full flex-col gap-5 pb-4">
      <header className="rounded-xl border border-cyan-500/20 bg-linear-to-r from-cyan-900/20 via-slate-900/30 to-emerald-900/15 p-5">
        <h1 className="text-3xl"> Module Builder</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create modules and complete each module with questions, prompt audio,
          and standard responses in one workflow.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-white/10 bg-black/30 p-3">
            <p className="text-xs text-muted-foreground">Total modules</p>
            <p className="text-2xl font-semibold">{moduleStats.totalModules}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/30 p-3">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-semibold text-emerald-300">
              {moduleStats.activeCount}
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/30 p-3">
            <p className="text-xs text-muted-foreground">Inactive</p>
            <p className="text-2xl font-semibold text-amber-300">
              {moduleStats.inactiveCount}
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/30 p-3">
            <p className="text-xs text-muted-foreground">Assigned questions</p>
            <p className="text-2xl font-semibold text-cyan-300">
              {moduleStats.totalQuestions}
            </p>
          </div>
        </div>
      </header>

      <Separator className="bg-white/20" />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <Card className="border-cyan-500/20 bg-black/20">
          <CardHeader>
            <CardTitle>Create New Module</CardTitle>
            <CardDescription>
              After creating a module, immediately add questions and responses
              on this same page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateModuleForm
              onSuccess={async (newModuleId) => {
                await fetchModules();
                setSelectedModuleId(newModuleId);
                await fetchQuestionsForModule(newModuleId);
                toast.success("Module created. Continue by adding questions.");
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-black/20">
          <CardHeader>
            <CardTitle>Existing Modules</CardTitle>
            <CardDescription>
              Select a module to continue building it, activate/deactivate, or
              delete it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No modules created yet.
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={moduleSearch}
                    onChange={(event) => setModuleSearch(event.target.value)}
                    placeholder="Search modules"
                    className="pl-9"
                  />
                </div>

                <Select
                  value={selectedModuleId ?? ""}
                  onValueChange={(value) => setSelectedModuleId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredModules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                  {filteredModules.map((module) => (
                    <Card
                      key={module.id}
                      className={`border-cyan-500/20 bg-black/25 ${
                        selectedModuleId === module.id
                          ? "ring-1 ring-cyan-400/50"
                          : ""
                      }`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{module.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Questions: {module._count?.questions || 0} |
                              Display: {module.questionDisplayCount}
                            </p>
                          </div>
                          <Badge
                            variant={module.isActive ? "default" : "secondary"}
                            className={
                              module.isActive
                                ? "bg-green-600/80"
                                : "bg-red-600/80"
                            }
                          >
                            {module.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Button
                            size="sm"
                            className="gap-1"
                            variant={
                              selectedModuleId === module.id
                                ? "default"
                                : "secondary"
                            }
                            onClick={() => setSelectedModuleId(module.id)}
                          >
                            {selectedModuleId === module.id
                              ? "Selected"
                              : "Build"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() =>
                              toggleModuleStatus(module.id, module.isActive)
                            }
                          >
                            {module.isActive ? (
                              <>
                                <ToggleRight className="h-3 w-3" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="h-3 w-3" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                            onClick={() => {
                              setModulePendingDelete(module);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-1 border-amber-500/40 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
                            onClick={() => {
                              setModulePendingResponsesDelete(module);
                              setIsResponsesDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete Responses
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredModules.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No module matches your search.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedModule && (
        <Card className="border-cyan-500/20 bg-black/20">
          <CardHeader>
            <CardTitle>Build Module: {selectedModule.name}</CardTitle>
            <CardDescription>
              Assign questions from the bank, manage prompt audio, and define
              standard responses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-md border border-white/10 bg-black/30 p-4">
              <AssignQuestionDialog
                moduleId={selectedModule.id}
                onSuccess={handleQuestionCreated}
              />
            </div>

            {loadingQuestions ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading questions...
              </div>
            ) : questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No questions assigned yet for this module.
              </p>
            ) : (
              <div className="space-y-4">
                {questions.map((question) => {
                  const hasPersistedTranscript =
                    Boolean(question.question.promptTranscript) &&
                    String(question.question.promptTranscript).trim().length >
                      0;

                  return (
                    <Card
                      key={question.id}
                      className="border-white/10 bg-black/25"
                    >
                      <CardHeader>
                        <CardTitle className="text-base">
                          Question {question.questionOrder + 1}
                        </CardTitle>
                        {editingQuestionId === question.question.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingPromptText}
                              onChange={(event) =>
                                setEditingPromptText(event.target.value)
                              }
                              rows={3}
                              maxLength={2000}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  void saveQuestionTitle(question.question.id)
                                }
                                disabled={
                                  savingQuestionTitleId === question.question.id
                                }
                              >
                                <Check className="mr-1 h-3.5 w-3.5" />
                                {savingQuestionTitleId === question.question.id
                                  ? "Saving..."
                                  : "Save Title"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingQuestionId(null);
                                  setEditingPromptText("");
                                }}
                                disabled={
                                  savingQuestionTitleId === question.question.id
                                }
                              >
                                <X className="mr-1 h-3.5 w-3.5" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <CardDescription className="space-y-2">
                            <span className="block">
                              {question.question.promptText}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-fit"
                              onClick={() =>
                                startEditingQuestionTitle(
                                  question.question.id,
                                  question.question.promptText,
                                )
                              }
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit Title
                            </Button>
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => unassignQuestion(question.id)}
                            disabled={removingAssignmentId === question.id}
                          >
                            <Unlink className="mr-2 h-4 w-4" />
                            {removingAssignmentId === question.id
                              ? "Unassigning..."
                              : "Unassign"}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Current uploaded audio
                          </p>
                          {question.question.promptAudioPath ? (
                            <audio
                              key={question.question.promptAudioPath}
                              controls
                              preload="metadata"
                              className="w-full"
                              src={question.question.promptAudioPath}
                            >
                              Your browser does not support the audio element.
                            </audio>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No question audio uploaded yet.
                            </p>
                          )}
                        </div>

                        <div className="space-y-2 rounded-md border border-white/10 bg-black/30 p-3">
                          <p className="text-xs text-muted-foreground">
                            Replace audio file
                          </p>
                          <Input
                            type="file"
                            accept="audio/*"
                            onChange={(e) =>
                              handleQuestionAudioFileSelect(
                                question.question.id,
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              updateQuestionAudio(question.question.id)
                            }
                            disabled={
                              updatingQuestionId === question.question.id ||
                              !questionAudioFiles[question.question.id]
                            }
                          >
                            {updatingQuestionId === question.question.id
                              ? "Updating..."
                              : "Save Audio Change"}
                          </Button>

                          {hasPersistedTranscript && (
                            <p className="text-xs text-green-400">
                              Transcript ready
                            </p>
                          )}
                          {!hasPersistedTranscript && (
                            <p className="text-xs text-yellow-400">
                              Transcript missing. Upload audio to regenerate.
                            </p>
                          )}
                        </div>

                        <StandardResponsesForm
                          questionId={question.question.id}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open && !deletingModuleId) {
            setModulePendingDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Module</DialogTitle>
            <DialogDescription>
              {modulePendingDelete
                ? `Are you sure you want to delete "${modulePendingDelete.name}"? This action cannot be undone.`
                : "Are you sure you want to delete this module?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={Boolean(deletingModuleId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={deleteModule}
              disabled={!modulePendingDelete || Boolean(deletingModuleId)}
            >
              {deletingModuleId ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isResponsesDeleteOpen}
        onOpenChange={(open) => {
          setIsResponsesDeleteOpen(open);
          if (!open && !deletingResponsesModuleId) {
            setModulePendingResponsesDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Module Responses</DialogTitle>
            <DialogDescription>
              {modulePendingResponsesDelete
                ? `This will permanently remove all user responses, AI evaluations, admin evaluations, and session summaries for "${modulePendingResponsesDelete.name}". The module and questions will remain.`
                : "This will permanently remove all responses for this module."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResponsesDeleteOpen(false)}
              disabled={Boolean(deletingResponsesModuleId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={deleteModuleResponses}
              disabled={
                !modulePendingResponsesDelete ||
                Boolean(deletingResponsesModuleId)
              }
            >
              {deletingResponsesModuleId ? "Deleting..." : "Delete Responses"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
