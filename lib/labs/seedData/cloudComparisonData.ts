/**
 * Cloud service comparison seed data — extracted from the source itbd-lab
 * static site (cloud-comparison.html). Used by the one-time admin seed
 * endpoint to populate the labs cloud-comparison table; not read directly
 * at request time.
 */

export type CloudComparisonSeedEntry = {
  category: string;
  label: string;
  azure: string;
  aws: string;
  gcp: string;
  note: string;
};

export const CLOUD_COMPARISON_SEED: CloudComparisonSeedEntry[] = [
  // ── Compute
  { "category": "Compute", "label": "VMs (IaaS)", "azure": "Virtual Machines", "aws": "EC2", "gcp": "Compute Engine", "note": "Standard VMs across all 3." },
  { "category": "Compute", "label": "Auto-scaling", "azure": "Virtual Machine Scale Sets", "aws": "Auto Scaling Groups", "gcp": "Managed Instance Groups", "note": "Scale by metric / schedule." },
  { "category": "Compute", "label": "Serverless functions", "azure": "Azure Functions", "aws": "Lambda", "gcp": "Cloud Functions", "note": "Both Azure + AWS have multiple plans (Consumption / Provisioned)." },
  { "category": "Compute", "label": "PaaS web hosting", "azure": "App Service", "aws": "Elastic Beanstalk", "gcp": "App Engine", "note": "App Service is the strongest PaaS web tier." },
  { "category": "Compute", "label": "Containers (managed)", "azure": "Container Apps / ACI", "aws": "ECS / Fargate", "gcp": "Cloud Run", "note": "Cloud Run is the cleanest serverless container." },
  { "category": "Compute", "label": "Kubernetes", "azure": "AKS", "aws": "EKS", "gcp": "GKE", "note": "GKE is the OG (Google created K8s). AKS catching up fast." },
  { "category": "Compute", "label": "Batch jobs", "azure": "Azure Batch", "aws": "AWS Batch", "gcp": "Cloud Run / Batch", "note": "For HPC / scientific workloads." },
  { "category": "Compute", "label": "Spot / preemptible", "azure": "Azure Spot VMs", "aws": "EC2 Spot Instances", "gcp": "Spot VMs", "note": "Up to 90% off, can be evicted with notice." },
  { "category": "Compute", "label": "Bare metal", "azure": "Azure VMware Solution + Bare Metal", "aws": "EC2 Bare Metal", "gcp": "Bare Metal Solution", "note": "For SAP HANA / specialised hardware needs." },

  // ── Storage
  { "category": "Storage", "label": "Block storage (disks)", "azure": "Managed Disks", "aws": "EBS", "gcp": "Persistent Disk", "note": "Premium SSD / Ultra Disk vs gp3 / io2." },
  { "category": "Storage", "label": "Object storage", "azure": "Azure Blob Storage", "aws": "S3", "gcp": "Cloud Storage", "note": "S3 is the industry standard. Blob is feature-parity." },
  { "category": "Storage", "label": "File shares (SMB/NFS)", "azure": "Azure Files", "aws": "EFS / FSx", "gcp": "Filestore", "note": "Azure Files supports SMB + NFS + AD-integrated auth." },
  { "category": "Storage", "label": "Archive tier", "azure": "Archive / Cool / Cold", "aws": "S3 Glacier (Instant/Flexible/Deep)", "gcp": "Coldline / Archive", "note": "AWS has 3 archive tiers, Azure has 4." },
  { "category": "Storage", "label": "Lifecycle management", "azure": "Blob Lifecycle Rules", "aws": "S3 Lifecycle Policies", "gcp": "Object Lifecycle Mgmt", "note": "Move between tiers by age / access." },
  { "category": "Storage", "label": "Sync (hybrid)", "azure": "Azure File Sync", "aws": "AWS Storage Gateway", "gcp": "Cloud Storage Transfer Service", "note": "Sync on-prem ↔ cloud." },
  { "category": "Storage", "label": "Backup", "azure": "Azure Backup + Recovery Vault", "aws": "AWS Backup", "gcp": "Backup and DR", "note": "All do VM/file/DB backup with retention policies." },

  // ── Networking
  { "category": "Networking", "label": "Virtual network", "azure": "VNet", "aws": "VPC", "gcp": "VPC", "note": "Same concept across all 3." },
  { "category": "Networking", "label": "Subnets", "azure": "Subnets in VNet", "aws": "Subnets in VPC", "gcp": "Subnets in VPC", "note": "Same." },
  { "category": "Networking", "label": "Firewall (managed)", "azure": "Azure Firewall", "aws": "AWS Network Firewall", "gcp": "Cloud NGFW (preview)", "note": "Azure Firewall Premium has TLS inspection." },
  { "category": "Networking", "label": "WAF", "azure": "Azure Front Door WAF / App Gateway WAF", "aws": "AWS WAF", "gcp": "Cloud Armor", "note": "AWS WAF is most mature." },
  { "category": "Networking", "label": "Load balancer (L4)", "azure": "Azure Load Balancer", "aws": "Network Load Balancer (NLB)", "gcp": "Cloud Load Balancing (TCP)", "note": "Standard L4 TCP/UDP." },
  { "category": "Networking", "label": "Load balancer (L7)", "azure": "Application Gateway", "aws": "Application Load Balancer (ALB)", "gcp": "Cloud Load Balancing (HTTP/S)", "note": "HTTP-aware routing." },
  { "category": "Networking", "label": "Global LB / CDN", "azure": "Front Door", "aws": "CloudFront", "gcp": "Cloud CDN", "note": "Front Door bundles WAF + DDoS + LB. CloudFront is a CDN." },
  { "category": "Networking", "label": "Hybrid connectivity", "azure": "ExpressRoute / VPN GW", "aws": "Direct Connect / VPN", "gcp": "Cloud Interconnect / VPN", "note": "ExpressRoute = Direct Connect = Interconnect." },
  { "category": "Networking", "label": "DNS", "azure": "Azure DNS", "aws": "Route 53", "gcp": "Cloud DNS", "note": "Route 53 has the best routing policies (latency, geolocation)." },
  { "category": "Networking", "label": "Private connectivity to PaaS", "azure": "Private Endpoint", "aws": "VPC Endpoint (PrivateLink)", "gcp": "Private Service Connect", "note": "All 3 support private connectivity." },

  // ── Identity + Security
  { "category": "Identity + Security", "label": "IAM", "azure": "Entra ID (Azure AD)", "aws": "IAM", "gcp": "Cloud IAM", "note": "Entra is also a SaaS identity for M365 + SaaS apps. IAM is cloud-only." },
  { "category": "Identity + Security", "label": "Federation", "azure": "Entra Connect / Fed", "aws": "IAM Identity Center (SSO)", "gcp": "Cloud Identity", "note": "Federate on-prem AD → cloud." },
  { "category": "Identity + Security", "label": "Privileged access (JIT)", "azure": "PIM (Entra)", "aws": "IAM Roles (no JIT native)", "gcp": "IAM Privileged Access (preview)", "note": "PIM is the most mature JIT identity model." },
  { "category": "Identity + Security", "label": "Secret store", "azure": "Key Vault", "aws": "Secrets Manager / KMS", "gcp": "Secret Manager / KMS", "note": "All 3 do secret + key storage." },
  { "category": "Identity + Security", "label": "SIEM", "azure": "Sentinel", "aws": "Security Lake + Security Hub", "gcp": "Chronicle / Security Command Center", "note": "Sentinel is most mature cloud-native SIEM." },
  { "category": "Identity + Security", "label": "XDR", "azure": "Defender XDR", "aws": "GuardDuty + Inspector + Macie + Detective", "gcp": "Security Command Center", "note": "Azure has the best unified XDR experience." },
  { "category": "Identity + Security", "label": "CSPM (posture)", "azure": "Defender for Cloud", "aws": "Security Hub", "gcp": "Security Command Center", "note": "All 3 score compliance against benchmarks." },
  { "category": "Identity + Security", "label": "DDoS protection", "azure": "DDoS Protection", "aws": "Shield (Standard / Advanced)", "gcp": "Cloud Armor", "note": "Free baseline tier on all 3. Paid tier for advanced." },
  { "category": "Identity + Security", "label": "Compliance manager", "azure": "Compliance Manager (Purview)", "aws": "Audit Manager", "gcp": "Compliance Reports Manager", "note": "Azure has most templates for regulations (DPDP, HIPAA, GDPR, FedRAMP)." },

  // ── Databases
  { "category": "Databases", "label": "Relational (SQL Server)", "azure": "Azure SQL DB / SQL MI", "aws": "RDS for SQL Server", "gcp": "SQL Server on VM", "note": "Azure has 1st-class SQL Server PaaS." },
  { "category": "Databases", "label": "Relational (PostgreSQL)", "azure": "Azure Database for PostgreSQL", "aws": "RDS PostgreSQL / Aurora", "gcp": "Cloud SQL for PostgreSQL", "note": "Aurora is faster but proprietary." },
  { "category": "Databases", "label": "Relational (MySQL)", "azure": "Azure Database for MySQL", "aws": "RDS MySQL / Aurora", "gcp": "Cloud SQL for MySQL", "note": "Same as PostgreSQL." },
  { "category": "Databases", "label": "NoSQL (document)", "azure": "Cosmos DB (Mongo API)", "aws": "DynamoDB / DocumentDB", "gcp": "Firestore / Datastore", "note": "Cosmos = best multi-region writes." },
  { "category": "Databases", "label": "Wide-column NoSQL", "azure": "Cosmos DB (Cassandra API)", "aws": "Keyspaces / DynamoDB", "gcp": "Bigtable", "note": "Bigtable was the original." },
  { "category": "Databases", "label": "Graph DB", "azure": "Cosmos DB (Gremlin API)", "aws": "Neptune", "gcp": "No native", "note": "Use Neo4j on Compute for GCP." },
  { "category": "Databases", "label": "In-memory", "azure": "Azure Cache for Redis", "aws": "ElastiCache (Redis / Memcached)", "gcp": "Memorystore", "note": "All 3 offer managed Redis." },
  { "category": "Databases", "label": "Data warehouse", "azure": "Synapse Analytics", "aws": "Redshift", "gcp": "BigQuery", "note": "BigQuery is the simplest serverless warehouse. Synapse is most enterprise." },
  { "category": "Databases", "label": "Time-series DB", "azure": "Azure Data Explorer / TimescaleDB on VM", "aws": "Timestream", "gcp": "Bigtable", "note": "Specialised time-series workloads." },

  // ── Data + Analytics
  { "category": "Data + Analytics", "label": "ETL / pipeline", "azure": "Azure Data Factory", "aws": "AWS Glue", "gcp": "Cloud Data Fusion / Dataflow", "note": "ADF has best low-code UI." },
  { "category": "Data + Analytics", "label": "Stream processing", "azure": "Stream Analytics / Event Hubs", "aws": "Kinesis Data Streams + Analytics", "gcp": "Pub/Sub + Dataflow", "note": "Real-time data ingestion + transformation." },
  { "category": "Data + Analytics", "label": "Batch (Spark)", "azure": "Azure Databricks / Synapse Spark", "aws": "EMR / Glue Spark", "gcp": "Dataproc / Dataflow", "note": "Databricks is cross-cloud actually." },
  { "category": "Data + Analytics", "label": "Data lake", "azure": "ADLS Gen2", "aws": "S3 + Lake Formation", "gcp": "Cloud Storage", "note": "ADLS = S3 with hierarchical namespace." },
  { "category": "Data + Analytics", "label": "BI / dashboards", "azure": "Power BI", "aws": "QuickSight", "gcp": "Looker", "note": "Power BI dominates enterprise." },
  { "category": "Data + Analytics", "label": "ML platform", "azure": "Azure ML / AI Foundry", "aws": "SageMaker", "gcp": "Vertex AI", "note": "Vertex AI is GCP's strongest area." },
  { "category": "Data + Analytics", "label": "Generative AI", "azure": "Azure OpenAI Service / AI Foundry", "aws": "Bedrock + Q", "gcp": "Vertex AI Studio / Gemini", "note": "Azure OpenAI exclusive partnership." },
  { "category": "Data + Analytics", "label": "Vector DB", "azure": "Azure AI Search / Cosmos vector", "aws": "OpenSearch / Aurora pgvector", "gcp": "Vertex Vector Search", "note": "For RAG patterns." },

  // ── DevOps + Observability
  { "category": "DevOps + Observability", "label": "Source control", "azure": "Azure DevOps Repos / GitHub", "aws": "CodeCommit (deprecated)", "gcp": "Cloud Source Repositories", "note": "GitHub dominates outside enterprise MS." },
  { "category": "DevOps + Observability", "label": "CI/CD", "azure": "Azure DevOps Pipelines / GitHub Actions", "aws": "CodePipeline + CodeBuild", "gcp": "Cloud Build", "note": "GitHub Actions is the new universal CI." },
  { "category": "DevOps + Observability", "label": "Container registry", "azure": "ACR", "aws": "ECR", "gcp": "Artifact Registry", "note": "Same concept." },
  { "category": "DevOps + Observability", "label": "IaC (cloud-native)", "azure": "Bicep / ARM", "aws": "CloudFormation / CDK", "gcp": "Deployment Manager", "note": "Terraform works on all 3." },
  { "category": "DevOps + Observability", "label": "Monitoring", "azure": "Azure Monitor / App Insights", "aws": "CloudWatch", "gcp": "Cloud Monitoring", "note": "Each has metrics + logs + traces + alerts." },
  { "category": "DevOps + Observability", "label": "Logs", "azure": "Log Analytics", "aws": "CloudWatch Logs", "gcp": "Cloud Logging", "note": "KQL vs CloudWatch Insights vs SQL-on-Logs." },
  { "category": "DevOps + Observability", "label": "APM / tracing", "azure": "Application Insights", "aws": "X-Ray", "gcp": "Cloud Trace", "note": "OpenTelemetry works on all 3." },
  { "category": "DevOps + Observability", "label": "Workflow orchestration", "azure": "Logic Apps", "aws": "Step Functions", "gcp": "Cloud Workflows", "note": "Step Functions is most mature." },

  // ── AI + Generative AI
  { "category": "AI + Generative AI", "label": "LLMs available", "azure": "OpenAI GPT-4o / o1 + open-source", "aws": "Anthropic Claude + Llama + Titan", "gcp": "Gemini + open-source", "note": "Azure has GPT-4 exclusive. Bedrock has Anthropic. GCP has Gemini." },
  { "category": "AI + Generative AI", "label": "ML platform", "azure": "Azure AI Foundry / ML", "aws": "SageMaker", "gcp": "Vertex AI", "note": "Each is the platform for their LLM stack." },
  { "category": "AI + Generative AI", "label": "Vector DB", "azure": "Azure AI Search", "aws": "OpenSearch / Aurora pgvector", "gcp": "Vertex Vector Search", "note": "All offer hybrid (vector + keyword)." },
  { "category": "AI + Generative AI", "label": "Computer Vision", "azure": "AI Vision", "aws": "Rekognition", "gcp": "Vision AI", "note": "Vision API + custom training." },
  { "category": "AI + Generative AI", "label": "NLP", "azure": "Language Studio (Azure)", "aws": "Comprehend", "gcp": "Natural Language API", "note": "Sentiment / entity / language detection." },
  { "category": "AI + Generative AI", "label": "Speech", "azure": "Speech Service", "aws": "Transcribe / Polly", "gcp": "Speech-to-Text / Text-to-Speech", "note": "STT + TTS." },
  { "category": "AI + Generative AI", "label": "Translation", "azure": "Translator", "aws": "Translate", "gcp": "Translation API", "note": "Language translation." },
  { "category": "AI + Generative AI", "label": "Content safety", "azure": "Azure Content Safety", "aws": "Comprehend Sensitive Content", "gcp": "Vertex AI Guard", "note": "Filter harmful AI outputs." },

  // ── Pricing / Cost
  { "category": "Pricing / Cost", "label": "Pricing transparency", "azure": "Azure Pricing Calculator", "aws": "AWS Calculator", "gcp": "GCP Calculator", "note": "AWS is most transparent. Azure changed pricing model for some recently." },
  { "category": "Pricing / Cost", "label": "Discount programs", "azure": "Reservations + Savings Plans + Hybrid Benefit", "aws": "Reserved Instances + Savings Plans", "gcp": "Committed Use Discounts + Sustained Use", "note": "AWS / Azure 1-3 year commits." },
  { "category": "Pricing / Cost", "label": "Sustained-use discount", "azure": "No native (RIs/SP only)", "aws": "No native", "gcp": "Automatic Sustained Use Discount", "note": "GCP's unique automatic discount." },
  { "category": "Pricing / Cost", "label": "Free tier (forever)", "azure": "Some services + $200 first 30 days", "aws": "12 months free + always-free", "gcp": "Always-free tier", "note": "AWS most generous free tier." },
  { "category": "Pricing / Cost", "label": "Cost analysis", "azure": "Cost Management", "aws": "Cost Explorer", "gcp": "Cloud Billing", "note": "All 3 have visualisations + alerts." },
  { "category": "Pricing / Cost", "label": "Anomaly detection", "azure": "Cost Management (Anomalies)", "aws": "Cost Anomaly Detection", "gcp": "Recommender", "note": "ML-based spend anomaly alerts." },
  { "category": "Pricing / Cost", "label": "Enterprise agreement", "azure": "Microsoft Customer Agreement (MCA)", "aws": "EDP / Enterprise", "gcp": "Enterprise Agreement", "note": "Negotiated discounts at scale." }
];
