"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface CreateModuleFormProps {
  onSuccess?: (moduleId: string) => void;
}

export function CreateModuleForm({ onSuccess }: CreateModuleFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    questionDisplayCount: 5,
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/interview/admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create module: ${response.statusText}`);
      }

      const newModule = await response.json();
      toast.success(`Module "${newModule.name}" created`, {
        description:
          "It is inactive by default. Add questions and standard responses, then activate it.",
      });

      if (onSuccess) {
        onSuccess(newModule.id);
      } else {
        router.refresh();
        setFormData({
          name: "",
          questionDisplayCount: 5,
          description: "",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create module";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Module Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Customer Service Basics"
          required
        />
      </div>

      <div>
        <Label htmlFor="displayCount">Questions to Display to Users</Label>
        <Input
          id="displayCount"
          type="number"
          min="1"
          value={formData.questionDisplayCount}
          onChange={(e) =>
            setFormData({
              ...formData,
              questionDisplayCount: parseInt(e.target.value),
            })
          }
          placeholder="e.g., 5"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Brief description of the module..."
          maxLength={1000}
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Module"}
      </Button>
    </form>
  );
}
