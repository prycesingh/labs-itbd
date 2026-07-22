"use client";

// Pipelines: New Pipeline wizard + standalone YAML editor. Ported from
// itbd-lab/simulators/azure-devops/js/ado-pipelines.js — specifically the
// `npWiz` 4-step "New pipeline" wizard state machine (npStepConnect /
// npStepSelectRepo / npStepConfigure / npStepReview / wizSave) and the
// pipeline-detail "YAML editor" card (renderSettingsTab's yaml-editor
// textarea + saveYaml/validateYaml/showStageGraph/revertYaml).
//
// Two real gaps in source are fixed here (both explicitly called out in the
// porting brief, not scope creep):
//  1. Source's YAML edits lived in a module-level `npWiz`/DOM textarea and
//     were never persisted across a reload. Here, `Save` dispatches the real
//     `SET_PIPELINE_YAML` reducer action, which persists `.yaml` on the
//     pipeline AND re-derives `.stages` via `parseStagesFromYaml` — genuinely
//     fixing that gap instead of reproducing it.
//  2. Stage parsing is never reimplemented here — both the wizard's "Create
//     pipeline" step and the YAML editor's "Show parsed stage graph" always
//     call the one real `parseStagesFromYaml` from pipeline-engine.ts.
//
// `validateYaml` is intentionally kept as source's lightweight heuristic
// (substring checks for stages:/jobs:/steps:, tab-character detection) — it
// is NOT a real YAML parser and isn't meant to become one.

import { useMemo, useState } from "react";

import type { AdoState, AdoPipeline } from "@/lib/labs/simulators/azure-devops/types";
import type { AdoAction } from "@/lib/labs/simulators/azure-devops/reducer";
import { parseStagesFromYaml } from "@/lib/labs/simulators/azure-devops/pipeline-engine";
import { Modal, NativeSelect, EmptyState } from "./ado-ui";
import styles from "./ado-console.module.css";

// ============================================================================
// Static sample repo lists for non-Azure-Repos wizard sources — ported
// verbatim from source's `GH_REPOS`/`BB_REPOS` module-level constants.
// ============================================================================

type SampleRepo = { name: string; desc: string; lang: string; updated: string };

const GH_REPOS: SampleRepo[] = [
  { name: "cloudlab/webapp-react", desc: "React frontend for CloudLab", lang: "TypeScript", updated: "2 days ago" },
  { name: "cloudlab/payments-api", desc: "Payments backend (Node.js)", lang: "JavaScript", updated: "5 hours ago" },
  { name: "cloudlab/billing-engine", desc: "Multi-tenant billing (.NET 8)", lang: "C#", updated: "3 days ago" },
  { name: "cloudlab/mobile-android", desc: "Android client (Kotlin)", lang: "Kotlin", updated: "1 week ago" },
  { name: "cloudlab/data-platform", desc: "Data Factory + Synapse pipelines", lang: "Python", updated: "4 days ago" },
  { name: "cloudlab/infrastructure-tf", desc: "Terraform IaC for prod + nonprod", lang: "HCL", updated: "6 hours ago" },
  { name: "cloudlab/helm-charts", desc: "Internal Helm charts", lang: "YAML", updated: "2 weeks ago" },
  { name: "cloudlab/docs", desc: "Engineering documentation", lang: "Markdown", updated: "1 day ago" },
];

const BB_REPOS: SampleRepo[] = [
  { name: "cloudlab/legacy-api", desc: "Legacy SOAP API (still live)", lang: "Java", updated: "3 months ago" },
  { name: "cloudlab/etl-jobs", desc: "Nightly ETL pipelines", lang: "Python", updated: "2 weeks ago" },
  { name: "cloudlab/reporting-cubes", desc: "SSAS cubes + reports", lang: "XML", updated: "1 month ago" },
  { name: "cloudlab/win-installer", desc: "Windows MSI installer", lang: "WiX", updated: "6 weeks ago" },
];

