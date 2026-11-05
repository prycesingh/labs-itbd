import { labPracticeSteps } from "@/DB/labPracticeSchema";
import { itemRoutes } from "@/lib/labPractice/curriculumRoutes";
import { stepUpdateSchema } from "@/lib/validation/labPractice";

/** PATCH — edit / (de)activate a step. */
export const { PATCH } = itemRoutes({ param: "stepId", table: labPracticeSteps, updateSchema: stepUpdateSchema });
