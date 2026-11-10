import { labPracticeTasks } from "@/DB/labPracticeSchema";
import { itemRoutes } from "@/lib/labPractice/curriculumRoutes";
import { taskUpdateSchema } from "@/lib/validation/labPractice";

/** PATCH — edit / (de)activate a task. */
export const { PATCH } = itemRoutes({ param: "taskId", table: labPracticeTasks, updateSchema: taskUpdateSchema });
