import { deriveRunSteps } from "./flow-run-engine";
import { applyDlpFlags } from "./dlp-engine";
import type {
  PpApp,
  PpAuditEntry,
  PpBiWorkspace,
  PpCapacity,
  PpConnector,
  PpCopilotAction,
  PpCopilotBot,
  PpCopilotIntent,
  PpCopilotKnowledgeSource,
  PpCopilotState,
  PpCopilotTopic,
  PpEnvironment,
  PpFlow,
  PpFlowRun,
  PpLicense,
  PpMaker,
  PpPagesSite,
  PpPolicy,
  PpState,
} from "./types";

// ===== Deterministic seeded PRNG (Lehmer/Park-Miller LCG) =====
// Same simple LCG used across every ported simulator in this app (AVD/Defender/
// Sentinel/Purview/Azure DevOps) so seed data is stable across reloads within a
// session — no Math.random() anywhere in this file.
function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ===================================================================
// Connector catalog — ported verbatim from pp-data.js CONNECTORS + SYNTH_LIST
// ===================================================================

const CONNECTORS_BASE: PpConnector[] = [
  // Microsoft 365 + business productivity (default Business)
  { id: "sharepointonline", name: "SharePoint", publisher: "Microsoft", def: "Business", premium: false },
  { id: "office365users", name: "Office 365 Users", publisher: "Microsoft", def: "Business", premium: false },
  { id: "office365groups", name: "Office 365 Groups", publisher: "Microsoft", def: "Business", premium: false },
  { id: "office365outlook", name: "Office 365 Outlook", publisher: "Microsoft", def: "Business", premium: false },
  { id: "onedrive", name: "OneDrive", publisher: "Microsoft", def: "Business", premium: false },
  { id: "onedriveforbusiness", name: "OneDrive for Business", publisher: "Microsoft", def: "Business", premium: false },
  { id: "teams", name: "Microsoft Teams", publisher: "Microsoft", def: "Business", premium: false },
  { id: "onenote", name: "OneNote (Business)", publisher: "Microsoft", def: "Business", premium: false },
  { id: "excelonlinebusiness", name: "Excel Online (Business)", publisher: "Microsoft", def: "Business", premium: false },
  { id: "wordonline", name: "Word Online", publisher: "Microsoft", def: "Business", premium: false },
  { id: "planner", name: "Planner", publisher: "Microsoft", def: "Business", premium: false },
  { id: "mip", name: "Microsoft Information Protection", publisher: "Microsoft", def: "Business", premium: true },
  { id: "forms", name: "Microsoft Forms", publisher: "Microsoft", def: "Business", premium: false },
  { id: "todo", name: "Microsoft To Do", publisher: "Microsoft", def: "Business", premium: false },
  { id: "approvals", name: "Approvals", publisher: "Microsoft", def: "Business", premium: false },
  { id: "cds", name: "Common Data Service", publisher: "Microsoft", def: "Business", premium: true },
  { id: "dataverse", name: "Microsoft Dataverse", publisher: "Microsoft", def: "Business", premium: true },
  { id: "dynamics365sales", name: "Dynamics 365 Sales", publisher: "Microsoft", def: "Business", premium: true },
  { id: "dynamics365finance", name: "Dynamics 365 Finance", publisher: "Microsoft", def: "Business", premium: true },
  { id: "powerbi", name: "Power BI", publisher: "Microsoft", def: "Business", premium: false },
  { id: "sqlserver", name: "SQL Server", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azuread", name: "Microsoft Entra ID", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azureblob", name: "Azure Blob Storage", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azurequeues", name: "Azure Queues", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azuretables", name: "Azure Table Storage", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azurefiles", name: "Azure File Storage", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azurekeyvault", name: "Azure Key Vault", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azureservicebus", name: "Azure Service Bus", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azureeventgrid", name: "Azure Event Grid", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azurefunctions", name: "Azure Functions", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azuredevops", name: "Azure DevOps", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azureautomation", name: "Azure Automation", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azurelogapps", name: "Azure Log Analytics", publisher: "Microsoft", def: "Business", premium: true },
  { id: "sentinel", name: "Microsoft Sentinel", publisher: "Microsoft", def: "Business", premium: true },
  { id: "defender", name: "Microsoft Defender for Endpoint", publisher: "Microsoft", def: "Business", premium: true },
  { id: "intune", name: "Microsoft Intune", publisher: "Microsoft", def: "Business", premium: true },
  { id: "graphapi", name: "Microsoft Graph", publisher: "Microsoft", def: "Business", premium: true },
  { id: "powervirtualagents", name: "Power Virtual Agents", publisher: "Microsoft", def: "Business", premium: true },
  { id: "copilotstudio", name: "Microsoft Copilot Studio", publisher: "Microsoft", def: "Business", premium: true },
  { id: "powerapps", name: "Power Apps for Admins", publisher: "Microsoft", def: "Business", premium: true },
  { id: "powerautomate", name: "Power Automate Management", publisher: "Microsoft", def: "Business", premium: true },
  { id: "aibuilder", name: "AI Builder", publisher: "Microsoft", def: "Business", premium: true },
  { id: "kusto", name: "Azure Data Explorer", publisher: "Microsoft", def: "Business", premium: true },
  { id: "azuremlservices", name: "Azure Machine Learning", publisher: "Microsoft", def: "Business", premium: true },

  // Third-party enterprise (often Business)
  { id: "salesforce", name: "Salesforce", publisher: "Salesforce.com", def: "Business", premium: true },
  { id: "oracledb", name: "Oracle Database", publisher: "Oracle", def: "Business", premium: true },
  { id: "mysql", name: "MySQL", publisher: "Oracle", def: "Business", premium: true },
  { id: "postgresql", name: "PostgreSQL", publisher: "PostgreSQL", def: "Business", premium: true },
  { id: "mongodb", name: "MongoDB", publisher: "MongoDB", def: "Business", premium: true },
  { id: "amazons3", name: "Amazon S3", publisher: "Amazon", def: "Business", premium: true },
  { id: "awsredshift", name: "AWS Redshift", publisher: "Amazon", def: "Business", premium: true },
  { id: "gcs", name: "Google Cloud Storage", publisher: "Google", def: "Business", premium: true },
  { id: "snowflake", name: "Snowflake", publisher: "Snowflake", def: "Business", premium: true },
  { id: "sapsuccessfactors", name: "SAP SuccessFactors", publisher: "SAP", def: "Business", premium: true },
  { id: "saperp", name: "SAP ERP", publisher: "SAP", def: "Business", premium: true },
  { id: "workday", name: "Workday", publisher: "Workday", def: "Business", premium: true },
  { id: "servicenow", name: "ServiceNow", publisher: "ServiceNow", def: "Business", premium: true },
  { id: "jiraserver", name: "Jira Software", publisher: "Atlassian", def: "Business", premium: true },
  { id: "jiracloud", name: "Jira Cloud", publisher: "Atlassian", def: "Business", premium: true },
  { id: "confluence", name: "Confluence", publisher: "Atlassian", def: "Business", premium: true },
  { id: "bitbucket", name: "Bitbucket", publisher: "Atlassian", def: "Business", premium: true },
  { id: "github", name: "GitHub", publisher: "GitHub", def: "Business", premium: true },
  { id: "gitlab", name: "GitLab", publisher: "GitLab", def: "Business", premium: true },
  { id: "docusign", name: "DocuSign", publisher: "DocuSign", def: "Business", premium: true },
  { id: "adobesign", name: "Adobe Sign", publisher: "Adobe", def: "Business", premium: true },
  { id: "zendesk", name: "Zendesk", publisher: "Zendesk", def: "Business", premium: true },
  { id: "hubspot", name: "HubSpot", publisher: "HubSpot", def: "Business", premium: true },
  { id: "mailchimp", name: "MailChimp", publisher: "MailChimp", def: "Business", premium: true },
  { id: "stripe", name: "Stripe", publisher: "Stripe", def: "Business", premium: true },
  { id: "paypal", name: "PayPal", publisher: "PayPal", def: "Business", premium: true },
  { id: "shopify", name: "Shopify", publisher: "Shopify", def: "Business", premium: true },
  { id: "box", name: "Box", publisher: "Box", def: "Business", premium: true },
  { id: "okta", name: "Okta", publisher: "Okta", def: "Business", premium: true },
  { id: "pagerduty", name: "PagerDuty", publisher: "PagerDuty", def: "Business", premium: true },
  { id: "slackbusiness", name: "Slack", publisher: "Slack", def: "Business", premium: false },
  { id: "webex", name: "Cisco Webex Teams", publisher: "Cisco", def: "Business", premium: true },

  // Non-business default (consumer / social / personal)
  { id: "gmail", name: "Gmail", publisher: "Google", def: "Non-business", premium: false },
  { id: "googlecalendar", name: "Google Calendar", publisher: "Google", def: "Non-business", premium: false },
  { id: "googledrive", name: "Google Drive", publisher: "Google", def: "Non-business", premium: false },
  { id: "googlesheets", name: "Google Sheets", publisher: "Google", def: "Non-business", premium: false },
  { id: "googletasks", name: "Google Tasks", publisher: "Google", def: "Non-business", premium: false },
  { id: "googlecontacts", name: "Google Contacts", publisher: "Google", def: "Non-business", premium: false },
  { id: "youtube", name: "YouTube", publisher: "Google", def: "Non-business", premium: false },
  { id: "bingsearch", name: "Bing Search", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "bingmaps", name: "Bing Maps", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "msnweather", name: "MSN Weather", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "translatorv2", name: "Microsoft Translator", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "rss", name: "RSS", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "outlookcom", name: "Outlook.com", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "office365outlookpersonal", name: "Outlook (Personal)", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "twilio", name: "Twilio", publisher: "Twilio", def: "Non-business", premium: true },
  { id: "twitter", name: "X (Twitter)", publisher: "X", def: "Non-business", premium: false },
  { id: "facebook", name: "Facebook", publisher: "Meta", def: "Non-business", premium: false },
  { id: "instagram", name: "Instagram", publisher: "Meta", def: "Non-business", premium: false },
  { id: "linkedinv2", name: "LinkedIn", publisher: "LinkedIn", def: "Non-business", premium: false },
  { id: "pinterest", name: "Pinterest", publisher: "Pinterest", def: "Non-business", premium: false },
  { id: "reddit", name: "Reddit", publisher: "Reddit", def: "Non-business", premium: false },
  { id: "medium", name: "Medium", publisher: "Medium", def: "Non-business", premium: false },
  { id: "dropbox", name: "Dropbox", publisher: "Dropbox", def: "Non-business", premium: false },
  { id: "evernote", name: "Evernote", publisher: "Evernote", def: "Non-business", premium: false },
  { id: "wunderlist", name: "Wunderlist", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "trello", name: "Trello", publisher: "Atlassian", def: "Non-business", premium: false },
  { id: "asana", name: "Asana", publisher: "Asana", def: "Non-business", premium: true },
  { id: "todoist", name: "Todoist", publisher: "Todoist", def: "Non-business", premium: false },
  { id: "pushbullet", name: "Pushbullet", publisher: "Pushbullet", def: "Non-business", premium: false },
  { id: "evgenericrss", name: "Generic RSS Feed", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "wordpress", name: "WordPress", publisher: "WordPress", def: "Non-business", premium: false },
  { id: "tumblr", name: "Tumblr", publisher: "Tumblr", def: "Non-business", premium: false },
  { id: "spotify", name: "Spotify", publisher: "Spotify", def: "Non-business", premium: false },
  { id: "eventbrite", name: "Eventbrite", publisher: "Eventbrite", def: "Non-business", premium: false },
  { id: "meetup", name: "Meetup", publisher: "Meetup", def: "Non-business", premium: false },
  { id: "survey123", name: "Survey123", publisher: "Esri", def: "Non-business", premium: true },
  { id: "mailchimppersonal", name: "MailChimp (Personal)", publisher: "MailChimp", def: "Non-business", premium: false },
  { id: "flickr", name: "Flickr", publisher: "Flickr", def: "Non-business", premium: false },
  { id: "github_personal", name: "GitHub (Personal)", publisher: "GitHub", def: "Non-business", premium: false },
  { id: "instapaper", name: "Instapaper", publisher: "Instapaper", def: "Non-business", premium: false },
  { id: "pocket", name: "Pocket", publisher: "Pocket", def: "Non-business", premium: false },
  { id: "feedly", name: "Feedly", publisher: "Feedly", def: "Non-business", premium: false },
  { id: "pinterestpersonal", name: "Pinterest (Personal)", publisher: "Pinterest", def: "Non-business", premium: false },
  { id: "foursquare", name: "Foursquare", publisher: "Foursquare", def: "Non-business", premium: false },
  { id: "yammer", name: "Yammer", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "discord", name: "Discord (HTTP webhook)", publisher: "Community", def: "Non-business", premium: false },
  { id: "whatsapp", name: "WhatsApp Business", publisher: "Meta", def: "Non-business", premium: true },
  { id: "telegram", name: "Telegram", publisher: "Telegram", def: "Non-business", premium: false },
  { id: "cognitivetext", name: "Text Analytics", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "cognitivevision", name: "Computer Vision", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "cognitiveface", name: "Face API", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "cognitivespeech", name: "Speech to Text", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "cognitiveluis", name: "LUIS", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "cognitiveqna", name: "QnA Maker", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "cognitiveformrecog", name: "Form Recognizer", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "azureopenai", name: "Azure OpenAI", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "openai", name: "OpenAI", publisher: "OpenAI", def: "Non-business", premium: true },
  { id: "youtubeanalytics", name: "YouTube Analytics", publisher: "Google", def: "Non-business", premium: false },
  { id: "mailgun", name: "Mailgun", publisher: "Mailgun", def: "Non-business", premium: false },
  { id: "sendgrid", name: "SendGrid", publisher: "Twilio", def: "Non-business", premium: true },
  { id: "smtp", name: "SMTP", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "pop3", name: "POP3", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "imap", name: "IMAP", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "webhooks", name: "HTTP with Azure AD", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "http", name: "HTTP", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "ftp", name: "FTP", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "sftp", name: "SFTP - SSH", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "fileSystem", name: "File System (on-prem)", publisher: "Microsoft", def: "Non-business", premium: true },
  { id: "parserss", name: "Parse RSS", publisher: "Microsoft", def: "Non-business", premium: false },
  { id: "pdf4me", name: "PDF4me", publisher: "PDF4me", def: "Non-business", premium: true },
  { id: "docparser", name: "DocParser", publisher: "DocParser", def: "Non-business", premium: true },
  { id: "plivosms", name: "Plivo SMS", publisher: "Plivo", def: "Non-business", premium: true },
  { id: "nexmosms", name: "Vonage SMS API", publisher: "Vonage", def: "Non-business", premium: true },
  { id: "msteamsuser", name: "Microsoft Teams (User)", publisher: "Microsoft", def: "Non-business", premium: false },

  // Default blocked (high-risk / non-compliant)
  { id: "tor", name: "Tor proxy connector", publisher: "Community", def: "Blocked", premium: false },
  { id: "pastebin", name: "Pastebin", publisher: "Pastebin", def: "Blocked", premium: false },
];

