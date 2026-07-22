export type GpoPolicyKind = "enable-disable" | "numeric" | "text" | "list" | "enum";

export type GpoPolicyDef = {
  path: string;
  name: string;
  category: string;
  supported: string;
  helpText: string;
  kind: GpoPolicyKind;
  unit?: string;
  options?: string[];
  default?: string;
};

function computer(category: string, name: string, rest: Omit<GpoPolicyDef, "path" | "name" | "category">): GpoPolicyDef {
  return { path: `Computer/${category}/${name}`, name, category: `Computer Configuration/${category}`, ...rest };
}
function user(category: string, name: string, rest: Omit<GpoPolicyDef, "path" | "name" | "category">): GpoPolicyDef {
  return { path: `User/${category}/${name}`, name, category: `User Configuration/${category}`, ...rest };
}

export const GPO_POLICY_CATALOG: GpoPolicyDef[] = [
  computer("Administrative Templates/Control Panel", "Always open All Control Panel Items when opening Control Panel", {
    supported: "Windows 7 or later",
    helpText: "Disables the category view of Control Panel.",
    kind: "enable-disable",
  }),
  computer("Administrative Templates/Control Panel", "Hide specified Control Panel items", {
    supported: "At least Windows 2000",
    helpText: "Hides the items listed when Control Panel is opened.",
    kind: "list",
  }),
  computer("Administrative Templates/Network", "Prohibit installation and configuration of Network Bridge on your DNS domain network", {
    supported: "Windows XP or later",
    helpText: "Prevents the use of the Network Bridge feature.",
    kind: "enable-disable",
  }),
  computer("Administrative Templates/Network", "Set timeout for hung logon sessions during shutdown", {
    supported: "Windows Vista or later",
    helpText: "Timeout value in seconds.",
    kind: "numeric",
    unit: "seconds",
    default: "600",
  }),
  computer("Administrative Templates/Printers", "Allow Print Spooler to accept client connections", {
    supported: "Windows Server 2003 or later",
    helpText: "Allows the print spooler to accept client connections.",
    kind: "enable-disable",
  }),
  computer("Administrative Templates/Printers", "Disable deletion of printers", {
    supported: "Windows XP or later",
    helpText: "Prevents users from deleting local and network printers.",
    kind: "enable-disable",
  }),
  computer("Administrative Templates/System", "Remove Boot / Shutdown / Logon / Logoff status messages", {
    supported: "Windows XP or later",
    helpText: "Removes startup status messages.",
    kind: "enable-disable",
  }),
  computer("Administrative Templates/System", "Specify settings for optional component installation and component repair", {
    supported: "Windows Server 2012 or later",
    helpText: "Set the source path for Features on Demand / component repair.",
    kind: "text",
  }),
  computer("Administrative Templates/System", "Configure Automatic Updates", {
    supported: "Windows XP or later",
    helpText: "Configure how Windows Update behaves.",
    kind: "enable-disable",
  }),
  computer("Administrative Templates/System/Removable Storage Access", "All Removable Storage classes: Deny all access", {
    supported: "Windows Vista or later",
    helpText: "Denies all access to removable storage classes.",
    kind: "enable-disable",
  }),
  computer("Administrative Templates/Windows Components", "Turn off Windows Defender Antivirus", {
    supported: "Windows Vista or later",
    helpText: "Disables Microsoft Defender Antivirus.",
    kind: "enable-disable",
  }),
  computer("Administrative Templates/Windows Components", "Allow Cortana", {
    supported: "Windows 10 or later",
    helpText: "Specifies whether Cortana is allowed on the device.",
    kind: "enable-disable",
  }),
  computer("Administrative Templates/Windows Components", "Do not display the lock screen", {
    supported: "Windows 8 or later",
    helpText: "Prevents the lock screen from displaying.",
    kind: "enable-disable",
  }),
  computer("Administrative Templates/Windows Components", "Allow Telemetry", {
    supported: "Windows 10 or later",
    helpText: "Limits how much diagnostic data is sent to Microsoft.",
    kind: "enum",
    options: ["0 - Security", "1 - Basic", "2 - Enhanced", "3 - Full"],
    default: "1 - Basic",
  }),
  computer("Administrative Templates/Windows Components/Remote Desktop Services/Remote Desktop Session Host/Connections", "Allow users to connect remotely by using Remote Desktop Services", {
    supported: "Windows Server 2008 or later",
    helpText: "Controls whether users can connect remotely using Remote Desktop Services.",
    kind: "enable-disable",
  }),
  computer("Windows Settings/Security Settings/Account Policies/Password Policy", "Maximum password age", {
    supported: "All versions",
    helpText: "Maximum lifetime of a password in days.",
    kind: "numeric",
    unit: "days",
    default: "42",
  }),
  computer("Windows Settings/Security Settings/Account Policies/Password Policy", "Minimum password age", {
    supported: "All versions",
    helpText: "Minimum age of a password in days.",
    kind: "numeric",
    unit: "days",
    default: "1",
  }),
  computer("Windows Settings/Security Settings/Account Policies/Password Policy", "Minimum password length", {
    supported: "All versions",
    helpText: "Minimum number of characters in the password.",
    kind: "numeric",
    unit: "characters",
    default: "7",
  }),
  computer("Windows Settings/Security Settings/Account Policies/Password Policy", "Password must meet complexity requirements", {
    supported: "All versions",
    helpText: "Require a mix of character classes in passwords.",
    kind: "enable-disable",
  }),
  computer("Windows Settings/Security Settings/Account Policies/Password Policy", "Enforce password history", {
    supported: "All versions",
    helpText: "Number of unique new passwords required before reuse.",
    kind: "numeric",
    unit: "passwords remembered",
    default: "24",
  }),
  computer("Windows Settings/Security Settings/Account Policies/Password Policy", "Store passwords using reversible encryption", {
    supported: "All versions",
    helpText: "Required for some legacy authentication protocols.",
    kind: "enable-disable",
  }),
  computer("Windows Settings/Security Settings/Account Policies/Account Lockout Policy", "Account lockout threshold", {
    supported: "All versions",
    helpText: "Failed logon attempts that cause lockout (0 = never).",
    kind: "numeric",
    unit: "invalid attempts",
    default: "0",
  }),
  computer("Windows Settings/Security Settings/Account Policies/Account Lockout Policy", "Account lockout duration", {
    supported: "All versions",
    helpText: "Minutes the account stays locked.",
    kind: "numeric",
    unit: "minutes",
    default: "30",
  }),
  computer("Windows Settings/Security Settings/Account Policies/Account Lockout Policy", "Reset account lockout counter after", {
    supported: "All versions",
    helpText: "Minutes to wait before resetting the failed-attempt counter.",
    kind: "numeric",
    unit: "minutes",
    default: "30",
  }),
  computer("Windows Settings/Security Settings/Local Policies/Audit Policy", "Audit account logon events", {
    supported: "All versions",
    helpText: "Audit each instance of a user logging on/off using a different account whose credentials are validated.",
    kind: "enum",
    options: ["No auditing", "Success", "Failure", "Success, Failure"],
    default: "No auditing",
  }),
  computer("Windows Settings/Security Settings/Local Policies/Audit Policy", "Audit logon events", {
    supported: "All versions",
    helpText: "Audit each instance of a user logging on or off a device.",
    kind: "enum",
    options: ["No auditing", "Success", "Failure", "Success, Failure"],
    default: "No auditing",
  }),
  user("Administrative Templates/Control Panel", "Prohibit access to Control Panel and PC settings", {
    supported: "Windows XP or later",
    helpText: "Prevents users from launching Control Panel or PC Settings.",
    kind: "enable-disable",
  }),
  user("Administrative Templates/Desktop", "Hide and disable all items on the desktop", {
    supported: "Windows XP or later",
    helpText: "Removes icons, shortcuts, and other default items from the desktop.",
    kind: "enable-disable",
  }),
  user("Administrative Templates/Desktop", "Remove Recycle Bin icon from desktop", {
    supported: "Windows XP or later",
    helpText: "Removes the Recycle Bin icon from the desktop.",
    kind: "enable-disable",
  }),
  user("Administrative Templates/Start Menu and Taskbar", "Remove Run menu from Start Menu", {
    supported: "Windows XP or later",
    helpText: "Removes the Run command from the Start Menu.",
    kind: "enable-disable",
  }),
  user("Administrative Templates/Start Menu and Taskbar", "Remove access to the context menus for the taskbar", {
    supported: "Windows XP or later",
    helpText: "Disables right-click on the taskbar.",
    kind: "enable-disable",
  }),
  user("Administrative Templates/Start Menu and Taskbar", "Prevent users from customizing their Start screen", {
    supported: "Windows 8 or later",
    helpText: "Prevents users from pinning, unpinning, or reordering tiles on the Start screen.",
    kind: "enable-disable",
  }),
  user("Administrative Templates/System", "Prevent access to the command prompt", {
    supported: "Windows XP or later",
    helpText: "Prevents users from running the interactive command prompt, cmd.exe.",
    kind: "enable-disable",
  }),
  user("Administrative Templates/System", "Prevent access to registry editing tools", {
    supported: "Windows XP or later",
    helpText: "Disables the Windows registry editor, Regedit.exe.",
    kind: "enable-disable",
  }),
  user("Administrative Templates/System", "Don't run specified Windows applications", {
    supported: "Windows XP or later",
    helpText: "Prevents Windows from running the programs you specify in this policy setting.",
    kind: "list",
  }),
  user("Administrative Templates/System", "Run only specified Windows applications", {
    supported: "Windows XP or later",
    helpText: "Limits the programs that users can run to the ones you specify.",
    kind: "list",
  }),
];

export function findGpoPolicy(path: string): GpoPolicyDef | undefined {
  return GPO_POLICY_CATALOG.find((p) => p.path === path);
}

export function gpoPolicyCategories(): string[] {
  return Array.from(new Set(GPO_POLICY_CATALOG.map((p) => p.category)));
}

export function gpoPoliciesInCategory(category: string): GpoPolicyDef[] {
  return GPO_POLICY_CATALOG.filter((p) => p.category === category);
}
