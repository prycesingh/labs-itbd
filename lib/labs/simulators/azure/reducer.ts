import type { AppServiceResource, ConnectionString } from "./appServiceTypes";
import type { AzureResource, AzureSimState } from "./azureState";
import type { LbBackendPool, LbBackendTarget, LbHealthProbe, LbFrontendConfig, LbNatRule, LbOutboundRule, LbResource, LbRule } from "./lbTypes";
import type { NsgResource, NsgRule } from "./nsgTypes";
import { DEFAULT_POLICY_COMPLIANCE, VM_SIZES } from "./vmData";
import { APP_SERVICE_TIERS } from "./appServiceData";
import { defaultBootDiag, type VmAlertRule, type VmExtension, type VmRestorePoint, type VmResource } from "./types";
import type { RgResource } from "./rgTypes";
import type { ActivityLogEntry } from "./sharedTypes";
import type { VnetAlertRule, VnetDdosAttack, VnetPeering, VnetResource, VnetSubnet } from "./vnetTypes";
import { DTU_TIERS, VCORE_TIERS } from "./sqlData";
import type { SqlAlertRule, SqlDiagSetting, SqlFirewallRule, SqlResource } from "./sqlTypes";
import { randomKey } from "./storageData";
import type {
  StorageAlertRule,
  StorageContainer,
  StorageFileShare,
  StorageFrontDoorProfile,
  StorageInventoryRule,
  StorageIpRule,
  StorageLifecycleRule,
  StorageObjectReplRule,
  StoragePrivateEndpoint,
  StorageQueue,
  StorageResource,
  StorageSasState,
  StorageTable,
  StorageVnetRule,
} from "./storageTypes";

export type LbChildKey = "frontendConfigs" | "backendPools" | "healthProbes" | "lbRules" | "natRules" | "outboundRules";
export type VnetChildKey = "subnets" | "peerings" | "alertRules";
export type SqlChildKey = "alertRules" | "diagSettings";
export type StorageChildKey =
  | "containers"
  | "fileShares"
  | "queues"
  | "tables"
  | "networkVnets"
  | "networkIps"
  | "privateEndpoints"
  | "lifecycleRules"
  | "objectReplRules"
  | "inventoryRules"
  | "alertRules";