// Synthetic padding entries — ported verbatim from pp-data.js SYNTH_LIST, distributed
// Business/Non-business per `i % 3 === 0` (never Blocked), `premium: i % 4 !== 0`.
const SYNTH_LIST: [string, string, string][] = [
  ["hipchat", "HipChat (Legacy)", "Atlassian"],
  ["kissflow", "Kissflow", "Kissflow"],
  ["lobio", "LinkedIn Ads", "LinkedIn"],
  ["adobepdf", "Adobe PDF Services", "Adobe"],
  ["mongolab", "MongoLab", "MongoLab"],
  ["ironclad", "Ironclad", "Ironclad"],
  ["vimeo", "Vimeo", "Vimeo"],
  ["stackoverflow", "Stack Overflow", "Stack Exchange"],
  ["signalfx", "SignalFX", "SignalFX"],
  ["datadog", "Datadog", "Datadog"],
  ["newrelic", "New Relic", "New Relic"],
  ["splunk", "Splunk", "Splunk"],
  ["elastic", "Elasticsearch", "Elastic"],
  ["cosmosdb", "Azure Cosmos DB", "Microsoft"],
  ["ibmdb2", "IBM DB2", "IBM"],
  ["informix", "Informix", "IBM"],
  ["teradata", "Teradata", "Teradata"],
  ["sap", "SAP S/4HANA", "SAP"],
  ["marketo", "Marketo", "Adobe"],
  ["pardot", "Pardot", "Salesforce"],
  ["eloqua", "Oracle Eloqua", "Oracle"],
  ["mailchimpads", "MailChimp Ads", "MailChimp"],
  ["campaignmonitor", "Campaign Monitor", "Campaign Monitor"],
  ["constantcontact", "Constant Contact", "Constant Contact"],
  ["intercom", "Intercom", "Intercom"],
  ["freshdesk", "Freshdesk", "Freshworks"],
  ["freshservice", "Freshservice", "Freshworks"],
  ["monday", "Monday.com", "monday.com"],
  ["airtable", "Airtable", "Airtable"],
  ["notion", "Notion", "Notion Labs"],
  ["clickup", "ClickUp", "ClickUp"],
  ["basecamp", "Basecamp", "37signals"],
  ["miro", "Miro", "Miro"],
  ["figma", "Figma", "Figma"],
  ["mural", "Mural", "Mural"],
  ["lucidchart", "Lucidchart", "Lucid"],
  ["drawio", "draw.io", "JGraph"],
  ["canva", "Canva", "Canva"],
  ["unsplash", "Unsplash", "Unsplash"],
  ["giphy", "Giphy", "Giphy"],
  ["hyperlinkr", "Bitly", "Bitly"],
  ["typeform", "Typeform", "Typeform"],
  ["jotform", "JotForm", "JotForm"],
  ["surveymonkey", "SurveyMonkey", "SurveyMonkey"],
  ["cognitoforms", "Cognito Forms", "Cognito Forms"],
  ["wufoo", "Wufoo", "SurveyMonkey"],
  ["gmailtask", "Gmail Tasks (legacy)", "Google"],
  ["box2", "Box (Personal)", "Box"],
  ["icontact", "iContact", "iContact"],
  ["squarespace", "Squarespace", "Squarespace"],
  ["wix", "Wix", "Wix"],
  ["weebly", "Weebly", "Square"],
  ["hubspotcrm", "HubSpot CRM", "HubSpot"],
  ["zoho", "Zoho CRM", "Zoho"],
  ["zohobooks", "Zoho Books", "Zoho"],
  ["quickbooks", "QuickBooks Online", "Intuit"],
  ["xero", "Xero", "Xero"],
  ["freshbooks", "FreshBooks", "FreshBooks"],
  ["expensify", "Expensify", "Expensify"],
  ["concur", "SAP Concur", "SAP"],
  ["greenhouse", "Greenhouse", "Greenhouse"],
  ["lever", "Lever", "Lever"],
  ["bamboohr", "BambooHR", "BambooHR"],
  ["gusto", "Gusto", "Gusto"],
  ["adp", "ADP", "ADP"],
  ["paychex", "Paychex", "Paychex"],
  ["stripebill", "Stripe Billing", "Stripe"],
  ["squareup", "Square", "Block"],
  ["paystack", "Paystack", "Paystack"],
  ["razorpay", "Razorpay", "Razorpay"],
  ["paytm", "Paytm", "Paytm"],
  ["braze", "Braze", "Braze"],
  ["onesignal", "OneSignal", "OneSignal"],
  ["firebasemsg", "Firebase Cloud Messaging", "Google"],
  ["pushover", "Pushover", "Pushover"],
  ["kafkacc", "Confluent Kafka", "Confluent"],
  ["rabbitmq", "RabbitMQ", "VMware"],
  ["solace", "Solace", "Solace"],
  ["mulesoft", "MuleSoft", "Salesforce"],
  ["boomi", "Boomi", "Boomi"],
  ["informatica", "Informatica", "Informatica"],
  ["talend", "Talend", "Qlik"],
  ["fivetran", "Fivetran", "Fivetran"],
  ["matillion", "Matillion", "Matillion"],
  ["dbt", "dbt Cloud", "dbt Labs"],
  ["azuredatafactory", "Azure Data Factory", "Microsoft"],
  ["adlsgen2", "Azure Data Lake Gen2", "Microsoft"],
  ["synapse", "Azure Synapse Analytics", "Microsoft"],
  ["fabric", "Microsoft Fabric", "Microsoft"],
  ["purview", "Microsoft Purview", "Microsoft"],
  ["cosmosgremlin", "Cosmos Gremlin", "Microsoft"],
  ["azuredatabricks", "Azure Databricks", "Databricks"],
  ["hadoop", "Apache Hadoop HDFS", "Apache"],
  ["hive", "Apache Hive", "Apache"],
  ["impala", "Apache Impala", "Apache"],
  ["neo4j", "Neo4j", "Neo4j"],
  ["redis", "Redis", "Redis"],
  ["memcached", "Memcached", "Community"],
  ["rabbitsftp", "sftp (legacy)", "Microsoft"],
  ["azurelogicapps", "Azure Logic Apps", "Microsoft"],
  ["githubactions", "GitHub Actions", "GitHub"],
  ["jenkins", "Jenkins", "CloudBees"],
  ["terraformcloud", "Terraform Cloud", "HashiCorp"],
];

