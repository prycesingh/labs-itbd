export type NsgWizardTag = { key: string; value: string };

export type NsgWizardState = {
  resourceGroup: string;
  nsgName: string;
  region: string;
  tags: NsgWizardTag[];
};

export function freshNsgWizardState(): NsgWizardState {
  return { resourceGroup: "", nsgName: "", region: "(US) East US", tags: [] };
}

export function validateNsgWizardState(state: NsgWizardState): string[] {
  const errors: string[] = [];
  if (!state.nsgName) errors.push("Network security group name is required.");
  else if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(state.nsgName)) {
    errors.push("NSG name must be 1-80 alphanumeric, underscore, period, or hyphen.");
  }
  if (!state.resourceGroup) errors.push("Resource group is required. Create one on the Resource groups page.");
  return errors;
}