export type AzureAction =
  | { type: "LOAD_STATE"; state: AzureSimState }
  | { type: "CREATE_RESOURCE"; resource: AzureResource }
  | { type: "DELETE_RESOURCE"; id: string }
  | { type: "ADD_TAG"; id: string; key: string; value: string }
  | { type: "DELETE_TAG"; id: string; key: string }
  | { type: "SET_STATUS"; id: string; status: "Running" | "Stopped" }
  | { type: "RESIZE_VM"; id: string; size: string }
  | { type: "ADD_EXTENSION"; id: string; extension: VmExtension }
  | { type: "TOGGLE_EXTENSION"; id: string; index: number }
  | { type: "DELETE_EXTENSION"; id: string; index: number }
  | { type: "TOGGLE_BOOT_DIAG"; id: string; enabled: boolean }
  | { type: "ADD_RESTORE_POINT"; id: string; restorePoint: VmRestorePoint }
  | { type: "DELETE_RESTORE_POINT"; id: string; index: number }
  | { type: "ENABLE_ASR"; id: string; targetRegion: string; policy: string }
  | { type: "DISABLE_ASR"; id: string }
  | { type: "ADD_ALERT_RULE"; id: string; rule: VmAlertRule }
  | { type: "TOGGLE_ALERT_RULE"; id: string; index: number }
  | { type: "DELETE_ALERT_RULE"; id: string; index: number }
  | { type: "SAVE_NSG_RULE"; id: string; direction: "Inbound" | "Outbound"; rule: NsgRule }
  | { type: "DELETE_NSG_RULE"; id: string; direction: "Inbound" | "Outbound"; ruleId: string }
  | { type: "DISSOCIATE_NIC"; id: string; nic: string }
  | { type: "DISSOCIATE_SUBNET"; id: string; subnet: string }
  | { type: "SET_APP_STATUS"; id: string; status: "Running" | "Stopped" }
  | { type: "CHANGE_APP_TIER"; id: string; tierId: string }
  | { type: "SET_APP_INSTANCES"; id: string; instances: number; log: boolean }
  | { type: "SET_APP_SETTING"; id: string; key: string; value: string }
  | { type: "DELETE_APP_SETTING"; id: string; key: string }
  | { type: "ADD_CONNECTION_STRING"; id: string; connectionString: ConnectionString }
  | { type: "DELETE_CONNECTION_STRING"; id: string; index: number }
  | { type: "ADD_APP_SLOT"; id: string; name: string }
  | { type: "DELETE_APP_SLOT"; id: string; name: string }
  | { type: "ADD_CUSTOM_DOMAIN"; id: string; domain: string }
  | { type: "DELETE_CUSTOM_DOMAIN"; id: string; domain: string }
  | { type: "ADD_CORS_ORIGIN"; id: string; origin: string }
  | { type: "DELETE_CORS_ORIGIN"; id: string; index: number }
  | { type: "TOGGLE_APP_INSIGHTS"; id: string; enabled: boolean }
  | { type: "ADD_LB_FRONTEND"; id: string; config: LbFrontendConfig }
  | { type: "DELETE_LB_FRONTEND"; id: string; index: number }
  | { type: "ADD_LB_BACKEND_POOL"; id: string; pool: LbBackendPool }
  | { type: "DELETE_LB_BACKEND_POOL"; id: string; index: number }
  | { type: "ADD_LB_POOL_TARGET"; id: string; poolIndex: number; target: LbBackendTarget }
  | { type: "DELETE_LB_POOL_TARGET"; id: string; poolIndex: number; targetIndex: number }
  | { type: "ADD_LB_PROBE"; id: string; probe: LbHealthProbe }
  | { type: "DELETE_LB_PROBE"; id: string; index: number }
  | { type: "ADD_LB_RULE"; id: string; rule: LbRule }
  | { type: "DELETE_LB_RULE"; id: string; index: number }
  | { type: "ADD_LB_NAT_RULE"; id: string; rule: LbNatRule }
  | { type: "DELETE_LB_NAT_RULE"; id: string; index: number }
  | { type: "ADD_LB_OUTBOUND_RULE"; id: string; rule: LbOutboundRule }
  | { type: "DELETE_LB_OUTBOUND_RULE"; id: string; index: number }
  | { type: "ADD_VNET_ADDRESS_SPACE"; id: string; cidr: string }
  | { type: "REMOVE_VNET_ADDRESS_SPACE"; id: string; index: number }
  | { type: "SET_VNET_ADDRESS_SPACES"; id: string; cidrs: string[] }
  | { type: "ADD_VNET_SUBNET"; id: string; subnet: VnetSubnet }
  | { type: "UPDATE_VNET_SUBNET"; id: string; index: number; subnet: VnetSubnet }
  | { type: "DELETE_VNET_SUBNET"; id: string; index: number }
  | { type: "TOGGLE_VNET_SUBNET_ENDPOINT"; id: string; index: number; endpoint: string }
  | { type: "SET_VNET_DDOS"; id: string; enabled: boolean }
  | { type: "SET_VNET_DDOS_TIER"; id: string; tier: VnetResource["ddosTier"] }
  | { type: "LINK_VNET_DDOS_PLAN"; id: string; plan: string; attackHistory: VnetDdosAttack[] }
  | { type: "SET_VNET_FIREWALL"; id: string; enabled: boolean; tier?: VnetResource["firewallTier"] }
  | { type: "ADD_VNET_PEERING"; id: string; peering: VnetPeering }
  | { type: "DELETE_VNET_PEERING"; id: string; index: number }
  | { type: "SET_VNET_DNS_MODE"; id: string; mode: "Azure-provided" | "Custom" }
  | { type: "SET_VNET_DNS_SERVERS"; id: string; servers: string[] }
  | { type: "ADD_VNET_ALERT_RULE"; id: string; rule: VnetAlertRule }
  | { type: "TOGGLE_VNET_ALERT_RULE"; id: string; index: number }
  | { type: "DELETE_VNET_ALERT_RULE"; id: string; index: number }
  | { type: "SET_SQL_FIREWALL_RULES"; id: string; rules: SqlFirewallRule[] }
  | { type: "CHANGE_SQL_TIER"; id: string; model: "DTU" | "vCore"; tierId: string }
  | { type: "SET_SQL_LTR"; id: string; weekly: number; monthly: number; yearly: number }
  | { type: "TOGGLE_SQL_AUDIT"; id: string; enabled: boolean }
  | { type: "SET_SQL_AUDIT_RETENTION"; id: string; days: number }
  | { type: "TOGGLE_SQL_DEFENDER"; id: string }
  | { type: "SET_SQL_TDE"; id: string; option: SqlResource["tdeOption"] }
  | { type: "ADD_SQL_ALERT_RULE"; id: string; rule: SqlAlertRule }
  | { type: "TOGGLE_SQL_ALERT_RULE"; id: string; index: number }
  | { type: "DELETE_SQL_ALERT_RULE"; id: string; index: number }
  | { type: "ADD_SQL_DIAG_SETTING"; id: string; setting: SqlDiagSetting }
  | { type: "DELETE_SQL_DIAG_SETTING"; id: string; index: number }
  | { type: "ROTATE_STORAGE_KEY"; id: string; key: "key1" | "key2" }
  | { type: "ADD_STORAGE_CONTAINER"; id: string; container: StorageContainer }
  | { type: "DELETE_STORAGE_CONTAINER"; id: string; name: string }
  | { type: "ADD_STORAGE_FILE_SHARE"; id: string; share: StorageFileShare }
  | { type: "DELETE_STORAGE_FILE_SHARE"; id: string; name: string }
  | { type: "ADD_STORAGE_QUEUE"; id: string; queue: StorageQueue }
  | { type: "DELETE_STORAGE_QUEUE"; id: string; name: string }
  | { type: "ADD_STORAGE_TABLE"; id: string; table: StorageTable }
  | { type: "DELETE_STORAGE_TABLE"; id: string; name: string }
  | { type: "UPDATE_STORAGE_CONFIG"; id: string; key: keyof StorageResource; value: StorageResource[keyof StorageResource] }
  | { type: "SET_STORAGE_SAS"; id: string; sas: StorageSasState }
  | { type: "ADD_STORAGE_VNET_RULE"; id: string; rule: StorageVnetRule }
  | { type: "DELETE_STORAGE_VNET_RULE"; id: string; index: number }
  | { type: "ADD_STORAGE_IP_RULE"; id: string; rule: StorageIpRule }
  | { type: "DELETE_STORAGE_IP_RULE"; id: string; index: number }
  | { type: "ADD_STORAGE_PRIVATE_ENDPOINT"; id: string; endpoint: StoragePrivateEndpoint }
  | { type: "DELETE_STORAGE_PRIVATE_ENDPOINT"; id: string; index: number }
  | { type: "SET_STORAGE_NETWORK_ACCESS"; id: string; value: string }
  | { type: "ADD_STORAGE_LIFECYCLE_RULE"; id: string; rule: StorageLifecycleRule }
  | { type: "TOGGLE_STORAGE_LIFECYCLE_RULE"; id: string; index: number }
  | { type: "DELETE_STORAGE_LIFECYCLE_RULE"; id: string; index: number }
  | { type: "LINK_STORAGE_FRONT_DOOR"; id: string; profile: StorageFrontDoorProfile }
  | { type: "UNLINK_STORAGE_FRONT_DOOR"; id: string }
  | { type: "SET_STORAGE_DEFENDER"; id: string; defender: StorageResource["defenderForStorage"] }
  | { type: "ADD_STORAGE_OBJECT_REPL_RULE"; id: string; rule: StorageObjectReplRule }
  | { type: "DELETE_STORAGE_OBJECT_REPL_RULE"; id: string; index: number }
  | { type: "ADD_STORAGE_INVENTORY_RULE"; id: string; rule: StorageInventoryRule }
  | { type: "DELETE_STORAGE_INVENTORY_RULE"; id: string; index: number }
  | { type: "ADD_STORAGE_ALERT_RULE"; id: string; rule: StorageAlertRule }
  | { type: "TOGGLE_STORAGE_ALERT_RULE"; id: string; index: number }
  | { type: "DELETE_STORAGE_ALERT_RULE"; id: string; index: number };