const SYNTH_CONNECTORS: PpConnector[] = SYNTH_LIST.map(([id, name, publisher], i) => ({
  id,
  name,
  publisher,
  def: i % 3 === 0 ? "Business" : "Non-business",
  premium: i % 4 !== 0,
}));

const CONNECTORS: PpConnector[] = [...CONNECTORS_BASE, ...SYNTH_CONNECTORS];

// ===================================================================
// Environments — ported from pp-data.js seedEnvironments()
// ===================================================================

function seedEnvironments(): PpEnvironment[] {
  const now = Date.now();
  return [
    {
      id: "env-default",
      name: "CloudLab (default)",
      description: "The default environment automatically provisioned for the tenant.",
      type: "Default",
      state: "Ready",
      region: "India",
      createdOn: "2022-04-12T09:30:00Z",
      createdBy: "System",
      owner: "admin@itbd.net",
      url: "https://orgcloudlab.crm8.dynamics.com",
      dataverseEnabled: true,
      dataverseVersion: "9.2.24013.00208",
      databaseSizeMB: 980,
      capacityGB: 10,
      language: "English (United States)",
      currency: "INR - Indian Rupee",
      securityGroup: null,
      trialExpiresOn: null,
      users: [
        { upn: "admin@cloudlab.in", role: "System Administrator" },
        { upn: "admin@itbd.net", role: "System Customizer" },
        { upn: "sneha@cloudlab.in", role: "Basic User" },
      ],
    },
    {
      id: "env-prod",
      name: "CloudLab Production",
      description: "Production environment for line-of-business apps and flows.",
      type: "Production",
      state: "Ready",
      region: "India",
      createdOn: "2023-01-20T11:15:00Z",
      createdBy: "admin@cloudlab.in",
      owner: "admin@itbd.net",
      url: "https://cloudlab-prod.crm8.dynamics.com",
      dataverseEnabled: true,
      dataverseVersion: "9.2.24013.00208",
      databaseSizeMB: 4320,
      capacityGB: 25,
      language: "English (United States)",
      currency: "INR - Indian Rupee",
      securityGroup: "Power Platform Admins",
      trialExpiresOn: null,
      users: [
        { upn: "admin@cloudlab.in", role: "System Administrator" },
        { upn: "admin@itbd.net", role: "System Customizer" },
        { upn: "rahul@cloudlab.in", role: "Environment Maker" },
        { upn: "meera@cloudlab.in", role: "Basic User" },
        { upn: "arjun@cloudlab.in", role: "Salesperson" },
      ],
    },
    {
      id: "env-sandbox",
      name: "CloudLab Sandbox-Dev",
      description: "Sandbox environment for development and integration testing.",
      type: "Sandbox",
      state: "Ready",
      region: "India",
      createdOn: "2023-06-04T14:22:00Z",
      createdBy: "admin@itbd.net",
      owner: "admin@itbd.net",
      url: "https://cloudlab-dev.crm8.dynamics.com",
      dataverseEnabled: true,
      dataverseVersion: "9.2.24013.00208",
      databaseSizeMB: 1640,
      capacityGB: 5,
      language: "English (United States)",
      currency: "INR - Indian Rupee",
      securityGroup: "Power Platform Devs",
      trialExpiresOn: null,
      users: [
        { upn: "admin@itbd.net", role: "System Administrator" },
        { upn: "rahul@cloudlab.in", role: "System Customizer" },
      ],
    },
    {
      id: "env-trial",
      name: "Test (Trial)",
      description: "Trial environment for evaluating new connectors and apps.",
      type: "Trial",
      state: "Ready",
      region: "India",
      createdOn: new Date(now - 7 * 24 * 3600 * 1000).toISOString(),
      createdBy: "rahul@cloudlab.in",
      owner: "karthik@cloudlab.in",
      url: "https://cloudlab-trial.crm8.dynamics.com",
      dataverseEnabled: false,
      dataverseVersion: "",
      databaseSizeMB: 0,
      capacityGB: 1,
      language: "English (United States)",
      currency: "INR - Indian Rupee",
      securityGroup: null,
      trialExpiresOn: new Date(now + 23 * 24 * 3600 * 1000).toISOString(),
      users: [{ upn: "rahul@cloudlab.in", role: "System Administrator" }],
    },
  ];
}

