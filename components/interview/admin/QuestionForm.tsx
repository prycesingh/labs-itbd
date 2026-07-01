"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

interface QuestionFormProps {
  moduleId: string;
  onSuccess?: () => void;
}

export function QuestionForm({ moduleId, onSuccess }: QuestionFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    promptText: "",
  });
  const [promptAudioFile, setPromptAudioFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = new FormData();
      payload.append("moduleId", moduleId);
      payload.append("promptText", formData.promptText);
      if (promptAudioFile) {
        payload.append("promptAudio", promptAudioFile);
      }

      const response = await fetch("/api/interview/admin/questions", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        throw new Error(`Failed to create question: ${response.statusText}`);
      }

      toast.success("Question created successfully");
      setFormData({ promptText: "" });
      setPromptAudioFile(null);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create question";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="promptText">Question Text</Label>
        <Textarea
          id="promptText"
          value={formData.promptText}
          onChange={(e) =>
            setFormData({ ...formData, promptText: e.target.value })
          }
          placeholder="Enter the interview question..."
          maxLength={2000}
          required
        />
      </div>

      <div>
        <Label htmlFor="promptAudio">Question Audio</Label>
        <Input
          id="promptAudio"
          type="file"
          accept="audio/*"
          required
          onChange={(e) => setPromptAudioFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Add Question"}
      </Button>
    </form>
  );
}
