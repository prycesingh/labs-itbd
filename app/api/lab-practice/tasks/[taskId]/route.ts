import { labPracticeTasks } from "@/DB/labPracticeSchema";
import { itemRoutes } from "@/lib/labPractice/curriculumRoutes";
import { taskUpdateSchema } from "@/lib/validation/labPractice";

/** PATCH — edit / (de)activate a task. DELETE — remove it if no trainee history. */
export const { PATCH, DELETE } = itemRoutes({ param: "taskId", table: labPracticeTasks, updateSchema: taskUpdateSchema });