// ===================================================================
// Apps — ported from pp-data.js seedApps() (12 apps)
// ===================================================================

function seedApps(): PpApp[] {
  return [
    { id: "app-1", name: "Expense Report", type: "Canvas", owner: "admin@itbd.net", envId: "env-prod", created: "2023-02-12", modified: "2024-09-04", sharedCount: 24, connectors: ["sharepointonline", "office365outlook", "office365users"] },
    { id: "app-2", name: "Field Service Mobile", type: "Canvas", owner: "karthik@cloudlab.in", envId: "env-prod", created: "2023-04-09", modified: "2024-10-22", sharedCount: 12, connectors: ["sqlserver", "bingmaps", "office365users"] },
    { id: "app-3", name: "Customer 360 Account", type: "Model-driven", owner: "admin@itbd.net", envId: "env-prod", created: "2023-03-11", modified: "2024-08-15", sharedCount: 48, connectors: ["dataverse", "office365outlook"] },
    { id: "app-4", name: "Visitor Sign-in", type: "Canvas", owner: "meera@cloudlab.in", envId: "env-prod", created: "2023-07-22", modified: "2024-06-18", sharedCount: 7, connectors: ["sharepointonline", "office365users"] },
    { id: "app-5", name: "Asset Inventory", type: "Model-driven", owner: "admin@itbd.net", envId: "env-sandbox", created: "2023-08-15", modified: "2024-11-02", sharedCount: 3, connectors: ["dataverse", "sqlserver"] },
    { id: "app-6", name: "Leave Request", type: "Canvas", owner: "sneha@cloudlab.in", envId: "env-default", created: "2022-09-30", modified: "2024-03-11", sharedCount: 95, connectors: ["sharepointonline", "office365outlook", "approvals"] },
    { id: "app-7", name: "Project Tracker", type: "Canvas", owner: "karthik@cloudlab.in", envId: "env-prod", created: "2024-01-04", modified: "2024-11-20", sharedCount: 18, connectors: ["planner", "office365outlook", "teams"] },
    { id: "app-8", name: "IT Helpdesk", type: "Model-driven", owner: "admin@itbd.net", envId: "env-prod", created: "2023-05-18", modified: "2024-10-09", sharedCount: 31, connectors: ["dataverse", "servicenow", "teams"] },
    { id: "app-9", name: "Inspection Checklist", type: "Canvas", owner: "admin@itbd.net", envId: "env-sandbox", created: "2024-02-27", modified: "2024-09-19", sharedCount: 6, connectors: ["sharepointonline", "onedriveforbusiness"] },
    { id: "app-10", name: "Sales Pipeline Forecast", type: "Model-driven", owner: "arjun@cloudlab.in", envId: "env-prod", created: "2023-11-14", modified: "2024-10-30", sharedCount: 14, connectors: ["dataverse", "dynamics365sales", "powerbi"] },
    { id: "app-11", name: "Training Sign-up", type: "Canvas", owner: "meera@cloudlab.in", envId: "env-default", created: "2024-04-08", modified: "2024-08-25", sharedCount: 56, connectors: ["forms", "sharepointonline", "teams"] },
    // app-12: intentionally kept as a genuine DLP conflict — mixes a Business connector
    // (sharepointonline) with a consumer/Non-business connector (dropbox) in env-prod,
    // where dlp-2 "Production — Strict" classifies dropbox as Blocked outright (and
    // dlp-1's tenant policy would also flag the Business/Non-business mix). This gives
    // the DLP engine at least one real seeded conflict to catch end-to-end.
    { id: "app-12", name: "Vendor Onboarding", type: "Canvas", owner: "karthik@cloudlab.in", envId: "env-sandbox", created: "2024-03-19", modified: "2024-11-12", sharedCount: 2, connectors: ["sharepointonline", "docusign", "office365outlook"] },
  ];
}

// ===================================================================
// Flows — ported from pp-data.js seedFlows() (18 flows)
// ===================================================================

