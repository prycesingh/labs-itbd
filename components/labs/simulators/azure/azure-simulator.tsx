"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { toast } from "sonner";

import {
  appServiceResources,
  lbResources,
  nsgResources,
  rgResources,
  resourcesInGroup,
  vmResources,
  vnetResources,
  sqlResources,
  storageResources,
  freshAzureSimState,
} from "@/lib/labs/simulators/azure/azureState";
import type { AzureSimState } from "@/lib/labs/simulators/azure/azureState";
import type { LbFrontendConfig, LbResource } from "@/lib/labs/simulators/azure/lbTypes";
import { azureReducer, ensurePolicyCompliance } from "@/lib/labs/simulators/azure/reducer";
import { computeLabScore, getScenario } from "@/lib/labs/simulators/azure/labScenarios";
import { loadLabScores, saveLabScore, type LabScores } from "@/lib/labs/simulators/azure/labScores";
import { freshSubnet } from "@/lib/labs/simulators/azure/vnetTypes";
import { AppServiceCreateWizard } from "./appservice-create-wizard";
import { AppServiceDetailBlade } from "./appservice-detail-blade";
import { AppServiceList } from "./appservice-list";
import { AzurePortalShell, type AzurePage } from "./azure-portal-shell";
import { LabCatalog } from "./lab-catalog";
import { LabHud } from "./lab-hud";
import { LbCreateWizard } from "./lb-create-wizard";
import { LbDetailBlade } from "./lb-detail-blade";
import { LbList } from "./lb-list";
import { NsgCreateWizard } from "./nsg-create-wizard";
import { NsgDetailBlade } from "./nsg-detail-blade";
import { NsgList } from "./nsg-list";
import { RgCreateWizard } from "./rg-create-wizard";
import { RgDetailBlade } from "./rg-detail-blade";
import { RgList } from "./rg-list";
import { SqlCreateWizard } from "./sql-create-wizard";
import { SqlDetailBlade } from "./sql-detail-blade";
import { SqlList } from "./sql-list";
import { StorageCreateWizard } from "./storage-create-wizard";
import { StorageDetailBlade } from "./storage-detail-blade";
import { StorageList } from "./storage-list";
import { VmCreateWizard } from "./vm-create-wizard";
import { VmDetailBlade } from "./vm-detail-blade";
import { VmList } from "./vm-list";
import { VnetCreateWizard } from "./vnet-create-wizard";
import { VnetDetailBlade } from "./vnet-detail-blade";
import { VnetList } from "./vnet-list";

const SIMULATOR_KEY = "azure-vm";
const SAVE_DEBOUNCE_MS = 1200;

type ResourceTypeTab = AzurePage;

type View =
  | { name: "list"; tab: ResourceTypeTab }
  | { name: "create"; tab: ResourceTypeTab }
  | { name: "detail"; id: string };

const SECTION_LABELS: Record<AzurePage, string> = {
  "virtual-machines": "Virtual machines",
  "resource-groups": "Resource groups",
  "network-security-groups": "Network security groups",
  "app-services": "App Services",
  "load-balancers": "Load balancers",
  "virtual-networks": "Virtual networks",
  "sql-databases": "SQL databases",
  "storage-accounts": "Storage accounts",
  labs: "Labs",
};

type LabSession = { scenarioId: string; startTime: number; hintsUsed: number };

/** Default frontend IP configuration for the "+ Add" button on an existing LB's detail blade. */
function freshFrontendConfigFor(lb: LbResource): LbFrontendConfig {
  const idx = lb.frontendConfigs.length + 1;
  const base: LbFrontendConfig = {
    id: crypto.randomUUID(),
    name: `LoadBalancerFrontEnd${idx === 1 ? "" : idx}`,
    ipVersion: "IPv4",
  };
  if (lb.lbType === "Public") {
    base.publicIpSource = "Create new";
    base.publicIpName = `pip-${lb.name}-${idx}`;
    base.publicIpSku = lb.sku;
    base.assignment = "Static";
    base.routingPreference = "Microsoft network";
  } else {
    base.vnet = "";
    base.subnet = "default";
    base.assignment = "Dynamic";
  }
  return base;
}

