import { labPracticeLabs } from "@/DB/labPracticeSchema";
import { itemRoutes } from "@/lib/labPractice/curriculumRoutes";
import { labUpdateSchema } from "@/lib/validation/labPractice";

/** PATCH — edit / (de)activate a lab. DELETE — remove it if no trainee history. */
export const { PATCH, DELETE } = itemRoutes({ param: "labId", table: labPracticeLabs, updateSchema: labUpdateSchema });