function seedFlowDefs(): Omit<PpFlow, "dlpFlagged" | "dlpFlagReason">[] {
  return [
    { id: "flow-1", name: "New SharePoint item to Teams", type: "Cloud", owner: "admin@itbd.net", envId: "env-prod", status: "On", trigger: "When an item is created (SharePoint)", lastRun: "2024-11-22T08:14:00Z", total: 2418, success: 2391, failed: 27, connectors: ["sharepointonline", "teams"] },
    { id: "flow-2", name: "Daily HR digest email", type: "Cloud", owner: "meera@cloudlab.in", envId: "env-prod", status: "On", trigger: "Recurrence (Daily 08:00)", lastRun: "2024-11-22T02:30:00Z", total: 612, success: 610, failed: 2, connectors: ["office365outlook", "sharepointonline"] },
    { id: "flow-3", name: "Approval routing — Leave", type: "Cloud", owner: "sneha@cloudlab.in", envId: "env-default", status: "On", trigger: "When a new email arrives (Outlook)", lastRun: "2024-11-21T16:50:00Z", total: 88, success: 86, failed: 2, connectors: ["office365outlook", "approvals", "teams"] },
    { id: "flow-4", name: "Salesforce lead to Dataverse", type: "Cloud", owner: "arjun@cloudlab.in", envId: "env-prod", status: "On", trigger: "When a record is created (Salesforce)", lastRun: "2024-11-22T07:20:00Z", total: 415, success: 401, failed: 14, connectors: ["salesforce", "dataverse"] },
    // flow-5: intentionally kept as a genuine DLP conflict — 'twitter' is explicitly
    // Blocked under dlp-1 "Block Personal Data Connectors — Tenant" (scope: All except
    // specific, exception env-sandbox — env-default is NOT excepted, so this policy
    // applies here and flags the flow).
    { id: "flow-5", name: "Twitter mentions to Teams", type: "Cloud", owner: "admin@itbd.net", envId: "env-default", status: "Off", trigger: "When a new tweet is posted", lastRun: "2024-09-18T12:42:00Z", total: 1240, success: 1198, failed: 42, connectors: ["twitter", "teams"] },
    { id: "flow-6", name: "Invoice OCR — Form Recognizer", type: "Cloud", owner: "admin@itbd.net", envId: "env-prod", status: "On", trigger: "When a file is created (OneDrive)", lastRun: "2024-11-22T06:11:00Z", total: 322, success: 309, failed: 13, connectors: ["onedriveforbusiness", "cognitiveformrecog", "sharepointonline"] },
    { id: "flow-7", name: "Backup DB nightly", type: "Desktop", owner: "karthik@cloudlab.in", envId: "env-sandbox", status: "On", trigger: "Schedule (Daily 23:00)", lastRun: "2024-11-21T23:01:00Z", total: 180, success: 179, failed: 1, connectors: ["sqlserver", "azureblob"] },
    { id: "flow-8", name: "Forms submission to SharePoint", type: "Cloud", owner: "meera@cloudlab.in", envId: "env-default", status: "On", trigger: "When a new response is submitted (Forms)", lastRun: "2024-11-22T10:05:00Z", total: 510, success: 508, failed: 2, connectors: ["forms", "sharepointonline"] },
    { id: "flow-9", name: "Send weekly status to Slack", type: "Cloud", owner: "karthik@cloudlab.in", envId: "env-prod", status: "On", trigger: "Recurrence (Weekly Mon 09:00)", lastRun: "2024-11-18T09:00:00Z", total: 52, success: 52, failed: 0, connectors: ["slackbusiness", "sharepointonline"] },
    { id: "flow-10", name: "New Dataverse row to Power BI", type: "Cloud", owner: "arjun@cloudlab.in", envId: "env-prod", status: "On", trigger: "When a row is added (Dataverse)", lastRun: "2024-11-22T09:38:00Z", total: 2210, success: 2185, failed: 25, connectors: ["dataverse", "powerbi"] },
    { id: "flow-11", name: "Service ticket sync (SNow)", type: "Cloud", owner: "admin@itbd.net", envId: "env-prod", status: "Suspended", trigger: "When a record is updated (ServiceNow)", lastRun: "2024-10-30T13:22:00Z", total: 740, success: 690, failed: 50, connectors: ["servicenow", "teams", "sharepointonline"] },
    { id: "flow-12", name: "GitHub PR notifications", type: "Cloud", owner: "karthik@cloudlab.in", envId: "env-sandbox", status: "On", trigger: "When a pull request is created (GitHub)", lastRun: "2024-11-22T05:48:00Z", total: 388, success: 388, failed: 0, connectors: ["github", "teams"] },
    { id: "flow-13", name: "Birthday wishes email", type: "Cloud", owner: "sneha@cloudlab.in", envId: "env-default", status: "On", trigger: "Recurrence (Daily 09:00)", lastRun: "2024-11-22T03:00:00Z", total: 401, success: 401, failed: 0, connectors: ["office365outlook", "sharepointonline", "office365users"] },
    { id: "flow-14", name: "CSV ingest from FTP to SQL", type: "Desktop", owner: "admin@itbd.net", envId: "env-prod", status: "Off", trigger: "Schedule (Hourly)", lastRun: "2024-08-04T01:00:00Z", total: 96, success: 78, failed: 18, connectors: ["ftp", "sqlserver"] },
    { id: "flow-15", name: "AI Builder — invoice classify", type: "Cloud", owner: "admin@itbd.net", envId: "env-prod", status: "On", trigger: "Manual", lastRun: "2024-11-21T18:00:00Z", total: 120, success: 116, failed: 4, connectors: ["aibuilder", "sharepointonline"] },
    { id: "flow-16", name: "Vacation request approval", type: "Cloud", owner: "meera@cloudlab.in", envId: "env-default", status: "On", trigger: "When a new response is submitted (Forms)", lastRun: "2024-11-20T11:14:00Z", total: 65, success: 64, failed: 1, connectors: ["forms", "approvals", "office365outlook"] },
    { id: "flow-17", name: "Sync Outlook calendar to Teams", type: "Cloud", owner: "arjun@cloudlab.in", envId: "env-prod", status: "On", trigger: "When an event is created (Outlook)", lastRun: "2024-11-22T07:00:00Z", total: 280, success: 275, failed: 5, connectors: ["office365outlook", "teams"] },
    { id: "flow-18", name: "PDF parse with Adobe Sign", type: "Cloud", owner: "karthik@cloudlab.in", envId: "env-sandbox", status: "On", trigger: "When an envelope is signed (Adobe Sign)", lastRun: "2024-11-21T22:30:00Z", total: 44, success: 42, failed: 2, connectors: ["adobesign", "sharepointonline"] },
  ];
}

/**
 * Generates deterministic-seeded historical run records for a flow, using a seeded
 * LCG (not source's raw `((seedBase + i * 7) % 100) / 100` char-code formula, but the
 * same idea) — produces `n` `PpFlowRun` records with summary fields only (`steps: []`
 * since historical runs predate the real step-tracking run engine). These are the
 * SEED counts a user sees BEFORE ever clicking "Run now" — the real flow-run engine
 * (flow-run-engine.ts) takes over for new runs going forward.
 */
