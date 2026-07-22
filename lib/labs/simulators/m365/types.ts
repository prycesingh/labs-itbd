export type M365Tenant = {
  name: string;
  domain: string;
  tenantId: string;
  directoryName: string;
  createdOn: string;
  region: string;
  language: string;
};

export type M365AcceptedDomain = {
  name: string;
  type: "Authoritative" | "Internal relay";
  isDefault: boolean;
};

export type M365User = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  username: string;
  domain: string;
  upn: string;
  jobTitle: string;
  department: string;
  officeLocation: string;
  manager: string | null;
  accountEnabled: boolean;
  mfaEnabled: boolean;
  licenses: string[];
  roles: string[];
  createdDate: string;
  lastSignIn: string;
  signInBlocked: boolean;
  mobile: string;
  businessPhone: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  usageLocation: string;
  aboutMe: string;
  deletedOn?: string;
};

export type M365GroupType = "Microsoft 365" | "Distribution" | "Mail-enabled security" | "Security";

export type M365Group = {
  id: string;
  name: string;
  email: string;
  type: M365GroupType;
  privacy: "Public" | "Private";
  source: "Cloud";
  membership: "Assigned" | "Dynamic";
  description: string;
  owners: string[];
  members: string[];
  allowExternalSenders?: boolean;
  autoSubscribe?: boolean;
  hideFromGAL?: boolean;
};

export type M365SharedMailbox = {
  id: string;
  alias: string;
  email: string;
  displayName: string;
  members: string[];
  quotaGB: number;
  usedGB: number;
};

export type M365License = {
  sku: string;
  name: string;
  purchased: number;
  monthly: number;
  status: "Active" | "Cancelled";
  purchaseDate: string;
  renewalDate: string;
  billingCycle: "Monthly" | "Annual";
  renewalMode?: "Auto-renew" | "Manual" | "Cancel at end of term";
};

export type M365DistributionGroup = {
  name: string;
  email: string;
  members: number;
  type: "Distribution" | "MailSecurity" | "DynamicDistribution";
  hiddenFromGAL: boolean;
};

export type M365TransportRule = {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: string;
  action: string;
};

export type M365Connector = {
  name: string;
  type: "Inbound" | "Outbound";
  fromTo: string;
  enabled: boolean;
  tls: "Required" | "Opportunistic";
};

export type M365RemoteDomain = {
  name: string;
  domain: string;
  allowAutoReply: boolean;
  allowOOF: boolean;
};

export type M365Mailbox = {
  user: string;
  email: string;
  displayName: string;
  type: "User mailbox" | "Shared mailbox" | "Room mailbox" | "Equipment mailbox";
  sizeMB: number;
  quotaGB: number;
  archive: boolean;
  forwarding: string;
  litigationHold: boolean;
};

export type M365Exchange = {
  acceptedDomains: M365AcceptedDomain[];
  distributionGroups: M365DistributionGroup[];
  transportRules: M365TransportRule[];
  connectors: M365Connector[];
  remoteDomains: M365RemoteDomain[];
  mailboxes: M365Mailbox[];
};

export type M365SensitivityLabel = "General" | "Confidential" | "Highly Confidential" | "Public";
export type M365SharingLevel = "Anyone" | "NewAndExistingGuests" | "ExistingGuests" | "OnlyPeopleInYourOrg" | "Disabled";

export type M365SharepointSite = {
  id: string;
  name: string;
  url: string;
  template: "Team site" | "Communication site";
  owner: string;
  members: number;
  storageGB: number;
  quotaGB: number;
  lastActivity: string;
  sensitivity: M365SensitivityLabel;
  sharing: M365SharingLevel;
  deletedOn?: string;
};

export type M365SharepointSettings = {
  defaultSharing: M365SharingLevel;
  guestLinkExpiry: number;
  requireSignInAfter: number;
  defaultStorageGB: number;
  allowAnonymousFiles: boolean;
  allowAnonymousFolders: boolean;
  siteCreationEnabled: boolean;
};