// ============================================================================
// 14 starter YAML templates — ported verbatim from source's `templateYaml(id,
// name)`. Content (task names, inputs, stage shapes) is real, well-authored
// reference YAML and is NOT abbreviated here.
// ============================================================================

export type PipelineTemplateId =
  | "starter"
  | "node"
  | "nodereact"
  | "python"
  | "pythondjango"
  | "dotnet"
  | "docker"
  | "maven"
  | "gradle"
  | "go"
  | "azurewebapp-node"
  | "azurefunction"
  | "kubernetes"
  | "existing";

type TemplateDef = { id: PipelineTemplateId; title: string; sub: string };

// Order + copy ported verbatim from source's `TEMPLATES` array (icons dropped
// — HTML entity glyphs from source's vanilla-JS `&#9881;` etc aren't part of
// the ITBD icon vocabulary here; titles/descriptions are unchanged).
const TEMPLATES: TemplateDef[] = [
  { id: "starter", title: "Starter pipeline", sub: "Minimal sample to customise" },
  { id: "node", title: "Node.js", sub: "Build a general Node.js app with npm" },
  { id: "nodereact", title: "Node.js with React", sub: "Build and test React with Jest" },
  { id: "python", title: "Python package", sub: "Create + publish a Python wheel" },
  { id: "pythondjango", title: "Python Django", sub: "Django app on Python 3.x" },
  { id: "dotnet", title: ".NET Core", sub: "Build, test, publish ASP.NET Core" },
  { id: "docker", title: "Docker", sub: "Build and push a container image" },
  { id: "maven", title: "Maven", sub: "Build a Java Maven project" },
  { id: "gradle", title: "Gradle", sub: "Build a Java Gradle project" },
  { id: "go", title: "Go", sub: "Build and test a Go module" },
  { id: "azurewebapp-node", title: "Azure Web App for Node.js", sub: "Build Node + deploy to Azure App Service" },
  { id: "azurefunction", title: "Azure Function App", sub: "Build + deploy an Azure Function" },
  { id: "kubernetes", title: "Deploy to Kubernetes", sub: "Build image + deploy with kubectl" },
  { id: "existing", title: "Existing Azure Pipelines YAML", sub: "Use a YAML file already in your repo" },
];

/**
 * Ported verbatim from source's `templateYaml(id, name)`. Given a template id
 * and a (repo-derived) name, returns the full starter YAML body. Falls back
 * to the "starter" template body for any unrecognised id.
 */
