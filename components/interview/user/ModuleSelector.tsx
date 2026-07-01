"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, CircleDot, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Module {
  id: string;
  name: string;
  description: string | null;
  interviewType: string;
  questionDisplayCount: number;
}

interface ModuleSelectorProps {
  onModuleSelected: (moduleId: string, totalQuestions: number) => void;
}

export function ModuleSelector({ onModuleSelected }: ModuleSelectorProps) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await fetch("/api/interview/modules?active=true");
        if (response.ok) {
          const data = await response.json();
          setModules(data);
        }
      } catch (error) {
        console.error("Failed to fetch modules:", error);
        toast.error("Failed to load interview modules");
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">
          No interview modules available at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((module) => (
        <Card
          key={module.id}
          className="group relative overflow-hidden border-border/70 bg-linear-to-br from-background via-background to-muted/30"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_45%)]" />
          <CardHeader className="relative space-y-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <Badge
                variant="secondary"
                className="border border-border/70 bg-background/70 capitalize"
              >
                {module.interviewType.replace(/([A-Z])/g, " $1").trim()}
              </Badge>
              <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
                {module.questionDisplayCount} questions
              </Badge>
            </div>
            <CardTitle className="line-clamp-2 text-xl leading-tight tracking-tight">
              {module.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleDot className="h-3.5 w-3.5 text-primary" />
                Ready to start
              </div>
              <Button
                onClick={() =>
                  onModuleSelected(module.id, module.questionDisplayCount)
                }
                size="sm"
                className="gap-1.5 shadow-sm transition-transform duration-200 group-hover:translate-x-0.5"
              >
                Start
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