function logActivity(
  log: ActivityLogEntry[],
  operation: string,
  resource: string,
  status: ActivityLogEntry["status"] = "Succeeded",
): ActivityLogEntry[] {
  return [{ timestamp: new Date().toISOString(), operation, resource, caller: "you", status }, ...log].slice(
    0,
    200,
  );
}

function updateResource(
  state: AzureSimState,
  id: string,
  updater: (resource: AzureResource) => AzureResource,
): AzureSimState {
  return {
    ...state,
    resources: state.resources.map((r) => (r.id === id ? updater(r) : r)),
  };
}

/** VM-only actions narrow to VmResource; a non-VM id is a no-op (defensive — the UI never dispatches these against a non-VM). */
function updateVm(state: AzureSimState, id: string, updater: (vm: VmResource) => VmResource): AzureSimState {
  return updateResource(state, id, (r) => (r.resourceType === "VirtualMachine" ? updater(r) : r));
}

function updateNsg(state: AzureSimState, id: string, updater: (nsg: NsgResource) => NsgResource): AzureSimState {
  return updateResource(state, id, (r) =>
    r.resourceType === "NetworkSecurityGroup" ? { ...updater(r), lastModified: new Date().toISOString() } : r,
  );
}

function updateApp(
  state: AzureSimState,
  id: string,
  updater: (app: AppServiceResource) => AppServiceResource,
): AzureSimState {
  return updateResource(state, id, (r) => (r.resourceType === "AppService" ? updater(r) : r));
}

function updateLb(state: AzureSimState, id: string, updater: (lb: LbResource) => LbResource): AzureSimState {
  return updateResource(state, id, (r) => (r.resourceType === "LoadBalancer" ? updater(r) : r));
}

function addLbChild<K extends LbChildKey>(state: AzureSimState, id: string, key: K, item: LbResource[K][number]) {
  const lb = state.resources.find((r) => r.id === id);
  const next = updateLb(state, id, (r) => ({ ...r, [key]: [...r[key], item] }));
  return { ...next, activityLog: lb ? logActivity(state.activityLog, "Update", lb.name) : state.activityLog };
}

function deleteLbChild<K extends LbChildKey>(state: AzureSimState, id: string, key: K, index: number) {
  const lb = state.resources.find((r) => r.id === id);
  const next = updateLb(state, id, (r) => ({ ...r, [key]: r[key].filter((_, i) => i !== index) }));
  return { ...next, activityLog: lb ? logActivity(state.activityLog, "Update", lb.name) : state.activityLog };
}

function updateVnet(state: AzureSimState, id: string, updater: (vnet: VnetResource) => VnetResource): AzureSimState {
  return updateResource(state, id, (r) => (r.resourceType === "VirtualNetwork" ? updater(r) : r));
}

function addVnetChild<K extends VnetChildKey>(state: AzureSimState, id: string, key: K, item: VnetResource[K][number]) {
  const vnet = state.resources.find((r) => r.id === id);
  const next = updateVnet(state, id, (r) => ({ ...r, [key]: [...r[key], item] }));
  return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Update", vnet.name) : state.activityLog };
}

function deleteVnetChild<K extends VnetChildKey>(state: AzureSimState, id: string, key: K, index: number) {
  const vnet = state.resources.find((r) => r.id === id);
  const next = updateVnet(state, id, (r) => ({ ...r, [key]: r[key].filter((_, i) => i !== index) }));
  return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Update", vnet.name) : state.activityLog };
}

function updateSql(state: AzureSimState, id: string, updater: (sql: SqlResource) => SqlResource): AzureSimState {
  return updateResource(state, id, (r) => (r.resourceType === "SqlDatabase" ? updater(r) : r));
}

function addSqlChild<K extends SqlChildKey>(state: AzureSimState, id: string, key: K, item: SqlResource[K][number]) {
  return updateSql(state, id, (r) => ({ ...r, [key]: [...r[key], item] }));
}