function generateSeedRuns(flow: Omit<PpFlow, "dlpFlagged" | "dlpFlagReason">, n: number): PpFlowRun[] {
  const runs: PpFlowRun[] = [];
  const failRate = flow.total ? flow.failed / flow.total : 0.05;
  const seed = flow.id.charCodeAt(flow.id.length - 1) * 97 + flow.name.length;
  const rand = rng(seed);
  const lastTs = new Date(flow.lastRun).getTime();

  for (let i = 0; i < n; i++) {
    const r = rand();
    const status: PpFlowRun["status"] = r < failRate ? "Failed" : r < failRate + 0.02 ? "Cancelled" : "Succeeded";
    const durationSec = 2 + Math.floor(rand() * 88);
    runs.push({
      id: `${flow.id}-R${10000 - i}`,
      flowId: flow.id,
      status,
      start: new Date(lastTs - i * 3600 * 1000).toISOString(),
      durationSec,
      output: status === "Succeeded" ? "OK" : status === "Failed" ? "BadRequest: connector reference invalid" : "User cancelled",
      steps: [],
    });
  }
  return runs;
}

function seedFlows(): PpFlow[] {
  return seedFlowDefs().map((f) => ({ ...f }));
}

function seedFlowRuns(flows: PpFlow[]): PpFlowRun[] {
  const runs: PpFlowRun[] = [];
  for (const flow of flows) {
    runs.push(...generateSeedRuns(flow, 12));
  }
  return runs;
}

// ===================================================================
// DLP policies — ported from pp-data.js seedPolicies() (6 policies)
// ===================================================================

function seedPolicies(): PpPolicy[] {
  return [
    {
      id: "dlp-1",
      name: "Block Personal Data Connectors — Tenant",
      description: "Blocks consumer storage, social and consumer mail connectors across all environments except sandboxes.",
      type: "Default",
      status: "On",
      scope: "All except specific",
      exceptionEnvs: ["env-sandbox"],
      envIds: [],
      createdBy: "admin@cloudlab.in",
      modified: "2024-09-12T13:25:00Z",
      business: ["sharepointonline", "onedriveforbusiness", "office365outlook", "office365users", "teams", "dataverse", "powerbi", "planner", "approvals", "sqlserver"],
      nonBusiness: ["bingsearch", "translatorv2", "rss", "msnweather", "bingmaps"],
      blocked: ["gmail", "googledrive", "dropbox", "facebook", "twitter", "outlookcom", "tor", "pastebin", "telegram", "whatsapp"],
      customRules: { blockPatterns: [], allowPatterns: [] },
    },
    {
      id: "dlp-2",
      name: "Production — Strict",
      description: "Strictest classification for the Production environment. No social, no consumer apps.",
      type: "Custom",
      status: "On",
      scope: "Specific environments",
      exceptionEnvs: [],
      envIds: ["env-prod"],
      createdBy: "admin@cloudlab.in",
      modified: "2024-10-04T09:48:00Z",
      business: ["sharepointonline", "onedriveforbusiness", "office365outlook", "office365users", "teams", "dataverse", "sqlserver", "azureblob", "azurekeyvault", "salesforce", "servicenow", "docusign", "adobesign", "aibuilder", "dynamics365sales", "powerbi"],
      nonBusiness: ["bingmaps", "translatorv2", "rss"],
      blocked: ["gmail", "googledrive", "googlesheets", "dropbox", "facebook", "twitter", "instagram", "outlookcom", "tor", "pastebin", "telegram", "whatsapp", "openai", "sftp", "ftp", "http"],
      customRules: { blockPatterns: ["*.exec.*"], allowPatterns: [] },
    },
    {
      id: "dlp-3",
      name: "Sandbox — Relaxed",
      description: "Lenient policy for sandbox development; allows experimentation with consumer connectors.",
      type: "Custom",
      status: "On",
      scope: "Specific environments",
      exceptionEnvs: [],
      envIds: ["env-sandbox", "env-trial"],
      createdBy: "admin@itbd.net",
      modified: "2024-08-25T17:10:00Z",
      business: ["sharepointonline", "dataverse", "sqlserver", "office365outlook"],
      nonBusiness: ["gmail", "googledrive", "dropbox", "rss", "twitter", "facebook", "openai", "azureopenai", "bingsearch"],
      blocked: ["tor", "pastebin"],
      customRules: { blockPatterns: [], allowPatterns: [] },
    },
    {
      id: "dlp-4",
      name: "Block AI Tools — Confidential Envs",
      description: "Blocks third-party generative AI in any environment dealing with confidential data.",
      type: "Custom",
      status: "On",
      scope: "Specific environments",
      exceptionEnvs: [],
      envIds: ["env-prod", "env-default"],
      createdBy: "admin@cloudlab.in",
      modified: "2024-11-01T08:30:00Z",
      business: ["sharepointonline", "dataverse", "office365outlook", "azureopenai"],
      nonBusiness: ["bingsearch", "translatorv2"],
      blocked: ["openai", "anthropic", "perplexity", "tor", "pastebin"],
      customRules: { blockPatterns: ["*chatgpt*", "*claude*"], allowPatterns: ["azureopenai"] },
    },
    {
      id: "dlp-5",
      name: "External Storage — Block",
      description: "Blocks non-corporate file storage connectors tenant-wide.",
      type: "Default",
      status: "Off",
      scope: "Everyone",
      exceptionEnvs: [],
      envIds: [],
      createdBy: "admin@cloudlab.in",
      modified: "2024-06-18T11:22:00Z",
      business: ["sharepointonline", "onedriveforbusiness", "azureblob", "adlsgen2"],
      nonBusiness: [],
      blocked: ["dropbox", "googledrive", "box", "box2", "amazons3", "gcs", "onedrive"],
      customRules: { blockPatterns: [], allowPatterns: [] },
    },
    {
      id: "dlp-6",
      name: "Default tenant policy",
      description: "Out-of-box default. Cannot be deleted, but can be edited.",
      type: "Default",
      status: "On",
      scope: "Everyone",
      exceptionEnvs: [],
      envIds: [],
      createdBy: "System",
      modified: "2022-04-12T09:30:00Z",
      business: ["sharepointonline", "office365outlook", "office365users", "teams", "dataverse", "onedriveforbusiness"],
      nonBusiness: ["bingsearch", "translatorv2", "rss", "msnweather"],
      blocked: [],
      customRules: { blockPatterns: [], allowPatterns: [] },
    },
  ];
}

// ===================================================================
// Capacity / licenses / audit log — ported from pp-data.js
// ===================================================================

function seedCapacity(): PpCapacity {
  return {
    database: { usedGB: 16.4, totalGB: 50.0 },
    file: { usedGB: 28.1, totalGB: 100.0 },
    log: { usedGB: 6.2, totalGB: 20.0 },
    aiBuilder: { usedCredits: 312, totalCredits: 1000 },
    flowRuns: { used: 122480, total: 250000 },
  };
}

function seedLicenses(): PpLicense[] {
  return [
    { sku: "POWERAPPS_PER_USER", name: "Power Apps Premium (per user)", purchased: 20, assigned: 15 },
    { sku: "POWERAPPS_PER_APP", name: "Power Apps per app plan", purchased: 50, assigned: 32 },
    { sku: "FLOW_PER_USER", name: "Power Automate per user", purchased: 25, assigned: 22 },
    { sku: "FLOW_PER_FLOW", name: "Power Automate per flow", purchased: 10, assigned: 7 },
    { sku: "AI_BUILDER_CREDITS", name: "AI Builder credits (1M / month)", purchased: 1, assigned: 1 },
    { sku: "POWER_VIRTUAL_AGENT", name: "Copilot Studio (chat sessions)", purchased: 5, assigned: 3 },
  ];
}

