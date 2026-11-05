import { labPracticeLabs, labPracticeTasks } from "@/DB/labPracticeSchema";
import { childrenRoutes } from "@/lib/labPractice/curriculumRoutes";
import { taskSchema } from "@/lib/validation/labPractice";

/** POST — add a task to the lab. PUT — reorder the lab's tasks. */
export const { POST, PUT } = childrenRoutes({
  param: "labId",
  parent: labPracticeLabs,
  child: labPracticeTasks,
  createSchema: taskSchema,
});
