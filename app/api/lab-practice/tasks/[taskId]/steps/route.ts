import { labPracticeSteps, labPracticeTasks } from "@/DB/labPracticeSchema";
import { childrenRoutes } from "@/lib/labPractice/curriculumRoutes";
import { stepSchema } from "@/lib/validation/labPractice";

/** POST — add a step to the task. PUT — reorder the task's steps. */
export const { POST, PUT } = childrenRoutes({
  param: "taskId",
  parent: labPracticeTasks,
  child: labPracticeSteps,
  createSchema: stepSchema,
});
