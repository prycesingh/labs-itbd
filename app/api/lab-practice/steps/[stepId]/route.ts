import { labPracticeSteps } from "@/DB/labPracticeSchema";
import { itemRoutes } from "@/lib/labPractice/curriculumRoutes";
import { stepUpdateSchema } from "@/lib/validation/labPractice";

/** PATCH — edit / (de)activate a step. DELETE — remove it if no trainee history. */
export const { PATCH, DELETE } = itemRoutes({ param: "stepId", table: labPracticeSteps, updateSchema: stepUpdateSchema });
