"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface StandardResponse {
  id: string;
  responseText: string;
  responseOrder: number;
}

interface StandardResponsesFormProps {
  questionId: string;
  onSuccess?: () => void;
}

export function StandardResponsesForm({
  questionId,
  onSuccess,
}: StandardResponsesFormProps) {
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<StandardResponse[]>([]);
  const [formData, setFormData] = useState({
    responseText: "",
  });
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(
    null,
  );
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Load existing responses
  useEffect(() => {
    const fetchResponses = async () => {
      try {
        setLoadingResponses(true);
        setResponses([]);
        const response = await fetch(
          `/api/interview/admin/questions/${questionId}/standard-responses`,
        );
        if (response.ok) {
          const data = await response.json();
          setResponses(data);
        }
      } catch (error) {
        console.error("Failed to fetch responses:", error);
      } finally {
        setLoadingResponses(false);
      }
    };

    fetchResponses();
  }, [questionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `/api/interview/admin/questions/${questionId}/standard-responses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseText: formData.responseText,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to add response: ${response.statusText}`);
      }

      const newResponse = await response.json();
      setResponses([...responses, newResponse]);
      setFormData({ responseText: "" });
      toast.success("Standard response added");

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add response";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (responseId: string) => {
    try {
      const response = await fetch(
        `/api/interview/admin/standard-responses/${responseId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete response");
      }

      setResponses(responses.filter((r) => r.id !== responseId));
      toast.success("Response deleted");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete response";
      toast.error(message);
    }
  };

  const startEdit = (response: StandardResponse) => {
    setEditingResponseId(response.id);
    setEditingText(response.responseText);
  };

  const cancelEdit = () => {
    setEditingResponseId(null);
    setEditingText("");
  };

  const handleEditSave = async (response: StandardResponse) => {
    const trimmedText = editingText.trim();
    if (trimmedText.length === 0) {
      toast.warning("Response text cannot be empty");
      return;
    }

    try {
      setSavingEdit(true);
      const patchResponse = await fetch(
        `/api/interview/admin/standard-responses/${response.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseText: trimmedText,
            responseOrder: response.responseOrder,
          }),
        },
      );

      const payload = await patchResponse.json().catch(() => null);

      if (!patchResponse.ok) {
        throw new Error(payload?.error || "Failed to update response");
      }

      setResponses((prev) =>
        prev.map((item) =>
          item.id === response.id
            ? { ...item, responseText: trimmedText }
            : item,
        ),
      );

      toast.success("Response updated");
      cancelEdit();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update response";
      toast.error("Unable to update response", { description: message });
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing Responses List */}
      <div>
        <h3 className="font-semibold mb-4">Standard Responses</h3>
        {loadingResponses ? (
          <p className="text-sm text-muted-foreground">Loading responses...</p>
        ) : responses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No responses yet. Add one below.
          </p>
        ) : (
          <div className="space-y-2">
            {responses.map((resp) => (
              <div
                key={resp.id}
                className="flex items-start justify-between gap-2 p-3 bg-muted rounded"
              >
                <div className="flex-1">
                  {editingResponseId === resp.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                        maxLength={2000}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleEditSave(resp)}
                          disabled={savingEdit}
                        >
                          {savingEdit ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          disabled={savingEdit}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{resp.responseText}</p>
                  )}
                </div>

                {editingResponseId !== resp.id && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(resp)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(resp.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Response Form */}
      <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-muted rounded">
        <h4 className="font-medium">Add New Response</h4>

        <div>
          <Label htmlFor="responseText">Response Text</Label>
          <Textarea
            id="responseText"
            value={formData.responseText}
            onChange={(e) =>
              setFormData({ ...formData, responseText: e.target.value })
            }
            placeholder="Enter a standard response for this question..."
            maxLength={2000}
            required
          />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Response"}
        </Button>
      </form>

      {/* Minimum response requirement */}
      <p className="text-xs text-muted-foreground">
        ✓ At least 1 standard response is required per question
      </p>
    </div>
  );
}