function seedAuditLog(): PpAuditEntry[] {
  return [
    { ts: "2024-11-22T08:14:00Z", actor: "admin@cloudlab.in", action: "DLP policy modified", target: "Production — Strict", status: "Succeeded" },
    { ts: "2024-11-21T17:30:00Z", actor: "admin@itbd.net", action: "Environment created", target: "Test (Trial)", status: "Succeeded" },
    { ts: "2024-11-21T13:02:00Z", actor: "admin@cloudlab.in", action: "App shared", target: "Customer 360 Account", status: "Succeeded" },
    { ts: "2024-11-20T11:48:00Z", actor: "rahul@cloudlab.in", action: "Flow disabled", target: "CSV ingest from FTP", status: "Succeeded" },
    { ts: "2024-11-19T09:11:00Z", actor: "admin@cloudlab.in", action: "Capacity added", target: "CloudLab Production", status: "Succeeded" },
    { ts: "2024-11-18T15:45:00Z", actor: "admin@cloudlab.in", action: "User role assigned", target: "arjun@cloudlab.in / Sales Manager", status: "Succeeded" },
    { ts: "2024-11-15T12:00:00Z", actor: "admin@itbd.net", action: "Environment backup", target: "CloudLab Sandbox-Dev", status: "Succeeded" },
    { ts: "2024-11-12T10:33:00Z", actor: "admin@cloudlab.in", action: "DLP policy created", target: "Block AI Tools", status: "Succeeded" },
  ];
}

// ===================================================================
// Makers roster — this app has no shared CloudLabInfra bridge (same situation as
// Sentinel/Purview/Azure DevOps before it), so a local "CloudLab Inc." roster is
// hardcoded here directly, matching the fictional-name style established in
// azure-devops/seedData.ts. Source's derivation formula
// (`Math.floor(Math.abs((charCode*3) % 5))`) is applied against each maker's own id
// string for appsOwned/flowsOwned so the counts still feel "derived", not arbitrary.
// ===================================================================

const MAKER_DEFS: { id: string; upn: string; displayName: string; department: string }[] = [
  { id: "usr-ankit", upn: "ankit@cloudlab.in", displayName: "Ankit Sharma", department: "Engineering" },
  { id: "usr-rohit", upn: "rohit@cloudlab.in", displayName: "Rohit Kapoor", department: "Engineering" },
  { id: "usr-vivek", upn: "vivek@cloudlab.in", displayName: "Vivek Nair", department: "IT" },
  { id: "usr-priya", upn: "priya@cloudlab.in", displayName: "Priya Patel", department: "Finance" },
  { id: "usr-naveen", upn: "naveen@cloudlab.in", displayName: "Naveen Reddy", department: "Marketing" },
  { id: "usr-jaya", upn: "jaya@cloudlab.in", displayName: "Jaya Krishnan", department: "Operations" },
  { id: "usr-sneha", upn: "sneha@cloudlab.in", displayName: "Sneha Iyer", department: "IT" },
  { id: "usr-vikram", upn: "vikram@cloudlab.in", displayName: "Vikram Singh", department: "Engineering" },
  { id: "usr-rahul", upn: "rahul@cloudlab.in", displayName: "Rahul Verma", department: "Engineering" },
  { id: "usr-arjun", upn: "arjun@cloudlab.in", displayName: "Arjun Mehta", department: "Finance" },
  { id: "usr-kiran", upn: "kiran@cloudlab.in", displayName: "Kiran Desai", department: "Marketing" },
  { id: "usr-amit", upn: "amit@cloudlab.in", displayName: "Amit Joshi", department: "Operations" },
  { id: "usr-pooja", upn: "pooja@cloudlab.in", displayName: "Pooja Gupta", department: "IT" },
  { id: "usr-kavita", upn: "kavita@cloudlab.in", displayName: "Kavita Rao", department: "Finance" },
  { id: "usr-manish", upn: "manish@cloudlab.in", displayName: "Manish Tiwari", department: "Engineering" },
  { id: "usr-meera", upn: "meera@cloudlab.in", displayName: "Meera Shah", department: "Marketing" },
  { id: "usr-sunita", upn: "sunita@cloudlab.in", displayName: "Sunita Menon", department: "Operations" },
  { id: "usr-aarti", upn: "aarti@cloudlab.in", displayName: "Aarti Bhatia", department: "IT" },
  { id: "usr-sandeep", upn: "sandeep@cloudlab.in", displayName: "Sandeep Kumar", department: "Engineering" },
  { id: "usr-karthik", upn: "karthik@cloudlab.in", displayName: "Karthik Iyer", department: "Engineering" },
  { id: "usr-preeti", upn: "preeti@cloudlab.in", displayName: "Preeti Nambiar", department: "Finance" },
  { id: "usr-ravi", upn: "ravi@cloudlab.in", displayName: "Ravi Chandran", department: "Operations" },
];

function seedMakers(): PpMaker[] {
  return MAKER_DEFS.map((m) => {
    const charCode = m.id.charCodeAt(0);
    return {
      upn: m.upn,
      displayName: m.displayName,
      department: m.department,
      appsOwned: Math.floor(Math.abs((charCode * 3) % 5)),
      flowsOwned: Math.floor(Math.abs((charCode * 5) % 4)),
      lastActive: "2026-07-10T09:00:00Z",
    };
  });
}

// ===================================================================
// Power Pages sites — new eager-seeded content (source lazily created on first visit)
// ===================================================================

function seedPagesSites(): PpPagesSite[] {
  return [
    { id: "pages-1", name: "CloudLab Partner Portal", envId: "env-prod", url: "https://cloudlab-partners.powerappsportals.com", status: "Active", createdOn: "2023-09-14", template: "Partner portal", pageViews30d: 8420 },
    { id: "pages-2", name: "CloudLab Customer Self-Service", envId: "env-prod", url: "https://cloudlab-selfservice.powerappsportals.com", status: "Active", createdOn: "2024-02-02", template: "Customer self-service", pageViews30d: 15230 },
    { id: "pages-3", name: "CloudLab Internal Wiki (Sandbox)", envId: "env-sandbox", url: "https://cloudlab-wiki-dev.powerappsportals.com", status: "Inactive", createdOn: "2024-05-19", template: "Blank site", pageViews30d: 0 },
  ];
}

// ===================================================================
// Power BI — eager-seeded (source lazily created these; this port standardizes on
// full upfront seeding, matching the established convention from prior sub-phases)
// ===================================================================

function seedBiWorkspaces(): PpBiWorkspace[] {
  return [
    { id: "bi-1", name: "Finance Reporting", type: "Workspace", capacityUsedMB: 4200, reports: 18, datasets: 9, members: 12 },
    { id: "bi-2", name: "Sales Analytics", type: "Workspace", capacityUsedMB: 6800, reports: 24, datasets: 14, members: 20 },
    { id: "bi-3", name: "IT Operations Dashboards", type: "Workspace", capacityUsedMB: 1900, reports: 7, datasets: 5, members: 6 },
    { id: "bi-4", name: "admin@itbd.net", type: "My workspace", capacityUsedMB: 640, reports: 3, datasets: 2, members: 1 },
  ];
}

// ===================================================================
// Copilot Studio — eager-seeded, 8 intents ported from pp-copilot.js matchIntent()
// ===================================================================

function seedCopilotBots(): PpCopilotBot[] {
  return [
    { id: "bot-1", name: "IT Helpdesk Copilot", envId: "env-prod", language: "English", status: "Published", sessions30d: 1420 },
    { id: "bot-2", name: "HR Onboarding Assistant", envId: "env-default", language: "English", status: "Published", sessions30d: 380 },
    { id: "bot-3", name: "Sandbox Test Bot", envId: "env-sandbox", language: "English", status: "Draft", sessions30d: 0 },
  ];
}