export type M365Team = {
  id: string;
  name: string;
  privacy: "Private" | "Public" | "Org-wide";
  owners: string[];
  members: number;
  channels: string[];
  description: string;
  archived: boolean;
  classification: string;
};

export type M365TeamsPolicy = {
  name: string;
  type: "Default" | "Custom";
  allowMeetingChat: boolean;
  allowPrivateChannels: boolean;
  allowGuestAccess: boolean;
  allowExternalAccess: boolean;
};

export type M365MeetingPolicy = {
  name: string;
  type: "Default" | "Custom";
  allowAnonymousJoin: boolean;
  allowCloudRecording: boolean;
  allowTranscription: boolean;
  whoCanPresent: "Everyone" | "OrganizerOnly" | "PeopleInMyOrg";
  autoAdmittedUsers: "EveryoneInCompany" | "OrganizerOnly" | "Everyone";
};

export type M365TeamsOrgSettings = {
  emailIntegration: boolean;
  allowAppsInTeams: boolean;
  allowExternalApps: boolean;
  allowSideloading: boolean;
  tagsManagedBy: string;
  cloudStorageProviders: string[];
  allowSkypeFallback: boolean;
  allowOrgWideTeams: boolean;
  translation: boolean;
};

export type M365ActivityEntry = {
  time: string;
  actor: string;
  action: string;
  target: string;
};

export type M365ConditionalAccessPolicy = {
  name: string;
  state: "On" | "Off" | "Report-only";
  users: string;
  apps: string;
  conditions: string;
  grant: string;
  session: string;
};

export type M365NamedLocation = {
  name: string;
  kind: "IP range" | "Country";
  value: string;
  trusted: boolean;
};

export type M365Security = {
  conditionalAccessPolicies: M365ConditionalAccessPolicy[];
  namedLocations: M365NamedLocation[];
  secureScore: { current: number; max: number };
  secureScoreCategories: { category: string; current: number; max: number }[];
};

export type M365Domain = {
  name: string;
  type: "Authoritative" | "Internal relay";
  isDefault: boolean;
  status: "Healthy" | "Issues" | "Pending verification";
  verified: boolean;
  purpose: { email: boolean; sharepoint: boolean; teams: boolean; defenderId: boolean; intuneMdm: boolean };
  dnsManagement: "Managed by Microsoft" | "Unmanaged";
  registrar: string;
  addedOn: string;
  verificationTxt: string;
};

export type M365OfficeDeployConfig = {
  deploymentName: string;
  updateChannel: "Current" | "Monthly Enterprise" | "Semi-Annual Enterprise" | "Semi-Annual Enterprise (Preview)" | "Current Preview" | "Beta";
  architecture: "64-bit" | "32-bit";
  migrateArch: boolean;
  products: string[];
  excludedApps: string[];
  languages: string[];
  installOptions: { silent: boolean; forceUpgrade: boolean; removeMsi: boolean };
  updateSettings: { autoUpdate: boolean };
  source: "CDN" | "Local network share";
  orgName: string;
};

export type M365State = {
  tenant: M365Tenant;
  acceptedDomains: M365AcceptedDomain[];
  roles: string[];
  users: M365User[];
  groups: M365Group[];
  licenses: M365License[];
  sharedMailboxes: M365SharedMailbox[];
  exchange: M365Exchange;
  sharepointSites: M365SharepointSite[];
  sharepointSettings: M365SharepointSettings;
  teams: M365Team[];
  teamsPolicies: M365TeamsPolicy[];
  teamsMeetingPolicies: M365MeetingPolicy[];
  teamsOrgSettings: M365TeamsOrgSettings;
  deletedUsers: M365User[];
  deletedSites: M365SharepointSite[];
  activityLog: M365ActivityEntry[];
  domains: M365Domain[];
  security: M365Security;
  officeDeploy: M365OfficeDeployConfig;
};