function deleteSqlChild<K extends SqlChildKey>(state: AzureSimState, id: string, key: K, index: number) {
  return updateSql(state, id, (r) => ({ ...r, [key]: r[key].filter((_, i) => i !== index) }));
}

function updateStorage(state: AzureSimState, id: string, updater: (sa: StorageResource) => StorageResource): AzureSimState {
  return updateResource(state, id, (r) => (r.resourceType === "StorageAccount" ? updater(r) : r));
}

function addStorageChild<K extends StorageChildKey>(state: AzureSimState, id: string, key: K, item: StorageResource[K][number]) {
  const sa = state.resources.find((r) => r.id === id);
  const next = updateStorage(state, id, (r) => ({ ...r, [key]: [...r[key], item] }));
  return { ...next, activityLog: sa ? logActivity(state.activityLog, "Update", sa.name) : state.activityLog };
}

function deleteStorageChildByIndex<K extends StorageChildKey>(state: AzureSimState, id: string, key: K, index: number) {
  return updateStorage(state, id, (r) => ({ ...r, [key]: r[key].filter((_, i) => i !== index) }));
}

export function azureReducer(state: AzureSimState, action: AzureAction): AzureSimState {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;

    case "CREATE_RESOURCE":
      return {
        resources: [...state.resources, action.resource],
        activityLog: logActivity(state.activityLog, "Create", action.resource.name),
      };

    case "DELETE_RESOURCE": {
      const target = state.resources.find((r) => r.id === action.id);
      if (!target) return state;
      // Deleting a resource group also deletes everything inside it, matching real Azure.
      const idsToRemove = new Set([action.id]);
      if (target.resourceType === "ResourceGroup") {
        state.resources
          .filter((r) => r.resourceGroup === target.name && r.resourceType !== "ResourceGroup")
          .forEach((r) => idsToRemove.add(r.id));
      }
      return {
        resources: state.resources.filter((r) => !idsToRemove.has(r.id)),
        activityLog: logActivity(state.activityLog, "Delete", target.name),
      };
    }

    case "ADD_TAG":
      return updateResource(state, action.id, (r) => ({
        ...r,
        tags: { ...r.tags, [action.key]: action.value },
      }));

    case "DELETE_TAG":
      return updateResource(state, action.id, (r) => {
        const tags = { ...r.tags };
        delete tags[action.key];
        return { ...r, tags };
      });

    case "SET_STATUS": {
      const vm = state.resources.find((r) => r.id === action.id);
      if (!vm || vm.resourceType !== "VirtualMachine") return state;
      const op = action.status === "Running" ? (vm.status === "Stopped" ? "Start" : "Restart") : "Stop";
      return {
        ...updateVm(state, action.id, (r) => ({ ...r, status: action.status })),
        activityLog: logActivity(state.activityLog, op, vm.name),
      };
    }

    case "RESIZE_VM": {
      const size = VM_SIZES.find((s) => s.name === action.size);
      if (!size) return state;
      const vm = state.resources.find((r) => r.id === action.id);
      return {
        ...updateVm(state, action.id, (r) => ({
          ...r,
          size: size.name,
          vcpus: size.vcpus,
          ram: size.ram,
          estimatedCost: size.cost,
        })),
        activityLog: vm ? logActivity(state.activityLog, "Resize", vm.name) : state.activityLog,
      };
    }

    case "ADD_EXTENSION":
      return updateVm(state, action.id, (r) => ({
        ...r,
        extensions: [...r.extensions, action.extension],
      }));

    case "TOGGLE_EXTENSION":
      return updateVm(state, action.id, (r) => ({
        ...r,
        extensions: r.extensions.map((e, i) =>
          i === action.index
            ? { ...e, state: e.state === "Provisioning succeeded" ? "Disabled" : "Provisioning succeeded" }
            : e,
        ),
      }));

    case "DELETE_EXTENSION":
      return updateVm(state, action.id, (r) => ({
        ...r,
        extensions: r.extensions.filter((_, i) => i !== action.index),
      }));

    case "TOGGLE_BOOT_DIAG":
      return updateVm(state, action.id, (r) => ({
        ...r,
        bootDiag: { ...(r.bootDiag ?? defaultBootDiag()), enabled: action.enabled },
      }));

    case "ADD_RESTORE_POINT":
      return updateVm(state, action.id, (r) => ({
        ...r,
        restorePoints: [action.restorePoint, ...r.restorePoints],
      }));

    case "DELETE_RESTORE_POINT":
      return updateVm(state, action.id, (r) => ({
        ...r,
        restorePoints: r.restorePoints.filter((_, i) => i !== action.index),
      }));

    case "ENABLE_ASR": {
      const vm = state.resources.find((r) => r.id === action.id);
      return {
        ...updateVm(state, action.id, (r) => ({
          ...r,
          asr: { enabled: true, targetRegion: action.targetRegion, policy: action.policy },
        })),
        activityLog: vm ? logActivity(state.activityLog, "Enable replication", vm.name) : state.activityLog,
      };
    }

    case "DISABLE_ASR":
      return updateVm(state, action.id, (r) => ({ ...r, asr: { enabled: false } }));

    case "ADD_ALERT_RULE":
      return updateVm(state, action.id, (r) => ({
        ...r,
        alertRules: [action.rule, ...r.alertRules],
      }));

    case "TOGGLE_ALERT_RULE":
      return updateVm(state, action.id, (r) => ({
        ...r,
        alertRules: r.alertRules.map((a, i) => (i === action.index ? { ...a, enabled: !a.enabled } : a)),
      }));

    case "DELETE_ALERT_RULE":
      return updateVm(state, action.id, (r) => ({
        ...r,
        alertRules: r.alertRules.filter((_, i) => i !== action.index),
      }));

    case "SAVE_NSG_RULE": {
      const nsg = state.resources.find((r) => r.id === action.id);
      const next = updateNsg(state, action.id, (r) => {
        const listKey = action.direction === "Inbound" ? "inboundRules" : "outboundRules";
        const list = r[listKey];
        const idx = list.findIndex((x) => x.id === action.rule.id);
        return {
          ...r,
          [listKey]: idx === -1 ? [...list, action.rule] : list.map((x, i) => (i === idx ? action.rule : x)),
        };
      });
      return {
        ...next,
        activityLog: nsg ? logActivity(state.activityLog, "Update", nsg.name) : state.activityLog,
      };
    }

    case "DELETE_NSG_RULE": {
      const nsg = state.resources.find((r) => r.id === action.id);
      const next = updateNsg(state, action.id, (r) => {
        const listKey = action.direction === "Inbound" ? "inboundRules" : "outboundRules";
        return { ...r, [listKey]: r[listKey].filter((x) => x.id !== action.ruleId) };
      });
      return {
        ...next,
        activityLog: nsg ? logActivity(state.activityLog, "Delete", nsg.name) : state.activityLog,
      };
    }

    case "DISSOCIATE_NIC":
      return updateNsg(state, action.id, (r) => ({
        ...r,
        associatedNICs: r.associatedNICs.filter((n) => n !== action.nic),
      }));

    case "DISSOCIATE_SUBNET":
      return updateNsg(state, action.id, (r) => ({
        ...r,
        associatedSubnets: r.associatedSubnets.filter((s) => s !== action.subnet),
      }));

    case "SET_APP_STATUS": {
      const app = state.resources.find((r) => r.id === action.id);
      if (!app || app.resourceType !== "AppService") return state;
      const op = action.status === "Running" ? "Start" : "Stop";
      return {
        ...updateApp(state, action.id, (r) => ({ ...r, status: action.status })),
        activityLog: logActivity(state.activityLog, op, app.name),
      };
    }

    case "CHANGE_APP_TIER": {
      const tier = APP_SERVICE_TIERS.find((t) => t.id === action.tierId);
      if (!tier) return state;
      const app = state.resources.find((r) => r.id === action.id);
      return {
        ...updateApp(state, action.id, (r) => ({
          ...r,
          planTier: tier.id,
          appServicePlan: `${tier.label.split(":")[0].trim()} (${tier.tier})`,
        })),
        activityLog: app ? logActivity(state.activityLog, "Scale", app.name) : state.activityLog,
      };
    }

    case "SET_APP_INSTANCES": {
      const app = state.resources.find((r) => r.id === action.id);
      const next = updateApp(state, action.id, (r) => ({ ...r, instances: action.instances }));
      if (!action.log) return next;
      return {
        ...next,
        activityLog: app ? logActivity(state.activityLog, "Scale out", app.name) : state.activityLog,
      };
    }

    case "SET_APP_SETTING":
      return updateApp(state, action.id, (r) => ({
        ...r,
        appSettings: { ...r.appSettings, [action.key]: action.value },
      }));

    case "DELETE_APP_SETTING":
      return updateApp(state, action.id, (r) => {
        const appSettings = { ...r.appSettings };
        delete appSettings[action.key];
        return { ...r, appSettings };
      });

    case "ADD_CONNECTION_STRING":
      return updateApp(state, action.id, (r) => ({
        ...r,
        connectionStrings: [...r.connectionStrings, action.connectionString],
      }));

    case "DELETE_CONNECTION_STRING":
      return updateApp(state, action.id, (r) => ({
        ...r,
        connectionStrings: r.connectionStrings.filter((_, i) => i !== action.index),
      }));

    case "ADD_APP_SLOT":
      return updateApp(state, action.id, (r) => ({
        ...r,
        slots: [...r.slots, { name: action.name, state: "Running", trafficPct: 0 }],
      }));

    case "DELETE_APP_SLOT":
      return updateApp(state, action.id, (r) => ({
        ...r,
        slots: r.slots.filter((s) => s.name !== action.name),
      }));

    case "ADD_CUSTOM_DOMAIN":
      return updateApp(state, action.id, (r) => ({
        ...r,
        customDomains: [...r.customDomains, action.domain],
      }));

    case "DELETE_CUSTOM_DOMAIN":
      return updateApp(state, action.id, (r) => ({
        ...r,
        customDomains: r.customDomains.filter((d) => d !== action.domain),
      }));

    case "ADD_CORS_ORIGIN":
      return updateApp(state, action.id, (r) => ({
        ...r,
        corsOrigins: [...r.corsOrigins, action.origin],
      }));

    case "DELETE_CORS_ORIGIN":
      return updateApp(state, action.id, (r) => ({
        ...r,
        corsOrigins: r.corsOrigins.filter((_, i) => i !== action.index),
      }));

    case "TOGGLE_APP_INSIGHTS":
      return updateApp(state, action.id, (r) => ({ ...r, appInsights: action.enabled }));

    case "ADD_LB_FRONTEND":
      return addLbChild(state, action.id, "frontendConfigs", action.config);
    case "DELETE_LB_FRONTEND":
      return deleteLbChild(state, action.id, "frontendConfigs", action.index);

    case "ADD_LB_BACKEND_POOL":
      return addLbChild(state, action.id, "backendPools", action.pool);
    case "DELETE_LB_BACKEND_POOL":
      return deleteLbChild(state, action.id, "backendPools", action.index);

    case "ADD_LB_POOL_TARGET":
      return updateLb(state, action.id, (r) => ({
        ...r,
        backendPools: r.backendPools.map((p, i) =>
          i === action.poolIndex ? { ...p, targets: [...p.targets, action.target] } : p,
        ),
      }));
    case "DELETE_LB_POOL_TARGET":
      return updateLb(state, action.id, (r) => ({
        ...r,
        backendPools: r.backendPools.map((p, i) =>
          i === action.poolIndex ? { ...p, targets: p.targets.filter((_, ti) => ti !== action.targetIndex) } : p,
        ),
      }));

    case "ADD_LB_PROBE":
      return addLbChild(state, action.id, "healthProbes", action.probe);
    case "DELETE_LB_PROBE":
      return deleteLbChild(state, action.id, "healthProbes", action.index);

    case "ADD_LB_RULE":
      return addLbChild(state, action.id, "lbRules", action.rule);
    case "DELETE_LB_RULE":
      return deleteLbChild(state, action.id, "lbRules", action.index);

    case "ADD_LB_NAT_RULE":
      return addLbChild(state, action.id, "natRules", action.rule);
    case "DELETE_LB_NAT_RULE":
      return deleteLbChild(state, action.id, "natRules", action.index);

    case "ADD_LB_OUTBOUND_RULE":
      return addLbChild(state, action.id, "outboundRules", action.rule);
    case "DELETE_LB_OUTBOUND_RULE":
      return deleteLbChild(state, action.id, "outboundRules", action.index);

    case "ADD_VNET_ADDRESS_SPACE": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = updateVnet(state, action.id, (r) => ({ ...r, addressSpace: [...r.addressSpace, action.cidr] }));
      return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Update address space", vnet.name) : state.activityLog };
    }

    case "REMOVE_VNET_ADDRESS_SPACE":
      return updateVnet(state, action.id, (r) => ({
        ...r,
        addressSpace: r.addressSpace.filter((_, i) => i !== action.index),
      }));

    case "SET_VNET_ADDRESS_SPACES": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = updateVnet(state, action.id, (r) => ({ ...r, addressSpace: action.cidrs }));
      return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Update address space", vnet.name) : state.activityLog };
    }

    case "ADD_VNET_SUBNET": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = addVnetChild(state, action.id, "subnets", action.subnet);
      return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Add subnet", vnet.name) : state.activityLog };
    }

    case "UPDATE_VNET_SUBNET": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = updateVnet(state, action.id, (r) => ({
        ...r,
        subnets: r.subnets.map((s, i) => (i === action.index ? action.subnet : s)),
      }));
      return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Update subnet", vnet.name) : state.activityLog };
    }

    case "DELETE_VNET_SUBNET": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = deleteVnetChild(state, action.id, "subnets", action.index);
      return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Delete subnet", vnet.name) : state.activityLog };
    }

    case "TOGGLE_VNET_SUBNET_ENDPOINT":
      return updateVnet(state, action.id, (r) => ({
        ...r,
        subnets: r.subnets.map((s, i) => {
          if (i !== action.index) return s;
          const has = s.serviceEndpoints.includes(action.endpoint);
          return {
            ...s,
            serviceEndpoints: has
              ? s.serviceEndpoints.filter((e) => e !== action.endpoint)
              : [...s.serviceEndpoints, action.endpoint],
          };
        }),
      }));

    case "SET_VNET_DDOS": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = updateVnet(state, action.id, (r) => ({
        ...r,
        ddosProtection: action.enabled,
        ddosPlan: action.enabled ? r.ddosPlan || "ddos-plan-default" : r.ddosPlan,
      }));
      return {
        ...next,
        activityLog: vnet
          ? logActivity(state.activityLog, action.enabled ? "Enable DDoS protection" : "Disable DDoS protection", vnet.name)
          : state.activityLog,
      };
    }

    case "SET_VNET_DDOS_TIER":
      return updateVnet(state, action.id, (r) => ({
        ...r,
        ddosTier: action.tier,
        ddosPlan: action.tier === "Basic (free)" ? null : r.ddosPlan,
      }));

    case "LINK_VNET_DDOS_PLAN": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = updateVnet(state, action.id, (r) => ({
        ...r,
        ddosPlan: action.plan,
        ddosAttackHistory: r.ddosAttackHistory.length > 0 ? r.ddosAttackHistory : action.attackHistory,
      }));
      return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Link DDoS plan", vnet.name) : state.activityLog };
    }

    case "SET_VNET_FIREWALL": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = updateVnet(state, action.id, (r) => ({
        ...r,
        firewallEnabled: action.enabled,
        firewallTier: action.enabled ? action.tier ?? r.firewallTier ?? "Standard" : r.firewallTier,
      }));
      return {
        ...next,
        activityLog: vnet ? logActivity(state.activityLog, action.enabled ? "Deploy firewall" : "Remove firewall", vnet.name) : state.activityLog,
      };
    }

    case "ADD_VNET_PEERING": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = addVnetChild(state, action.id, "peerings", action.peering);
      return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Add peering " + action.peering.name, vnet.name) : state.activityLog };
    }

    case "DELETE_VNET_PEERING": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const peering = vnet?.resourceType === "VirtualNetwork" ? vnet.peerings[action.index] : undefined;
      const next = deleteVnetChild(state, action.id, "peerings", action.index);
      return {
        ...next,
        activityLog: vnet && peering ? logActivity(state.activityLog, "Delete peering " + peering.name, vnet.name) : state.activityLog,
      };
    }

    case "SET_VNET_DNS_MODE": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = updateVnet(state, action.id, (r) => ({
        ...r,
        dnsServers: action.mode,
        customDnsServers: action.mode === "Custom" && r.customDnsServers.length === 0 ? ["8.8.8.8"] : r.customDnsServers,
      }));
      return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Update DNS servers", vnet.name) : state.activityLog };
    }

    case "SET_VNET_DNS_SERVERS": {
      const vnet = state.resources.find((r) => r.id === action.id);
      const next = updateVnet(state, action.id, (r) => ({ ...r, customDnsServers: action.servers }));
      return { ...next, activityLog: vnet ? logActivity(state.activityLog, "Save DNS servers", vnet.name) : state.activityLog };
    }

    case "ADD_VNET_ALERT_RULE":
      return addVnetChild(state, action.id, "alertRules", action.rule);

    case "TOGGLE_VNET_ALERT_RULE":
      return updateVnet(state, action.id, (r) => ({
        ...r,
        alertRules: r.alertRules.map((a, i) => (i === action.index ? { ...a, enabled: !a.enabled } : a)),
      }));

    case "DELETE_VNET_ALERT_RULE":
      return deleteVnetChild(state, action.id, "alertRules", action.index);

    case "SET_SQL_FIREWALL_RULES":
      return updateSql(state, action.id, (r) => ({ ...r, firewallRules: action.rules }));

    case "CHANGE_SQL_TIER": {
      const sql = state.resources.find((r) => r.id === action.id);
      let next = state;
      if (action.model === "DTU") {
        const t = DTU_TIERS.find((x) => x.id === action.tierId);
        if (!t) return state;
        next = updateSql(state, action.id, (r) => ({
          ...r,
          pricingModel: "DTU",
          serviceTier: t.id,
          dtu: t.dtu,
          dataMaxGB: Math.min(r.dataMaxGB || t.maxGB, t.maxGB),
          estimatedCost: t.cost,
        }));
      } else {
        const t = VCORE_TIERS.find((x) => x.id === action.tierId);
        if (!t) return state;
        next = updateSql(state, action.id, (r) => ({
          ...r,
          pricingModel: "vCore",
          serviceTier: t.label,
          estimatedCost: t.baseCost * (r.vCores || 2) * 730,
        }));
      }
      return { ...next, activityLog: sql ? logActivity(state.activityLog, "Re-tier database", sql.name) : state.activityLog };
    }

    case "SET_SQL_LTR":
      return updateSql(state, action.id, (r) => ({
        ...r,
        ltrWeekly: action.weekly,
        ltrMonthly: action.monthly,
        ltrYearly: action.yearly,
      }));

    case "TOGGLE_SQL_AUDIT":
      return updateSql(state, action.id, (r) => ({ ...r, auditingEnabled: action.enabled }));

    case "SET_SQL_AUDIT_RETENTION":
      return updateSql(state, action.id, (r) => ({ ...r, auditRetentionDays: action.days }));

    case "TOGGLE_SQL_DEFENDER": {
      const sql = state.resources.find((r) => r.id === action.id);
      const next = updateSql(state, action.id, (r) => ({ ...r, defender: !r.defender }));
      const nowEnabled = sql?.resourceType === "SqlDatabase" ? !sql.defender : false;
      return {
        ...next,
        activityLog: sql ? logActivity(state.activityLog, nowEnabled ? "Enable Defender" : "Disable Defender", sql.name) : state.activityLog,
      };
    }

    case "SET_SQL_TDE":
      return updateSql(state, action.id, (r) => ({ ...r, tdeOption: action.option }));

    case "ADD_SQL_ALERT_RULE":
      return addSqlChild(state, action.id, "alertRules", action.rule);
    case "TOGGLE_SQL_ALERT_RULE":
      return updateSql(state, action.id, (r) => ({
        ...r,
        alertRules: r.alertRules.map((a, i) => (i === action.index ? { ...a, enabled: !a.enabled } : a)),
      }));
    case "DELETE_SQL_ALERT_RULE":
      return deleteSqlChild(state, action.id, "alertRules", action.index);

    case "ADD_SQL_DIAG_SETTING":
      return addSqlChild(state, action.id, "diagSettings", action.setting);
    case "DELETE_SQL_DIAG_SETTING":
      return deleteSqlChild(state, action.id, "diagSettings", action.index);

    case "ROTATE_STORAGE_KEY": {
      const sa = state.resources.find((r) => r.id === action.id);
      const next = updateStorage(state, action.id, (r) => ({ ...r, [action.key]: `fake-base64-key-${randomKey()}` }));
      return { ...next, activityLog: sa ? logActivity(state.activityLog, "Regenerate", sa.name) : state.activityLog };
    }

    case "ADD_STORAGE_CONTAINER": {
      const sa = state.resources.find((r) => r.id === action.id);
      const next = addStorageChild(state, action.id, "containers", action.container);
      return { ...next, activityLog: sa ? logActivity(state.activityLog, "Create", "Blob container") : state.activityLog };
    }
    case "DELETE_STORAGE_CONTAINER": {
      const sa = state.resources.find((r) => r.id === action.id);
      const next = updateStorage(state, action.id, (r) => ({ ...r, containers: r.containers.filter((c) => c.name !== action.name) }));
      return { ...next, activityLog: sa ? logActivity(state.activityLog, "Delete", "Blob container") : state.activityLog };
    }

    case "ADD_STORAGE_FILE_SHARE":
      return addStorageChild(state, action.id, "fileShares", action.share);
    case "DELETE_STORAGE_FILE_SHARE":
      return updateStorage(state, action.id, (r) => ({ ...r, fileShares: r.fileShares.filter((s) => s.name !== action.name) }));

    case "ADD_STORAGE_QUEUE":
      return addStorageChild(state, action.id, "queues", action.queue);
    case "DELETE_STORAGE_QUEUE":
      return updateStorage(state, action.id, (r) => ({ ...r, queues: r.queues.filter((q) => q.name !== action.name) }));

    case "ADD_STORAGE_TABLE":
      return addStorageChild(state, action.id, "tables", action.table);
    case "DELETE_STORAGE_TABLE":
      return updateStorage(state, action.id, (r) => ({ ...r, tables: r.tables.filter((t) => t.name !== action.name) }));

    case "UPDATE_STORAGE_CONFIG": {
      const sa = state.resources.find((r) => r.id === action.id);
      const next = updateStorage(state, action.id, (r) => ({ ...r, [action.key]: action.value }));
      return { ...next, activityLog: sa ? logActivity(state.activityLog, "Update", sa.name) : state.activityLog };
    }

    case "SET_STORAGE_SAS":
      return updateStorage(state, action.id, (r) => ({ ...r, sas: action.sas }));

    case "ADD_STORAGE_VNET_RULE":
      return addStorageChild(state, action.id, "networkVnets", action.rule);
    case "DELETE_STORAGE_VNET_RULE":
      return deleteStorageChildByIndex(state, action.id, "networkVnets", action.index);

    case "ADD_STORAGE_IP_RULE":
      return addStorageChild(state, action.id, "networkIps", action.rule);
    case "DELETE_STORAGE_IP_RULE":
      return deleteStorageChildByIndex(state, action.id, "networkIps", action.index);

    case "ADD_STORAGE_PRIVATE_ENDPOINT":
      return addStorageChild(state, action.id, "privateEndpoints", action.endpoint);
    case "DELETE_STORAGE_PRIVATE_ENDPOINT":
      return deleteStorageChildByIndex(state, action.id, "privateEndpoints", action.index);

    case "SET_STORAGE_NETWORK_ACCESS": {
      const sa = state.resources.find((r) => r.id === action.id);
      const next = updateStorage(state, action.id, (r) => ({ ...r, networkAccess: action.value }));
      return { ...next, activityLog: sa ? logActivity(state.activityLog, "Update", sa.name) : state.activityLog };
    }

    case "ADD_STORAGE_LIFECYCLE_RULE":
      return addStorageChild(state, action.id, "lifecycleRules", action.rule);
    case "TOGGLE_STORAGE_LIFECYCLE_RULE":
      return updateStorage(state, action.id, (r) => ({
        ...r,
        lifecycleRules: r.lifecycleRules.map((l, i) => (i === action.index ? { ...l, enabled: !l.enabled } : l)),
      }));
    case "DELETE_STORAGE_LIFECYCLE_RULE":
      return deleteStorageChildByIndex(state, action.id, "lifecycleRules", action.index);

    case "LINK_STORAGE_FRONT_DOOR":
      return updateStorage(state, action.id, (r) => ({ ...r, frontDoorProfile: action.profile }));
    case "UNLINK_STORAGE_FRONT_DOOR":
      return updateStorage(state, action.id, (r) => ({ ...r, frontDoorProfile: null }));

    case "SET_STORAGE_DEFENDER":
      return updateStorage(state, action.id, (r) => ({ ...r, defenderForStorage: action.defender }));

    case "ADD_STORAGE_OBJECT_REPL_RULE":
      return addStorageChild(state, action.id, "objectReplRules", action.rule);
    case "DELETE_STORAGE_OBJECT_REPL_RULE":
      return deleteStorageChildByIndex(state, action.id, "objectReplRules", action.index);

    case "ADD_STORAGE_INVENTORY_RULE":
      return addStorageChild(state, action.id, "inventoryRules", action.rule);
    case "DELETE_STORAGE_INVENTORY_RULE":
      return deleteStorageChildByIndex(state, action.id, "inventoryRules", action.index);

    case "ADD_STORAGE_ALERT_RULE":
      return addStorageChild(state, action.id, "alertRules", action.rule);
    case "TOGGLE_STORAGE_ALERT_RULE":
      return updateStorage(state, action.id, (r) => ({
        ...r,
        alertRules: r.alertRules.map((a, i) => (i === action.index ? { ...a, enabled: !a.enabled } : a)),
      }));
    case "DELETE_STORAGE_ALERT_RULE":
      return deleteStorageChildByIndex(state, action.id, "alertRules", action.index);

    default:
      return state;
  }
}

export function ensurePolicyCompliance(vm: VmResource): VmResource {
  if (vm.policyCompliance && vm.policyCompliance.length > 0) return vm;
  return { ...vm, policyCompliance: DEFAULT_POLICY_COMPLIANCE.map((p) => ({ ...p })) };
}

export type { RgResource };