function templateYaml(id: PipelineTemplateId, name: string): string {
  const n = name || "cloudlab";
  switch (id) {
    case "node":
      return `trigger:
  branches: { include: [ main ] }

pool:
  vmImage: ubuntu-latest

variables:
  - name: NODE_VERSION
    value: '20.x'

steps:
  - task: NodeTool@0
    inputs: { versionSpec: $(NODE_VERSION) }
    displayName: 'Install Node.js'
  - script: npm ci
    displayName: 'npm ci'
  - script: npm test --if-present -- --ci
    displayName: 'npm test'
  - script: npm run build --if-present
    displayName: 'npm run build'
`;
    case "nodereact":
      return `trigger: { branches: { include: [ main, develop ] } }

pool: { vmImage: ubuntu-latest }

steps:
  - task: NodeTool@0
    inputs: { versionSpec: '20.x' }
  - script: npm ci
  - script: npm test -- --watchAll=false --ci --reporters=default --reporters=jest-junit
    env: { JEST_JUNIT_OUTPUT_DIR: 'test-results' }
  - script: npm run build
  - task: PublishTestResults@2
    inputs: { testResultsFiles: 'test-results/*.xml' }
  - task: PublishPipelineArtifact@1
    inputs: { targetPath: 'build', artifact: 'webapp' }
`;
    case "python":
      return `trigger: { branches: { include: [ main ] } }

pool: { vmImage: ubuntu-latest }

strategy:
  matrix:
    Python311: { python.version: '3.11' }
    Python312: { python.version: '3.12' }

steps:
  - task: UsePythonVersion@0
    inputs: { versionSpec: $(python.version) }
  - script: pip install -r requirements.txt
  - script: pytest --junitxml=junit/test-results.xml --cov=src --cov-report=xml
  - task: PublishTestResults@2
    inputs: { testResultsFiles: '**/test-*.xml' }
  - task: PublishCodeCoverageResults@1
    inputs: { codeCoverageTool: cobertura, summaryFileLocation: '**/coverage.xml' }
`;
    case "pythondjango":
      return `trigger: { branches: { include: [ main ] } }

pool: { vmImage: ubuntu-latest }

steps:
  - task: UsePythonVersion@0
    inputs: { versionSpec: '3.12' }
  - script: pip install -r requirements.txt
  - script: python manage.py migrate --noinput
  - script: python manage.py test
  - script: python manage.py collectstatic --noinput
`;
    case "dotnet":
      return `trigger: { branches: { include: [ main ] } }

pool: { vmImage: windows-latest }

variables:
  buildConfiguration: Release

steps:
  - task: UseDotNet@2
    inputs: { packageType: sdk, version: '8.x' }
  - script: dotnet restore
  - script: dotnet build --configuration $(buildConfiguration) --no-restore
  - script: dotnet test --no-build --logger:trx --collect:"XPlat Code Coverage"
  - task: PublishTestResults@2
    inputs: { testResultsFormat: VSTest, testResultsFiles: '**/*.trx' }
  - task: PublishPipelineArtifact@1
    inputs: { artifact: drop, targetPath: '$(Build.ArtifactStagingDirectory)' }
`;
    case "docker":
      return `trigger: { branches: { include: [ main ] } }

pool: { vmImage: ubuntu-latest }

variables:
  imageName: ${n}
  containerRegistry: cloudlabacr.azurecr.io

steps:
  - task: Docker@2
    displayName: Build image
    inputs:
      containerRegistry: cloudlab-acr-svc
      repository: $(imageName)
      command: build
      Dockerfile: '**/Dockerfile'
      tags: |
        $(Build.BuildId)
        latest
  - task: Docker@2
    displayName: Push image
    inputs:
      containerRegistry: cloudlab-acr-svc
      repository: $(imageName)
      command: push
      tags: $(Build.BuildId)
`;
    case "maven":
      return `trigger: { branches: { include: [ main ] } }

pool: { vmImage: ubuntu-latest }

steps:
  - task: JavaToolInstaller@0
    inputs: { versionSpec: '17', jdkArchitectureOption: x64, jdkSourceOption: PreInstalled }
  - task: Maven@4
    inputs:
      mavenPomFile: 'pom.xml'
      goals: 'package'
      publishJUnitResults: true
      testResultsFiles: '**/surefire-reports/TEST-*.xml'
  - task: PublishPipelineArtifact@1
    inputs: { targetPath: target, artifact: jar }
`;
    case "gradle":
      return `trigger: { branches: { include: [ main ] } }

pool: { vmImage: ubuntu-latest }

steps:
  - task: Gradle@3
    inputs:
      gradleWrapperFile: 'gradlew'
      tasks: 'build'
      publishJUnitResults: true
      testResultsFiles: '**/TEST-*.xml'
      javaHomeOption: JDKVersion
      jdkVersionOption: '1.17'
`;
    case "go":
      return `trigger: { branches: { include: [ main ] } }

pool: { vmImage: ubuntu-latest }

variables:
  GOBIN:  '$(GOPATH)/bin'
  GOPATH: '$(system.defaultWorkingDirectory)/gopath'

steps:
  - task: GoTool@0
    inputs: { version: '1.22' }
  - script: go mod tidy
  - script: go test ./... -coverprofile=coverage.out
  - script: go build -o $(Build.ArtifactStagingDirectory)/${n} ./...
  - task: PublishPipelineArtifact@1
    inputs: { targetPath: '$(Build.ArtifactStagingDirectory)', artifact: binary }
`;
    case "azurewebapp-node":
      return `trigger: { branches: { include: [ main ] } }

variables:
  azureSubscription: AzureRM-Prod
  webAppName: ${n}

stages:
  - stage: Build
    jobs:
      - job: Build
        pool: { vmImage: ubuntu-latest }
        steps:
          - task: NodeTool@0
            inputs: { versionSpec: '20.x' }
          - script: npm ci && npm run build --if-present
          - task: ArchiveFiles@2
            inputs:
              rootFolderOrFile: '$(System.DefaultWorkingDirectory)'
              includeRootFolder: false
              archiveFile: '$(Build.ArtifactStagingDirectory)/$(Build.BuildId).zip'
          - task: PublishPipelineArtifact@1
            inputs: { artifact: drop, targetPath: '$(Build.ArtifactStagingDirectory)' }
  - stage: Deploy
    dependsOn: Build
    jobs:
      - deployment: Deploy
        environment: prod
        pool: { vmImage: ubuntu-latest }
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: $(azureSubscription)
                    appType: webAppLinux
                    appName: $(webAppName)
                    package: '$(Pipeline.Workspace)/drop/*.zip'
`;
    case "azurefunction":
      return `trigger: { branches: { include: [ main ] } }

variables:
  azureSubscription: AzureRM-Prod
  functionAppName: ${n}

pool: { vmImage: ubuntu-latest }

steps:
  - task: UseDotNet@2
    inputs: { packageType: sdk, version: '8.x' }
  - script: dotnet publish -c Release -o publish
  - task: ArchiveFiles@2
    inputs:
      rootFolderOrFile: publish
      includeRootFolder: false
      archiveFile: '$(Build.ArtifactStagingDirectory)/$(Build.BuildId).zip'
  - task: AzureFunctionApp@2
    inputs:
      azureSubscription: $(azureSubscription)
      appType: functionApp
      appName: $(functionAppName)
      package: '$(Build.ArtifactStagingDirectory)/*.zip'
`;
    case "kubernetes":
      return `trigger: { branches: { include: [ main ] } }

variables:
  imageName: ${n}
  containerRegistry: cloudlabacr.azurecr.io
  k8sNamespace: prod

stages:
  - stage: Build
    jobs:
      - job: BuildImage
        pool: { vmImage: ubuntu-latest }
        steps:
          - task: Docker@2
            inputs:
              containerRegistry: cloudlab-acr-svc
              repository: $(imageName)
              command: buildAndPush
              tags: $(Build.BuildId)
  - stage: Deploy
    dependsOn: Build
    jobs:
      - deployment: K8sDeploy
        environment: aks-prod.cloudlab-prod
        pool: { vmImage: ubuntu-latest }
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@1
                  inputs:
                    action: deploy
                    namespace: $(k8sNamespace)
                    manifests: 'k8s/*.yaml'
                    containers: '$(containerRegistry)/$(imageName):$(Build.BuildId)'
`;
    case "existing":
      return `# Using existing azure-pipelines.yml from repo root.
# The build agent will pull this file from your selected branch.
`;
    case "starter":
    default:
      return `trigger: { branches: { include: [ main ] } }

pool: { vmImage: ubuntu-latest }

steps:
  - script: echo Hello, ${n}!
    displayName: 'Run a one-line script'
  - script: |
      echo Add other tasks to build, test, and deploy your project.
      echo See https://aka.ms/yaml
    displayName: 'Run a multi-line script'
`;
  }
}

