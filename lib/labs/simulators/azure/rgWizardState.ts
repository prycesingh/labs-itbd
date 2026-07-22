export type RgWizardTag = { key: string; value: string };

export type RgWizardState = {
  name: string;
  region: string;
  tags: RgWizardTag[];
};

export function freshRgWizardState(): RgWizardState {
  return { name: "", region: "(US) East US", tags: [] };
}

export function validateRgWizardState(state: RgWizardState, existingNames: string[]): string[] {
  const errors: string[] = [];
  if (!state.name) errors.push("Resource group name is required.");
  else if (!/^[a-zA-Z0-9._-]{1,90}$/.test(state.name)) {
    errors.push("Name must be 1-90 alphanumeric, period, underscore, or hyphen characters.");
  } else if (existingNames.includes(state.name)) {
    errors.push("A resource group with this name already exists.");
  }
  return errors;
}