function seedCopilotTopics(): PpCopilotTopic[] {
  return [
    { id: "topic-1", name: "VPN connection issue", trigger: "vpn, connection, network", nodeCount: 6 },
    { id: "topic-2", name: "Reset password", trigger: "password, reset, forgot", nodeCount: 8 },
    { id: "topic-3", name: "New laptop request", trigger: "laptop, new device, workstation", nodeCount: 5 },
    { id: "topic-4", name: "Office 365 license", trigger: "license, licence, office, m365", nodeCount: 7 },
    { id: "topic-5", name: "Escalate to human", trigger: "human, agent, escalate, manager", nodeCount: 3 },
    { id: "topic-6", name: "Greeting", trigger: "hello, hi, hey", nodeCount: 2 },
  ];
}

function seedCopilotKnowledge(): PpCopilotKnowledgeSource[] {
  return [
    { id: "kn-1", name: "IT Helpdesk SOP (SharePoint)", type: "SharePoint", itemCount: 42 },
    { id: "kn-2", name: "HR Policies PDF", type: "File upload", itemCount: 6 },
    { id: "kn-3", name: "cloudlab.in/support", type: "Public website", itemCount: 128 },
  ];
}

function seedCopilotActions(): PpCopilotAction[] {
  return [
    { id: "act-1", name: "Reset password via Entra SSPR", connectorId: "azuread" },
    { id: "act-2", name: "Create ServiceNow ticket", connectorId: "servicenow" },
    { id: "act-3", name: "Send confirmation email", connectorId: "office365outlook" },
    { id: "act-4", name: "Look up license assignment", connectorId: "graphapi" },
  ];
}

// Ported verbatim from pp-copilot.js `matchIntent()`'s hardcoded INTENTS array (8
// entries) — `keywords` here is that entry's `triggers` array, `response` is `reply`
// (source's optional `followUp` line folded into the same response string since
// PpCopilotIntent has a single `response` field, not a separate follow-up).
function seedCopilotIntents(): PpCopilotIntent[] {
  return [
    {
      id: "intent-1",
      name: "VPN connection issue",
      keywords: ["vpn"],
      response: "Sorry to hear that. VPN issues fall into 3 buckets — credentials, network, or the client. Which VPN client are you using? (GlobalProtect / AnyConnect / FortiClient)",
    },
    {
      id: "intent-2",
      name: "Reset password",
      keywords: ["password", "reset", "forgot"],
      response: "I can reset your password via Entra SSPR. To confirm — you are resetting your OWN account? After confirmation I will trigger the Power Automate flow, which sends a magic link to your registered phone within 60 seconds.",
    },
    {
      id: "intent-3",
      name: "New laptop request",
      keywords: ["laptop", "new device", "workstation"],
      response: "New laptop requests need manager approval. Standard config (Dell Latitude 5450, 16 GB RAM) ships in 3-5 days. Premium config (MacBook Pro M3, 32 GB) requires director approval and ships in 7-10 days. Should I open the request now?",
    },
    {
      id: "intent-4",
      name: "Office 365 license",
      keywords: ["license", "licence", "office", "m365"],
      response: "I can check your current license assignments. Looking up... you have Microsoft 365 E5 assigned (purchased 2024-04-01, renews 2026-04-01). What did you want to do — add an app, change SKU, or troubleshoot a missing app?",
    },
    {
      id: "intent-5",
      name: "Email signature",
      keywords: ["signature", "email signature"],
      response: "You can update your email signature in Outlook: File > Options > Mail > Signatures. For a company-wide signature (Exchange transport rule), I will route you to IT.",
    },
    {
      id: "intent-6",
      name: "Escalate",
      keywords: ["human", "agent", "escalate", "manager", "representative"],
      response: "Escalating to a human agent. I am opening a ServiceNow ticket and assigning it to the IT helpdesk queue. Average response time: 12 minutes.",
    },
    {
      id: "intent-7",
      name: "Greeting",
      keywords: ["hello", "hi", "hey", "good morning", "good afternoon"],
      response: "Hello! How can I help you today? I can help with VPN, password reset, license issues, laptop requests, or email questions.",
    },
    {
      id: "intent-8",
      name: "End of conversation",
      keywords: ["bye", "goodbye", "thanks", "thank you"],
      response: "Glad I could help. Have a great day!",
    },
  ];
}

function seedCopilotState(): PpCopilotState {
  return {
    copilots: seedCopilotBots(),
    topics: seedCopilotTopics(),
    knowledge: seedCopilotKnowledge(),
    actions: seedCopilotActions(),
    intents: seedCopilotIntents(),
    channels: [
      { name: "Teams", enabled: true },
      { name: "Web chat", enabled: true },
      { name: "Custom website", enabled: false },
      { name: "Facebook", enabled: false },
      { name: "Microsoft 365 Copilot", enabled: false },
    ],
    // Fixes source's "test chat is in-memory-only" bug — starts empty; the seeded
    // "Hi! I am the IT Helpdesk Copilot" greeting is now something the UI renders as
    // an initial placeholder rather than persisted state, since real persisted state
    // should reflect exactly what the user actually sent/received via
    // SEND_COPILOT_TEST_MESSAGE.
    testChat: [],
  };
}

// ===================================================================
// Root state assembly
// ===================================================================

export function freshPpState(): PpState {
  const environments = seedEnvironments();
  const apps = seedApps();
  const flows = seedFlows();
  const flowRuns = seedFlowRuns(flows);
  const policies = seedPolicies();

  const baseState: PpState = {
    tenant: {
      name: "CloudLab",
      domain: "cloudlab.in",
      tenantId: "9c4f3c3a-5b8a-4f7e-9b1d-cloudlab",
      region: "India",
    },
    connectors: CONNECTORS,
    environments,
    apps,
    flows,
    flowRuns,
    policies,
    capacity: seedCapacity(),
    licenses: seedLicenses(),
    auditLog: seedAuditLog(),
    makers: seedMakers(),
    pagesSites: seedPagesSites(),
    powerBI: {
      workspaces: seedBiWorkspaces(),
      tenantSettings: { exportEnabled: true, publishToWebEnabled: false, guestAccessEnabled: false },
    },
    security: {
      isolation: { enabled: false, mode: "Allow", allowList: ["cloudlab-partners.com", "trusted-vendor.example.com"] },
      lockbox: {
        enabled: false,
        requests: [
          { id: "lbx-1", requestedBy: "Microsoft Support Engineer (MSFT-9012)", reason: "Investigating Dataverse plug-in trace error reported in ticket #TS-88213", requestedOn: "2024-11-20T09:00:00Z", status: "Pending" },
          { id: "lbx-2", requestedBy: "Microsoft Support Engineer (MSFT-4471)", reason: "Diagnosing intermittent flow-run timeout in CloudLab Production", requestedOn: "2024-11-21T14:30:00Z", status: "Pending" },
        ],
      },
      cmk: { enabled: false, keyVaultUri: null, status: "Not configured" },
    },
    copilot: seedCopilotState(),
  };

  // Run the real DLP engine once at seed time so apps/flows start with correct
  // dlpFlagged/dlpFlagReason rather than undefined — exercising the exact same code
  // path RECOMPUTE_DLP_FLAGS uses at runtime.
  return applyDlpFlags(baseState);
}

// Exported for the smoke test / any future consumer that needs raw step derivation
// without going through the reducer.
export { deriveRunSteps };