// ============================================================================
// Shared bits
// ============================================================================

/** Visual chain of parsed stage names — ported from source's `showStageGraph` markup. */
function StageGraph({ stages }: { stages: string[] }) {
  if (!stages.length) return <EmptyState message="No stages parsed from this YAML." />;
  return (
    <div className={styles.stageGraph}>
      {stages.map((s, i) => (
        <span key={`${s}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className={styles.stageNode}>
            {i + 1}. {s}
          </span>
          {i < stages.length - 1 ? <span className={styles.stageArrow}>&rarr;</span> : null}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// 1. PipelinesYamlEditorPage — standalone YAML editor for EXISTING pipelines.
// ============================================================================

type ValidationResult = { ok: boolean; errors: string[] };

/** Ported verbatim from source's `validateYaml` — a lightweight heuristic, not a real parser. */
function validateYamlHeuristic(src: string): ValidationResult {
  const errors: string[] = [];
  if (src && src.indexOf("stages:") === -1 && src.indexOf("jobs:") === -1 && src.indexOf("steps:") === -1) {
    errors.push("No stages/jobs/steps block found");
  }
  if (/\t/.test(src)) errors.push("Tab character detected (YAML requires spaces)");
  return { ok: errors.length === 0, errors };
}

export function PipelinesYamlEditorPage({ state, dispatch }: { state: AdoState; dispatch: React.Dispatch<AdoAction> }) {
  const pipelines = state.pipelines;
  const [selectedId, setSelectedId] = useState<string>(pipelines[0]?.id ?? "");
  const pipeline = useMemo(() => pipelines.find((p) => p.id === selectedId) ?? null, [pipelines, selectedId]);

  const [yamlText, setYamlText] = useState<string>(pipeline?.yaml ?? "");
  const [loadedFor, setLoadedFor] = useState<string>(selectedId);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showGraph, setShowGraph] = useState(false);

  // Re-seed local textarea state whenever the selected pipeline changes (but
  // not on every re-render, so in-progress edits survive unrelated updates).
  if (loadedFor !== selectedId) {
    setYamlText(pipeline?.yaml ?? "");
    setLoadedFor(selectedId);
    setValidation(null);
    setShowGraph(false);
  }

  const previewStages = useMemo(() => parseStagesFromYaml(yamlText), [yamlText]);

  function handleSelectPipeline(id: string) {
    setSelectedId(id);
  }

  function handleSave() {
    if (!pipeline) return;
    dispatch({ type: "SET_PIPELINE_YAML", id: pipeline.id, yaml: yamlText });
    setValidation(null);
  }

  function handleValidate() {
    setValidation(validateYamlHeuristic(yamlText));
  }

  function handleShowStageGraph() {
    setShowGraph(true);
  }

  function handleRevert() {
    if (!pipeline) return;
    setYamlText(pipeline.yaml);
    setValidation(null);
    setShowGraph(false);
  }

  if (pipelines.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.pageH1}>YAML editor</div>
        <EmptyState message="No pipelines exist yet. Create one from Pipelines first." />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageH1}>YAML editor</div>
      <div className={styles.pageSub}>Edit a pipeline&apos;s YAML definition directly.</div>

      <div className={styles.formRow}>
        <label>Pipeline</label>
        <NativeSelect
          value={selectedId}
          onChange={handleSelectPipeline}
          options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>

      {pipeline ? (
        <div className={styles.card}>
          <div className={styles.cardH}>{pipeline.name}</div>
          <div className={styles.yamlHint}>Hint: stages, jobs, steps, dependsOn, condition, variables, pool</div>
          <textarea
            className={styles.input}
            rows={20}
            spellCheck={false}
            style={{
              width: "100%",
              fontFamily: "ui-monospace, Consolas, monospace",
              fontSize: 12.5,
              background: "#1e1e1e",
              color: "#d4d4d4",
              border: "1px solid #3c3c3c",
              resize: "vertical",
            }}
            value={yamlText}
            onChange={(e) => setYamlText(e.target.value)}
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className={styles.btnOutline} onClick={handleSave}>
              Save
            </button>
            <button type="button" className={styles.btnOutline} onClick={handleValidate}>
              Validate
            </button>
            <button type="button" className={styles.btnOutline} onClick={handleShowStageGraph}>
              Show parsed stage graph
            </button>
            <button type="button" className={styles.btnOutline} onClick={handleRevert}>
              Revert
            </button>
          </div>

          {validation ? (
            <div
              className={styles.card}
              style={{ marginTop: 10, borderColor: validation.ok ? "#92c5a3" : "#f3aaa3", background: validation.ok ? "#dff6dd" : "#fde7e9" }}
            >
              {validation.ok ? (
                <div style={{ color: "#0e660e" }}>YAML is valid.</div>
              ) : (
                <div style={{ color: "#a4262c" }}>
                  YAML errors: {validation.errors.join("; ")}
                </div>
              )}
            </div>
          ) : null}

          {showGraph ? (
            <div className={styles.card} style={{ marginTop: 10 }}>
              <div className={styles.cardH}>Parsed stage graph (current, unsaved textarea content)</div>
              <StageGraph stages={previewStages} />
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState message="Select a pipeline to edit its YAML." />
      )}
    </div>
  );
}

// ============================================================================
// 2. NewPipelineWizardModal — 4-step New Pipeline wizard.
// ============================================================================

type ConnectSource = "azurerepos" | "github" | "bitbucket" | "othergit";

const CONNECT_SOURCES: { id: ConnectSource; title: string; sub: string }[] = [
  { id: "azurerepos", title: "Azure Repos Git", sub: "Repositories in this organization" },
  { id: "github", title: "GitHub", sub: "github.com — public + private" },
  { id: "bitbucket", title: "Bitbucket Cloud", sub: "bitbucket.org workspaces" },
  { id: "othergit", title: "Other Git", sub: "Any Git server over HTTPS" },
];

function connectSourceLabel(source: ConnectSource): string {
  switch (source) {
    case "azurerepos":
      return "Azure Repos Git";
    case "github":
      return "GitHub";
    case "bitbucket":
      return "Bitbucket Cloud";
    case "othergit":
      return "Other Git";
  }
}

/** Derives the default pipeline name from a selected repo name — ported from source's `nameForPipeline()`. */
function nameForPipeline(repoSel: string): string {
  const base = (repoSel || "new-pipeline").replace(/^.*\//, "").replace(/\.git$/, "");
  return `${base}-CI`;
}

type WizStep = 1 | 2 | 3 | 4;

const STEP_LABELS: { step: WizStep; label: string }[] = [
  { step: 1, label: "Connect" },
  { step: 2, label: "Select" },
  { step: 3, label: "Configure" },
  { step: 4, label: "Review" },
];

function WizardStepIndicator({ step }: { step: WizStep }) {
  return (
    <div style={{ display: "flex", gap: 6, margin: "4px 0 16px" }}>
      {STEP_LABELS.map((s) => (
        <span
          key={s.step}
          className={`${styles.statePill} ${s.step === step ? styles.stateResolved : s.step < step ? styles.stateDone : styles.stateNew}`}
        >
          {s.step}. {s.label}
        </span>
      ))}
    </div>
  );
}

export function NewPipelineWizardModal({
  state,
  dispatch,
  onClose,
}: {
  state: AdoState;
  dispatch: React.Dispatch<AdoAction>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<WizStep>(1);
  const [source, setSource] = useState<ConnectSource | "">("");
  const [repoSel, setRepoSel] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [repoFilter, setRepoFilter] = useState("");
  const [template, setTemplate] = useState<PipelineTemplateId | "">("");
  const [name, setName] = useState("");
  const [yaml, setYaml] = useState("");

  const currentProject = state.projects.find((p) => p.id === state.currentProject);

  const azureRepos = useMemo(
    () =>
      state.repos
        .filter((r) => r.project === state.currentProject)
        .map((r) => ({ name: r.name, desc: r.defaultBranch ? `default: ${r.defaultBranch}` : "Azure Repos Git", lang: "-", updated: "recent" })),
    [state.repos, state.currentProject],
  );

  const repoList: SampleRepo[] = source === "azurerepos" ? azureRepos : source === "github" ? GH_REPOS : source === "bitbucket" ? BB_REPOS : [];

  const filteredRepos = useMemo(() => {
    const q = repoFilter.trim().toLowerCase();
    if (!q) return repoList;
    return repoList.filter((r) => `${r.name} ${r.desc} ${r.lang} ${r.updated}`.toLowerCase().includes(q));
  }, [repoList, repoFilter]);

  const previewStages = useMemo(() => parseStagesFromYaml(yaml), [yaml]);

  function goToSelect(src: ConnectSource) {
    setSource(src);
    setRepoFilter("");
    setStep(2);
  }

  function pickRepo(repoName: string) {
    setRepoSel(repoName);
    setName(nameForPipeline(repoName));
    setStep(3);
  }

  function pickOtherGit() {
    if (!repoUrl) return;
    const m = repoUrl.match(/\/([^/]+?)(?:\.git)?$/);
    const derived = m && m[1] ? m[1] : repoUrl;
    pickRepo(derived);
  }

  function pickTemplate(id: PipelineTemplateId) {
    setTemplate(id);
    setYaml(templateYaml(id, name));
  }

  function goBack() {
    setStep((s) => (s > 1 ? ((s - 1) as WizStep) : s));
  }

  function goNext() {
    if (step === 3) {
      if (!template || !name) return;
      setStep(4);
    }
  }

  function handleCreate() {
    if (!name) return;
    const safeId = `pl-${name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${Date.now().toString().slice(-5)}`;
    const pipeline: AdoPipeline = {
      id: safeId,
      name,
      project: state.currentProject,
      repo: repoSel,
      yaml,
      // ADD_PIPELINE re-derives `.stages` from `.yaml` via the real
      // parseStagesFromYaml internally — this initial value is just to
      // satisfy the AdoPipeline shape before dispatch.
      stages: parseStagesFromYaml(yaml),
      folder: "\\",
      source,
      createdBy: "Alex Johnson",
      createdAt: new Date().toISOString().substring(0, 10),
    };
    dispatch({ type: "ADD_PIPELINE", pipeline });
    onClose();
  }

  const canGoNextFromConfigure = !!template && name.length > 0;

  let body: React.ReactNode;

  if (step === 1) {
    body = (
      <>
        <p style={{ margin: "4px 0 10px", fontSize: 13 }}>Where is your code?</p>
        <div className={styles.npGrid}>
          {CONNECT_SOURCES.map((s) => (
            <div key={s.id} className={styles.npTile} onClick={() => goToSelect(s.id)}>
              <div className={styles.npTitle}>{s.title}</div>
              <div className={styles.npSub}>{s.sub}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 14, fontSize: 12, color: "#605e5c" }}>
          Labs simulates only the connect/select/configure flow. No outbound calls are made.
        </p>
      </>
    );
  } else if (step === 2) {
    const srcLabel = source ? connectSourceLabel(source) : "";
    body = (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "6px 0 12px" }}>
          <div>
            <strong>{srcLabel}</strong> &middot; Select a repository
          </div>
          <button type="button" className={styles.btnLink} onClick={goBack}>
            Change source
          </button>
        </div>

        {source === "othergit" ? (
          <>
            <div className={styles.formRow}>
              <label>Git repository URL</label>
              <input
                className={styles.input}
                placeholder="https://gitlab.com/team/repo.git"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <button type="button" className={styles.btnPrimary} onClick={pickOtherGit} disabled={!repoUrl}>
                Continue &raquo;
              </button>
            </div>
          </>
        ) : filteredRepos.length === 0 && repoList.length === 0 ? (
          <EmptyState message="No repositories found." />
        ) : (
          <>
            <div className={styles.formRow} style={{ marginBottom: 4 }}>
              <label>Filter</label>
              <input
                className={styles.input}
                placeholder="Filter repos..."
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
              />
            </div>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.tableClickable}`}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Language</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepos.map((r) => (
                    <tr key={r.name} onClick={() => pickRepo(r.name)}>
                      <td>{r.name}</td>
                      <td style={{ color: "#605e5c" }}>{r.desc}</td>
                      <td>{r.lang || "-"}</td>
                      <td style={{ color: "#605e5c" }}>{r.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </>
    );
  } else if (step === 3) {
    body = (
      <>
        <p style={{ margin: "4px 0 10px", fontSize: 13 }}>Configure your pipeline</p>
        <div className={styles.formRow}>
          <label>Pipeline name</label>
          <input className={styles.input} placeholder="my-app-CI" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ margin: "12px 0 8px", fontSize: 13 }}>
          <strong>Choose a template</strong>
        </div>
        <div className={styles.npGrid}>
          {TEMPLATES.map((t) => (
            <div
              key={t.id}
              className={styles.npTile}
              style={template === t.id ? { borderColor: "#0078d4", boxShadow: "0 0 0 2px #deecf9" } : undefined}
              onClick={() => pickTemplate(t.id)}
            >
              <div className={styles.npTitle}>{t.title}</div>
              <div className={styles.npSub}>{t.sub}</div>
            </div>
          ))}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <p style={{ margin: "4px 0 10px", fontSize: 13 }}>Review your pipeline YAML — you can edit before creating.</p>
        <div className={styles.card}>
          <div className={styles.cardH}>Summary</div>
          <div className={styles.row}>
            <span className={styles.lbl}>Source</span>
            <code>{source}</code>
          </div>
          <div className={styles.row}>
            <span className={styles.lbl}>Repository</span>
            <code>{repoSel}</code>
          </div>
          <div className={styles.row}>
            <span className={styles.lbl}>Template</span>
            <code>{template}</code>
          </div>
          <div className={styles.row}>
            <span className={styles.lbl}>Pipeline name</span>
            <code>{name}</code>
          </div>
          <div className={styles.row}>
            <span className={styles.lbl}>Project</span>
            <code>{currentProject?.name ?? state.currentProject}</code>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardH}>azure-pipelines.yml</div>
          <textarea
            className={styles.input}
            rows={16}
            spellCheck={false}
            style={{
              width: "100%",
              fontFamily: "ui-monospace, Consolas, monospace",
              fontSize: 12.5,
              background: "#1e1e1e",
              color: "#d4d4d4",
              border: "1px solid #3c3c3c",
              resize: "vertical",
            }}
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
          />
        </div>
        <div className={styles.card}>
          <div className={styles.cardH}>Stage preview</div>
          <StageGraph stages={previewStages} />
        </div>
      </>
    );
  }

  const footer = (
    <>
      <button type="button" className={styles.btnOutline} onClick={onClose}>
        Cancel
      </button>
      {step > 1 ? (
        <button type="button" className={styles.btnOutline} onClick={goBack}>
          &laquo; Back
        </button>
      ) : null}
      {step === 3 ? (
        <button type="button" className={styles.btnPrimary} onClick={goNext} disabled={!canGoNextFromConfigure}>
          Next &raquo;
        </button>
      ) : null}
      {step === 4 ? (
        <button type="button" className={styles.btnPrimary} onClick={handleCreate} disabled={!name}>
          Create pipeline
        </button>
      ) : null}
    </>
  );

  return (
    <Modal title="New pipeline" onClose={onClose} width="720px" footer={footer}>
      <WizardStepIndicator step={step} />
      {body}
    </Modal>
  );
}