export function AzureSimulator() {
  const [state, dispatch] = useReducer(azureReducer, freshAzureSimState());
  const [view, setView] = useState<View>({ name: "list", tab: "virtual-machines" });
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [lab, setLab] = useState<LabSession | null>(null);
  const [labScores, setLabScores] = useState<LabScores>({});
  useEffect(() => {
    setLabScores(loadLabScores());
  }, []);

  function startLab(id: string) {
    const scenario = getScenario(id);
    if (!scenario) return;
    if (!confirm(`Starting "${scenario.title}" will reset your simulator. OK to continue?`)) return;
    dispatch({ type: "LOAD_STATE", state: { resources: scenario.setup(), activityLog: [] } });
    setLab({ scenarioId: id, startTime: Date.now(), hintsUsed: 0 });
    setView({ name: "list", tab: "resource-groups" });
  }

  function exitLab() {
    setLab(null);
  }

  function hintLab() {
    if (!lab) return;
    const scenario = getScenario(lab.scenarioId);
    if (!scenario || lab.hintsUsed >= scenario.hints.length) return;
    alert(`Hint ${lab.hintsUsed + 1} of ${scenario.hints.length}:\n\n${scenario.hints[lab.hintsUsed]}\n\n(Each hint reduces your score by 15 points)`);
    setLab({ ...lab, hintsUsed: lab.hintsUsed + 1 });
  }

  function checkLab() {
    const scenario = lab ? getScenario(lab.scenarioId) : undefined;
    if (!scenario) return;
    const completed = scenario.objectives.filter((o) => o.check(state)).length;
    const total = scenario.objectives.length;
    if (completed === total) toast.success("All objectives complete! Click Finish to submit.");
    else toast.info(`${completed} of ${total} objectives complete. Keep going!`);
  }

  function finishLab() {
    if (!lab) return;
    const scenario = getScenario(lab.scenarioId);
    if (!scenario) return;
    const completed = scenario.objectives.filter((o) => o.check(state)).length;
    if (completed < scenario.objectives.length) {
      toast.error("Complete all objectives first!");
      return;
    }
    const timeSec = Math.floor((Date.now() - lab.startTime) / 1000);
    const { score, timePenalty, hintPenalty } = computeLabScore(scenario.estimatedMin, timeSec, lab.hintsUsed);
    const prev = labScores[scenario.id];
    const isBetter = !prev || score > prev.score;
    const nextScores = saveLabScore(scenario.id, { score, timeSec, hintsUsed: lab.hintsUsed, when: new Date().toISOString() });
    setLabScores(nextScores);
    alert(
      `Lab complete!\n\nScore: ${score}\nTime: ${Math.floor(timeSec / 60)}m ${timeSec % 60}s\nHints used: ${lab.hintsUsed} (-${hintPenalty})\nTime penalty: -${timePenalty}\n\n` +
        (isBetter ? "NEW BEST SCORE!" : `Previous best: ${prev ? prev.score : 0}`),
    );
    setLab(null);
    setView({ name: "list", tab: "labs" });
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/labs/simulator-state/${SIMULATOR_KEY}`)
      .then((res) => (res.ok ? res.json() : { state: null }))
      .then((data) => {
        if (cancelled) return;
        if (data.state) {
          dispatch({ type: "LOAD_STATE", state: data.state as AzureSimState });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const saveState = useCallback(() => {
    fetch(`/api/labs/simulator-state/${SIMULATOR_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: stateRef.current }),
    }).catch(() => {
      /* best-effort — a failed save just means this session's changes won't
         survive logout; the simulator itself keeps working from local state */
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveState, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, loaded, saveState]);

  useEffect(() => {
    return () => saveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return <div style={{ padding: 48, textAlign: "center", color: "#605e5c" }}>Loading…</div>;
  }

  const vms = vmResources(state);
  const rgs = rgResources(state);
  const nsgs = nsgResources(state);
  const apps = appServiceResources(state);
  const lbs = lbResources(state);
  const vnets = vnetResources(state);
  const sqlDbs = sqlResources(state);
  const storageAccounts = storageResources(state);
  const vmPickList = vms.map((v) => ({ id: v.id, name: v.name, privateIp: v.privateIp, os: v.os }));

  function openResource(id: string) {
    setView({ name: "detail", id });
  }

  /** Lets any wizard's Resource group field create a real RG inline, instead of requiring a detour to the Resource groups page first. */
  function createResourceGroupInline(name: string) {
    if (rgs.some((r) => r.name === name)) return;
    dispatch({
      type: "CREATE_RESOURCE",
      resource: {
        id: crypto.randomUUID(),
        resourceType: "ResourceGroup",
        name,
        resourceGroup: name,
        region: "(US) East US",
        status: "Succeeded",
        estimatedCost: 0,
        tags: {},
        createdAt: new Date().toISOString(),
      },
    });
  }

  function renderContent() {
    if (view.name === "create") {
      if (view.tab === "resource-groups") {
        return (
          <RgCreateWizard
            existingNames={rgs.map((r) => r.name)}
            onCancel={() => setView({ name: "list", tab: "resource-groups" })}
            onCreate={(resource) => {
              dispatch({ type: "CREATE_RESOURCE", resource });
              toast.success(`Resource group "${resource.name}" created`);
              openResource(resource.id);
            }}
          />
        );
      }
      if (view.tab === "network-security-groups") {
        return (
          <NsgCreateWizard
            resourceGroups={rgs.map((r) => r.name)}
            onCreateResourceGroup={createResourceGroupInline}
            onCancel={() => setView({ name: "list", tab: "network-security-groups" })}
            onCreate={(resource) => {
              dispatch({ type: "CREATE_RESOURCE", resource });
              toast.success(`Network security group "${resource.name}" deployed successfully`);
              openResource(resource.id);
            }}
          />
        );
      }
      if (view.tab === "app-services") {
        return (
          <AppServiceCreateWizard
            resourceGroups={rgs.map((r) => r.name)}
            virtualNetworks={vnets.map((v) => v.name)}
            onCreateResourceGroup={createResourceGroupInline}
            onCancel={() => setView({ name: "list", tab: "app-services" })}
            onCreate={(resource) => {
              dispatch({ type: "CREATE_RESOURCE", resource });
              toast.success(`Web app "${resource.name}" deployed successfully`);
              openResource(resource.id);
            }}
          />
        );
      }
      if (view.tab === "load-balancers") {
        return (
          <LbCreateWizard
            resourceGroups={rgs.map((r) => r.name)}
            virtualNetworks={vnets.map((v) => v.name)}
            vms={vmPickList}
            onCreateResourceGroup={createResourceGroupInline}
            onCancel={() => setView({ name: "list", tab: "load-balancers" })}
            onCreate={(resource) => {
              dispatch({ type: "CREATE_RESOURCE", resource });
              toast.success(`Load balancer "${resource.name}" deployed successfully`);
              openResource(resource.id);
            }}
          />
        );
      }
      if (view.tab === "virtual-networks") {
        return (
          <VnetCreateWizard
            resourceGroups={rgs.map((r) => r.name)}
            onCreateResourceGroup={createResourceGroupInline}
            onCancel={() => setView({ name: "list", tab: "virtual-networks" })}
            onCreate={(resource) => {
              dispatch({ type: "CREATE_RESOURCE", resource });
              toast.success(`Virtual network "${resource.name}" deployed successfully`);
              openResource(resource.id);
            }}
          />
        );
      }
      if (view.tab === "sql-databases") {
        const existingServers = Array.from(new Map(sqlDbs.map((s) => [s.server, s])).values()).map((s) => ({
          name: s.server,
          adminLogin: s.serverAdminLogin,
          authMethod: s.authMethod,
          fqdn: s.serverFQDN,
        }));
        return (
          <SqlCreateWizard
            resourceGroups={rgs.map((r) => r.name)}
            existingServers={existingServers}
            onCreateResourceGroup={createResourceGroupInline}
            onCancel={() => setView({ name: "list", tab: "sql-databases" })}
            onCreate={(resource) => {
              dispatch({ type: "CREATE_RESOURCE", resource });
              toast.success(`SQL database "${resource.name}" deployed successfully`);
              openResource(resource.id);
            }}
          />
        );
      }
      if (view.tab === "storage-accounts") {
        return (
          <StorageCreateWizard
            resourceGroups={rgs.map((r) => r.name)}
            onCreateResourceGroup={createResourceGroupInline}
            onCancel={() => setView({ name: "list", tab: "storage-accounts" })}
            onCreate={(resource) => {
              dispatch({ type: "CREATE_RESOURCE", resource });
              toast.success(`Storage account "${resource.name}" deployed successfully`);
              openResource(resource.id);
            }}
          />
        );
      }
      return (
        <VmCreateWizard
          resourceGroups={rgs.map((r) => r.name)}
          onCreateResourceGroup={createResourceGroupInline}
          onCancel={() => setView({ name: "list", tab: "virtual-machines" })}
          onCreate={(resource) => {
            dispatch({ type: "CREATE_RESOURCE", resource });
            toast.success(`Virtual machine "${resource.name}" deployed successfully`);
            openResource(resource.id);
          }}
        />
      );
    }

    if (view.name === "detail") {
      const resource = state.resources.find((r) => r.id === view.id);
      if (!resource) {
        setView({ name: "list", tab: "virtual-machines" });
        return null;
      }

      if (resource.resourceType === "ResourceGroup") {
        return (
          <RgDetailBlade
            rg={resource}
            resourcesInGroup={resourcesInGroup(state, resource.name)}
            onBack={() => setView({ name: "list", tab: "resource-groups" })}
            onDelete={() => {
              const count = resourcesInGroup(state, resource.name).length;
              if (
                !confirm(
                  `Delete resource group "${resource.name}" and ALL ${count} resource(s) inside it? This cannot be undone.`,
                )
              )
                return;
              dispatch({ type: "DELETE_RESOURCE", id: resource.id });
              setView({ name: "list", tab: "resource-groups" });
            }}
            onAddTag={(key, value) => dispatch({ type: "ADD_TAG", id: resource.id, key, value })}
            onDeleteTag={(key) => dispatch({ type: "DELETE_TAG", id: resource.id, key })}
            onOpenResource={openResource}
          />
        );
      }

      if (resource.resourceType === "NetworkSecurityGroup") {
        return (
          <NsgDetailBlade
            nsg={resource}
            activityLog={state.activityLog}
            onBack={() => setView({ name: "list", tab: "network-security-groups" })}
            onDelete={() => {
              if (!confirm(`Delete NSG "${resource.name}"? This cannot be undone.`)) return;
              dispatch({ type: "DELETE_RESOURCE", id: resource.id });
              setView({ name: "list", tab: "network-security-groups" });
            }}
            onAddTag={(key, value) => dispatch({ type: "ADD_TAG", id: resource.id, key, value })}
            onDeleteTag={(key) => dispatch({ type: "DELETE_TAG", id: resource.id, key })}
            onSaveRule={(direction, rule) => dispatch({ type: "SAVE_NSG_RULE", id: resource.id, direction, rule })}
            onDeleteRule={(direction, ruleId) =>
              dispatch({ type: "DELETE_NSG_RULE", id: resource.id, direction, ruleId })
            }
            onDissociateNic={(nic) => dispatch({ type: "DISSOCIATE_NIC", id: resource.id, nic })}
            onDissociateSubnet={(subnet) => dispatch({ type: "DISSOCIATE_SUBNET", id: resource.id, subnet })}
          />
        );
      }

      if (resource.resourceType === "AppService") {
        return (
          <AppServiceDetailBlade
            app={resource}
            activityLog={state.activityLog}
            onBack={() => setView({ name: "list", tab: "app-services" })}
            onSetStatus={(status) => dispatch({ type: "SET_APP_STATUS", id: resource.id, status })}
            onDelete={() => {
              if (!confirm(`Delete App Service "${resource.name}"? This cannot be undone.`)) return;
              dispatch({ type: "DELETE_RESOURCE", id: resource.id });
              setView({ name: "list", tab: "app-services" });
            }}
            onAddTag={(key, value) => dispatch({ type: "ADD_TAG", id: resource.id, key, value })}
            onDeleteTag={(key) => dispatch({ type: "DELETE_TAG", id: resource.id, key })}
            onChangeTier={(tierId) => dispatch({ type: "CHANGE_APP_TIER", id: resource.id, tierId })}
            onSetInstances={(instances, log) =>
              dispatch({ type: "SET_APP_INSTANCES", id: resource.id, instances, log })
            }
            onAddSetting={(key, value) => dispatch({ type: "SET_APP_SETTING", id: resource.id, key, value })}
            onDeleteSetting={(key) => dispatch({ type: "DELETE_APP_SETTING", id: resource.id, key })}
            onAddConnectionString={(connectionString) =>
              dispatch({ type: "ADD_CONNECTION_STRING", id: resource.id, connectionString })
            }
            onDeleteConnectionString={(index) =>
              dispatch({ type: "DELETE_CONNECTION_STRING", id: resource.id, index })
            }
            onAddSlot={(name) => dispatch({ type: "ADD_APP_SLOT", id: resource.id, name })}
            onDeleteSlot={(name) => dispatch({ type: "DELETE_APP_SLOT", id: resource.id, name })}
            onAddDomain={(domain) => dispatch({ type: "ADD_CUSTOM_DOMAIN", id: resource.id, domain })}
            onDeleteDomain={(domain) => dispatch({ type: "DELETE_CUSTOM_DOMAIN", id: resource.id, domain })}
            onAddCorsOrigin={(origin) => dispatch({ type: "ADD_CORS_ORIGIN", id: resource.id, origin })}
            onDeleteCorsOrigin={(index) => dispatch({ type: "DELETE_CORS_ORIGIN", id: resource.id, index })}
            onToggleAppInsights={(enabled) => dispatch({ type: "TOGGLE_APP_INSIGHTS", id: resource.id, enabled })}
          />
        );
      }

      if (resource.resourceType === "LoadBalancer") {
        return (
          <LbDetailBlade
            lb={resource}
            activityLog={state.activityLog}
            vms={vmPickList}
            onBack={() => setView({ name: "list", tab: "load-balancers" })}
            onDelete={() => {
              if (!confirm(`Delete load balancer "${resource.name}"? This cannot be undone.`)) return;
              dispatch({ type: "DELETE_RESOURCE", id: resource.id });
              setView({ name: "list", tab: "load-balancers" });
            }}
            onAddTag={(key, value) => dispatch({ type: "ADD_TAG", id: resource.id, key, value })}
            onDeleteTag={(key) => dispatch({ type: "DELETE_TAG", id: resource.id, key })}
            onAddFrontend={() => dispatch({ type: "ADD_LB_FRONTEND", id: resource.id, config: freshFrontendConfigFor(resource) })}
            onDeleteFrontend={(index) => dispatch({ type: "DELETE_LB_FRONTEND", id: resource.id, index })}
            onAddBackendPool={() =>
              dispatch({
                type: "ADD_LB_BACKEND_POOL",
                id: resource.id,
                pool: {
                  id: crypto.randomUUID(),
                  name: `backendPool${resource.backendPools.length + 1}`,
                  vnet: "",
                  config: "NIC",
                  targets: [],
                },
              })
            }
            onDeleteBackendPool={(index) => dispatch({ type: "DELETE_LB_BACKEND_POOL", id: resource.id, index })}
            onAddPoolTarget={(poolIndex, target) =>
              dispatch({ type: "ADD_LB_POOL_TARGET", id: resource.id, poolIndex, target })
            }
            onDeletePoolTarget={(poolIndex, targetIndex) =>
              dispatch({ type: "DELETE_LB_POOL_TARGET", id: resource.id, poolIndex, targetIndex })
            }
            onAddProbe={(probe) => dispatch({ type: "ADD_LB_PROBE", id: resource.id, probe: { ...probe, id: crypto.randomUUID() } })}
            onDeleteProbe={(index) => dispatch({ type: "DELETE_LB_PROBE", id: resource.id, index })}
            onAddLbRule={(rule) => dispatch({ type: "ADD_LB_RULE", id: resource.id, rule: { ...rule, id: crypto.randomUUID() } })}
            onDeleteLbRule={(index) => dispatch({ type: "DELETE_LB_RULE", id: resource.id, index })}
            onAddNatRule={(rule) => dispatch({ type: "ADD_LB_NAT_RULE", id: resource.id, rule: { ...rule, id: crypto.randomUUID() } })}
            onDeleteNatRule={(index) => dispatch({ type: "DELETE_LB_NAT_RULE", id: resource.id, index })}
            onAddOutboundRule={(rule) =>
              dispatch({ type: "ADD_LB_OUTBOUND_RULE", id: resource.id, rule: { ...rule, id: crypto.randomUUID() } })
            }
            onDeleteOutboundRule={(index) => dispatch({ type: "DELETE_LB_OUTBOUND_RULE", id: resource.id, index })}
          />
        );
      }

      if (resource.resourceType === "VirtualNetwork") {
        const connectedVms = vms
          .filter((v) => v.virtualNetwork && (v.virtualNetwork === resource.name || v.virtualNetwork.includes(resource.name)))
          .map((v) => ({ id: v.id, name: v.name, privateIp: v.privateIp, subnet: v.subnet, publicIpAddress: v.publicIpAddress }));
        return (
          <VnetDetailBlade
            vnet={resource}
            activityLog={state.activityLog}
            connectedVms={connectedVms}
            nsgNames={nsgs.map((n) => n.name)}
            otherVnetNames={vnets.filter((v) => v.id !== resource.id).map((v) => v.name)}
            onBack={() => setView({ name: "list", tab: "virtual-networks" })}
            onDelete={() => {
              if (!confirm(`Delete virtual network "${resource.name}"? Any connected devices will lose connectivity. This cannot be undone.`)) return;
              dispatch({ type: "DELETE_RESOURCE", id: resource.id });
              setView({ name: "list", tab: "virtual-networks" });
            }}
            onAddTag={(key, value) => dispatch({ type: "ADD_TAG", id: resource.id, key, value })}
            onDeleteTag={(key) => dispatch({ type: "DELETE_TAG", id: resource.id, key })}
            onSaveAddressSpace={(cidrs) => dispatch({ type: "SET_VNET_ADDRESS_SPACES", id: resource.id, cidrs })}
            onAddSubnet={() => dispatch({ type: "ADD_VNET_SUBNET", id: resource.id, subnet: freshSubnet(resource.subnets.length) })}
            onUpdateSubnet={(index, subnet) => dispatch({ type: "UPDATE_VNET_SUBNET", id: resource.id, index, subnet })}
            onDeleteSubnet={(index) => dispatch({ type: "DELETE_VNET_SUBNET", id: resource.id, index })}
            onToggleSubnetEndpoint={(index, endpoint) =>
              dispatch({ type: "TOGGLE_VNET_SUBNET_ENDPOINT", id: resource.id, index, endpoint })
            }
            onSetDdos={(enabled) => dispatch({ type: "SET_VNET_DDOS", id: resource.id, enabled })}
            onSetDdosTier={(tier) => dispatch({ type: "SET_VNET_DDOS_TIER", id: resource.id, tier })}
            onLinkDdosPlan={(plan, attackHistory) => dispatch({ type: "LINK_VNET_DDOS_PLAN", id: resource.id, plan, attackHistory })}
            onDeployFirewall={() => dispatch({ type: "SET_VNET_FIREWALL", id: resource.id, enabled: true, tier: resource.firewallTier ?? "Standard" })}
            onRemoveFirewall={() => dispatch({ type: "SET_VNET_FIREWALL", id: resource.id, enabled: false })}
            onAddPeering={(peering) =>
              dispatch({
                type: "ADD_VNET_PEERING",
                id: resource.id,
                peering: { ...peering, id: crypto.randomUUID(), state: "Connected", createdAt: new Date().toISOString() },
              })
            }
            onDeletePeering={(index) => dispatch({ type: "DELETE_VNET_PEERING", id: resource.id, index })}
            onSetDnsMode={(mode) => dispatch({ type: "SET_VNET_DNS_MODE", id: resource.id, mode })}
            onSaveDnsServers={(servers) => dispatch({ type: "SET_VNET_DNS_SERVERS", id: resource.id, servers })}
            onAddAlertRule={(rule) => dispatch({ type: "ADD_VNET_ALERT_RULE", id: resource.id, rule: { ...rule, id: crypto.randomUUID() } })}
            onToggleAlertRule={(index) => dispatch({ type: "TOGGLE_VNET_ALERT_RULE", id: resource.id, index })}
            onDeleteAlertRule={(index) => dispatch({ type: "DELETE_VNET_ALERT_RULE", id: resource.id, index })}
          />
        );
      }

      if (resource.resourceType === "SqlDatabase") {
        return (
          <SqlDetailBlade
            sql={resource}
            activityLog={state.activityLog}
            onBack={() => setView({ name: "list", tab: "sql-databases" })}
            onDelete={() => {
              if (!confirm(`Delete database "${resource.name}"? This cannot be undone.`)) return;
              dispatch({ type: "DELETE_RESOURCE", id: resource.id });
              setView({ name: "list", tab: "sql-databases" });
            }}
            onAddTag={(key, value) => dispatch({ type: "ADD_TAG", id: resource.id, key, value })}
            onDeleteTag={(key) => dispatch({ type: "DELETE_TAG", id: resource.id, key })}
            onChangeTier={(model, tierId) => dispatch({ type: "CHANGE_SQL_TIER", id: resource.id, model, tierId })}
            onSaveLtr={(weekly, monthly, yearly) => dispatch({ type: "SET_SQL_LTR", id: resource.id, weekly, monthly, yearly })}
            onToggleAudit={(enabled) => dispatch({ type: "TOGGLE_SQL_AUDIT", id: resource.id, enabled })}
            onSetAuditRetention={(days) => dispatch({ type: "SET_SQL_AUDIT_RETENTION", id: resource.id, days })}
            onToggleDefender={() => dispatch({ type: "TOGGLE_SQL_DEFENDER", id: resource.id })}
            onSetTde={(option) => dispatch({ type: "SET_SQL_TDE", id: resource.id, option })}
            onAddAlertRule={(rule) => dispatch({ type: "ADD_SQL_ALERT_RULE", id: resource.id, rule: { ...rule, id: crypto.randomUUID() } })}
            onToggleAlertRule={(index) => dispatch({ type: "TOGGLE_SQL_ALERT_RULE", id: resource.id, index })}
            onDeleteAlertRule={(index) => dispatch({ type: "DELETE_SQL_ALERT_RULE", id: resource.id, index })}
            onAddDiagSetting={(setting) => dispatch({ type: "ADD_SQL_DIAG_SETTING", id: resource.id, setting: { ...setting, id: crypto.randomUUID() } })}
            onDeleteDiagSetting={(index) => dispatch({ type: "DELETE_SQL_DIAG_SETTING", id: resource.id, index })}
          />
        );
      }

      if (resource.resourceType === "StorageAccount") {
        return (
          <StorageDetailBlade
            sa={resource}
            activityLog={state.activityLog}
            onBack={() => setView({ name: "list", tab: "storage-accounts" })}
            onDelete={() => {
              if (!confirm(`Delete storage account "${resource.name}"? All blobs, queues, tables, and file shares will be permanently lost. This cannot be undone.`)) return;
              dispatch({ type: "DELETE_RESOURCE", id: resource.id });
              setView({ name: "list", tab: "storage-accounts" });
            }}
            onAddTag={(key, value) => dispatch({ type: "ADD_TAG", id: resource.id, key, value })}
            onDeleteTag={(key) => dispatch({ type: "DELETE_TAG", id: resource.id, key })}
            onRotateKey={(key) => {
              dispatch({ type: "ROTATE_STORAGE_KEY", id: resource.id, key });
              toast.success(`${key} rotated for ${resource.name}`);
            }}
            onOpenExplorer={() => toast.info(`Storage browser opened for ${resource.name}`)}
            onAddContainer={(container) => dispatch({ type: "ADD_STORAGE_CONTAINER", id: resource.id, container })}
            onDeleteContainer={(name) => dispatch({ type: "DELETE_STORAGE_CONTAINER", id: resource.id, name })}
            onAddFileShare={(share) => dispatch({ type: "ADD_STORAGE_FILE_SHARE", id: resource.id, share })}
            onDeleteFileShare={(name) => dispatch({ type: "DELETE_STORAGE_FILE_SHARE", id: resource.id, name })}
            onAddQueue={(queue) => dispatch({ type: "ADD_STORAGE_QUEUE", id: resource.id, queue })}
            onDeleteQueue={(name) => dispatch({ type: "DELETE_STORAGE_QUEUE", id: resource.id, name })}
            onAddTable={(table) => dispatch({ type: "ADD_STORAGE_TABLE", id: resource.id, table })}
            onDeleteTable={(name) => dispatch({ type: "DELETE_STORAGE_TABLE", id: resource.id, name })}
            onUpdateConfig={(key, value) => dispatch({ type: "UPDATE_STORAGE_CONFIG", id: resource.id, key, value })}
            onSetSas={(sas) => dispatch({ type: "SET_STORAGE_SAS", id: resource.id, sas })}
            onSetNetworkAccess={(value) => dispatch({ type: "SET_STORAGE_NETWORK_ACCESS", id: resource.id, value })}
            onAddVnetRule={(rule) => dispatch({ type: "ADD_STORAGE_VNET_RULE", id: resource.id, rule })}
            onDeleteVnetRule={(index) => dispatch({ type: "DELETE_STORAGE_VNET_RULE", id: resource.id, index })}
            onAddIpRule={(rule) => dispatch({ type: "ADD_STORAGE_IP_RULE", id: resource.id, rule })}
            onDeleteIpRule={(index) => dispatch({ type: "DELETE_STORAGE_IP_RULE", id: resource.id, index })}
            onAddPrivateEndpoint={(endpoint) => dispatch({ type: "ADD_STORAGE_PRIVATE_ENDPOINT", id: resource.id, endpoint })}
            onDeletePrivateEndpoint={(index) => dispatch({ type: "DELETE_STORAGE_PRIVATE_ENDPOINT", id: resource.id, index })}
            onLinkFrontDoor={(profile) => dispatch({ type: "LINK_STORAGE_FRONT_DOOR", id: resource.id, profile })}
            onPurgeFrontDoor={() => toast.info("Cache purge initiated. Completes in ~5 minutes.")}
            onUnlinkFrontDoor={() => dispatch({ type: "UNLINK_STORAGE_FRONT_DOOR", id: resource.id })}
            onToggleDefender={(key, value) =>
              dispatch({
                type: "SET_STORAGE_DEFENDER",
                id: resource.id,
                defender: { ...resource.defenderForStorage, [key]: value },
              })
            }
            onSetDefenderPlan={(plan) =>
              dispatch({ type: "SET_STORAGE_DEFENDER", id: resource.id, defender: { ...resource.defenderForStorage, plan } })
            }
            onAddLifecycleRule={(rule) => dispatch({ type: "ADD_STORAGE_LIFECYCLE_RULE", id: resource.id, rule })}
            onToggleLifecycleRule={(index) => dispatch({ type: "TOGGLE_STORAGE_LIFECYCLE_RULE", id: resource.id, index })}
            onDeleteLifecycleRule={(index) => dispatch({ type: "DELETE_STORAGE_LIFECYCLE_RULE", id: resource.id, index })}
            onAddObjectReplRule={(rule) => dispatch({ type: "ADD_STORAGE_OBJECT_REPL_RULE", id: resource.id, rule })}
            onDeleteObjectReplRule={(index) => dispatch({ type: "DELETE_STORAGE_OBJECT_REPL_RULE", id: resource.id, index })}
            onAddInventoryRule={(rule) => dispatch({ type: "ADD_STORAGE_INVENTORY_RULE", id: resource.id, rule })}
            onDeleteInventoryRule={(index) => dispatch({ type: "DELETE_STORAGE_INVENTORY_RULE", id: resource.id, index })}
            onAddAlertRule={(rule) => dispatch({ type: "ADD_STORAGE_ALERT_RULE", id: resource.id, rule: { ...rule, id: crypto.randomUUID() } })}
            onToggleAlertRule={(index) => dispatch({ type: "TOGGLE_STORAGE_ALERT_RULE", id: resource.id, index })}
            onDeleteAlertRule={(index) => dispatch({ type: "DELETE_STORAGE_ALERT_RULE", id: resource.id, index })}
          />
        );
      }

      const vm = ensurePolicyCompliance(resource);
      return (
        <VmDetailBlade
          vm={vm}
          activityLog={state.activityLog}
          onBack={() => setView({ name: "list", tab: "virtual-machines" })}
          onSetStatus={(status) => dispatch({ type: "SET_STATUS", id: vm.id, status })}
          onDelete={() => {
            if (!confirm(`Delete VM "${vm.name}"? This cannot be undone.`)) return;
            dispatch({ type: "DELETE_RESOURCE", id: vm.id });
            setView({ name: "list", tab: "virtual-machines" });
          }}
          onResize={(size) => {
            dispatch({ type: "RESIZE_VM", id: vm.id, size });
            toast.success(`VM resized to ${size}`);
          }}
          onAddTag={(key, value) => dispatch({ type: "ADD_TAG", id: vm.id, key, value })}
          onDeleteTag={(key) => dispatch({ type: "DELETE_TAG", id: vm.id, key })}
          onAddExtension={(extension) => dispatch({ type: "ADD_EXTENSION", id: vm.id, extension })}
          onToggleExtension={(index) => dispatch({ type: "TOGGLE_EXTENSION", id: vm.id, index })}
          onDeleteExtension={(index) => dispatch({ type: "DELETE_EXTENSION", id: vm.id, index })}
          onToggleBootDiag={(enabled) => dispatch({ type: "TOGGLE_BOOT_DIAG", id: vm.id, enabled })}
          onAddRestorePoint={(restorePoint) =>
            dispatch({ type: "ADD_RESTORE_POINT", id: vm.id, restorePoint })
          }
          onDeleteRestorePoint={(index) => dispatch({ type: "DELETE_RESTORE_POINT", id: vm.id, index })}
          onEnableAsr={(targetRegion, policy) =>
            dispatch({ type: "ENABLE_ASR", id: vm.id, targetRegion, policy })
          }
          onDisableAsr={() => dispatch({ type: "DISABLE_ASR", id: vm.id })}
          onAddAlertRule={(rule) => dispatch({ type: "ADD_ALERT_RULE", id: vm.id, rule })}
          onToggleAlertRule={(index) => dispatch({ type: "TOGGLE_ALERT_RULE", id: vm.id, index })}
          onDeleteAlertRule={(index) => dispatch({ type: "DELETE_ALERT_RULE", id: vm.id, index })}
        />
      );
    }

    if (view.tab === "resource-groups") {
      return (
        <RgList
          resources={rgs}
          onOpen={openResource}
          onCreate={() => setView({ name: "create", tab: "resource-groups" })}
          onDelete={(id) => {
            const rg = rgs.find((r) => r.id === id);
            if (!rg) return;
            const count = resourcesInGroup(state, rg.name).length;
            if (
              !confirm(
                `Delete resource group "${rg.name}" and ALL ${count} resource(s) inside it? This cannot be undone.`,
              )
            )
              return;
            dispatch({ type: "DELETE_RESOURCE", id });
          }}
        />
      );
    }

    if (view.tab === "network-security-groups") {
      return (
        <NsgList
          resources={nsgs}
          onOpen={openResource}
          onCreate={() => setView({ name: "create", tab: "network-security-groups" })}
          onDelete={(id) => {
            const nsg = nsgs.find((r) => r.id === id);
            if (!nsg) return;
            if (!confirm(`Delete NSG "${nsg.name}"? This cannot be undone.`)) return;
            dispatch({ type: "DELETE_RESOURCE", id });
          }}
        />
      );
    }

    if (view.tab === "app-services") {
      return (
        <AppServiceList
          resources={apps}
          onOpen={openResource}
          onCreate={() => setView({ name: "create", tab: "app-services" })}
          onSetStatus={(id, status) => dispatch({ type: "SET_APP_STATUS", id, status })}
          onDelete={(id) => {
            const app = apps.find((r) => r.id === id);
            if (!app) return;
            if (!confirm(`Delete App Service "${app.name}"? This cannot be undone.`)) return;
            dispatch({ type: "DELETE_RESOURCE", id });
          }}
        />
      );
    }

    if (view.tab === "load-balancers") {
      return (
        <LbList
          resources={lbs}
          onOpen={openResource}
          onCreate={() => setView({ name: "create", tab: "load-balancers" })}
          onDelete={(id) => {
            const lb = lbs.find((r) => r.id === id);
            if (!lb) return;
            if (!confirm(`Delete load balancer "${lb.name}"? This cannot be undone.`)) return;
            dispatch({ type: "DELETE_RESOURCE", id });
          }}
        />
      );
    }

    if (view.tab === "virtual-networks") {
      return (
        <VnetList
          resources={vnets}
          onOpen={openResource}
          onCreate={() => setView({ name: "create", tab: "virtual-networks" })}
          onDelete={(id) => {
            const vnet = vnets.find((r) => r.id === id);
            if (!vnet) return;
            if (!confirm(`Delete virtual network "${vnet.name}"? Any connected devices will lose connectivity. This cannot be undone.`)) return;
            dispatch({ type: "DELETE_RESOURCE", id });
          }}
        />
      );
    }

    if (view.tab === "sql-databases") {
      return (
        <SqlList
          resources={sqlDbs}
          onOpen={openResource}
          onCreate={() => setView({ name: "create", tab: "sql-databases" })}
          onDelete={(id) => {
            const sql = sqlDbs.find((r) => r.id === id);
            if (!sql) return;
            if (!confirm(`Delete database "${sql.name}"? This cannot be undone.`)) return;
            dispatch({ type: "DELETE_RESOURCE", id });
          }}
        />
      );
    }

    if (view.tab === "storage-accounts") {
      return (
        <StorageList
          resources={storageAccounts}
          onOpen={openResource}
          onCreate={() => setView({ name: "create", tab: "storage-accounts" })}
          onDelete={(id) => {
            const sa = storageAccounts.find((r) => r.id === id);
            if (!sa) return;
            if (!confirm(`Delete storage account "${sa.name}"? All blobs, queues, tables, and file shares will be permanently lost. This cannot be undone.`)) return;
            dispatch({ type: "DELETE_RESOURCE", id });
          }}
        />
      );
    }

    if (view.tab === "labs") {
      return <LabCatalog scores={labScores} onStart={startLab} />;
    }

    return (
      <VmList
        resources={vms}
        onOpen={openResource}
        onCreate={() => setView({ name: "create", tab: "virtual-machines" })}
        onSetStatus={(id, status) => dispatch({ type: "SET_STATUS", id, status })}
        onDelete={(id) => {
          const vm = vms.find((r) => r.id === id);
          if (!vm) return;
          if (!confirm(`Delete VM "${vm.name}"? This cannot be undone.`)) return;
          dispatch({ type: "DELETE_RESOURCE", id });
        }}
      />
    );
  }

  function resourceTypeToPage(resourceType: string): AzurePage {
    if (resourceType === "ResourceGroup") return "resource-groups";
    if (resourceType === "NetworkSecurityGroup") return "network-security-groups";
    if (resourceType === "AppService") return "app-services";
    if (resourceType === "LoadBalancer") return "load-balancers";
    if (resourceType === "VirtualNetwork") return "virtual-networks";
    if (resourceType === "SqlDatabase") return "sql-databases";
    if (resourceType === "StorageAccount") return "storage-accounts";
    return "virtual-machines";
  }

  const activePage: AzurePage =
    view.name === "detail"
      ? resourceTypeToPage(state.resources.find((r) => r.id === view.id)?.resourceType ?? "VirtualMachine")
      : view.tab;

  function breadcrumb() {
    const sectionLabel = SECTION_LABELS[activePage];
    const sectionCrumb = { label: sectionLabel, onClick: () => setView({ name: "list", tab: activePage }) };

    if (view.name === "list") return [{ label: "Home" }, { label: sectionLabel }];
    if (view.name === "create") return [{ label: "Home" }, sectionCrumb, { label: "Create" }];

    const resource = state.resources.find((r) => r.id === view.id);
    return [{ label: "Home" }, sectionCrumb, { label: resource?.name ?? "" }];
  }

  const activeScenario = lab ? getScenario(lab.scenarioId) : undefined;

  return (
    <>
      <AzurePortalShell
        page={activePage}
        breadcrumb={breadcrumb()}
        onNavigate={(page) => setView({ name: "list", tab: page })}
      >
        {renderContent()}
      </AzurePortalShell>
      {lab && activeScenario ? (
        <LabHud
          scenario={activeScenario}
          state={state}
          startTime={lab.startTime}
          hintsUsed={lab.hintsUsed}
          onHint={hintLab}
          onCheck={checkLab}
          onFinish={finishLab}
          onExit={exitLab}
        />
      ) : null}
    </>
  );
}
