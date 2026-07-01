import { auth } from "@/auth";
import { initializeBackgroundJobs } from "@/lib/backgroundJobHandlers";
import { getSessionProcessingStatus } from "@/lib/interview/orchestration";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionIdSchema = z.string().uuid();

const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId || !sessionIdSchema.safeParse(sessionId).success) {
    return NextResponse.json(
      { error: "Valid sessionId query param is required" },
      { status: 400 },
    );
  }

  initializeBackgroundJobs();

  let interval: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let inFlight = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const closeStream = () => {
        if (closed) {
          return;
        }

        closed = true;

        if (interval) {
          clearInterval(interval);
          interval = null;
        }

        controller.close();
      };

      const pollStatus = async () => {
        if (closed || inFlight) {
          return;
        }

        inFlight = true;

        try {
          const status = await getSessionProcessingStatus(sessionId);

          controller.enqueue(
            sseEvent("progress", {
              transcriptedAnswers: status.progress.transcriptedAnswers,
              evaluatedAnswers: status.progress.evaluatedAnswers,
              totalAnswers: status.progress.totalAnswers,
              status: status.status,
              currentStep: status.progress.currentStep,
              errors: status.errors,
            }),
          );

          if (status.status === "completed") {
            controller.enqueue(
              sseEvent("complete", {
                sessionId,
                orchestrationJobId: status.orchestrationJobId,
                progress: status.progress,
              }),
            );
            closeStream();
            return;
          }

          if (status.status === "failed") {
            controller.enqueue(
              sseEvent("error", {
                sessionId,
                orchestrationJobId: status.orchestrationJobId,
                errors: status.errors,
              }),
            );
            closeStream();
          }
        } catch (error) {
          controller.enqueue(
            sseEvent("error", {
              sessionId,
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to read processing status",
            }),
          );
          closeStream();
        } finally {
          inFlight = false;
        }
      };

      request.signal.addEventListener("abort", closeStream);

      controller.enqueue(sseEvent("progress", { status: "pending" }));
      void pollStatus();
      interval = setInterval(() => {
        void pollStatus();
      }, 500);
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
      }
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
