import { labPracticeLabs, labPracticeModules } from "@/DB/labPracticeSchema";
import { childrenRoutes } from "@/lib/labPractice/curriculumRoutes";
import { labSchema } from "@/lib/validation/labPractice";

/** POST — add a lab to the module. PUT — reorder the module's labs. */
export const { POST, PUT } = childrenRoutes({
  param: "moduleId",
  parent: labPracticeModules,
  child: labPracticeLabs,
  createSchema: labSchema,
});
