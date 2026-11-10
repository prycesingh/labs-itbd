import { labPracticeLabs } from "@/DB/labPracticeSchema";
import { itemRoutes } from "@/lib/labPractice/curriculumRoutes";
import { labUpdateSchema } from "@/lib/validation/labPractice";

/** PATCH — edit / (de)activate a lab. */
export const { PATCH } = itemRoutes({ param: "labId", table: labPracticeLabs, updateSchema: labUpdateSchema });
