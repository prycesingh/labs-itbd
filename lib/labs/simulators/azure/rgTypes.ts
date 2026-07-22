import type { BaseResource } from "./sharedTypes";

export type RgResource = BaseResource & {
  resourceType: "ResourceGroup";
  status: "Succeeded";
};
