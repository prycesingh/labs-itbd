CREATE TABLE `labs_articles` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` varchar(200) NOT NULL,
	`category` varchar(80) NOT NULL,
	`source_page` varchar(120) NOT NULL,
	`summary` text,
	`body_markdown` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `labs_articles_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `labs_cert_roadmap_entries` (
	`id` varchar(36) NOT NULL,
	`cert_code` varchar(20) NOT NULL,
	`cert_name` varchar(160) NOT NULL,
	`level` varchar(40) NOT NULL,
	`track` varchar(60) NOT NULL,
	`description` text NOT NULL,
	`study_time` varchar(80),
	`exam_format` varchar(120),
	`passing_score` varchar(40),
	`pricing` varchar(80),
	`related_sims` varchar(200),
	`skills` json NOT NULL DEFAULT ('[]'),
	`tips` text,
	`related_simulator_keys` json NOT NULL DEFAULT ('[]'),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_cert_roadmap_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `labs_cert_roadmap_code_idx` UNIQUE(`cert_code`)
);
--> statement-breakpoint
CREATE TABLE `labs_cloud_comparisons` (
	`id` varchar(36) NOT NULL,
	`category` varchar(80) NOT NULL,
	`label` varchar(160) NOT NULL,
	`azure_equivalent` varchar(200),
	`aws_equivalent` varchar(200),
	`gcp_equivalent` varchar(200),
	`note` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_cloud_comparisons_id` PRIMARY KEY(`id`),
	CONSTRAINT `labs_cloud_comparisons_label_idx` UNIQUE(`label`)
);
--> statement-breakpoint
CREATE TABLE `labs_gotchas` (
	`id` varchar(36) NOT NULL,
	`category` varchar(80) NOT NULL,
	`title` varchar(200) NOT NULL,
	`symptom` text NOT NULL,
	`cause` text NOT NULL,
	`fix` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_gotchas_id` PRIMARY KEY(`id`),
	CONSTRAINT `labs_gotchas_title_idx` UNIQUE(`title`)
);
--> statement-breakpoint
CREATE TABLE `labs_kql_playground_queries` (
	`id` varchar(36) NOT NULL,
	`level` varchar(40) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`kql_query` text NOT NULL,
	`explanation` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_kql_playground_queries_id` PRIMARY KEY(`id`),
	CONSTRAINT `labs_kql_playground_title_idx` UNIQUE(`title`)
);
--> statement-breakpoint
CREATE TABLE `labs_production_checklist_items` (
	`id` varchar(36) NOT NULL,
	`checklist_name` varchar(120) NOT NULL,
	`category` varchar(80) NOT NULL,
	`item` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_production_checklist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `labs_services_catalog` (
	`id` varchar(36) NOT NULL,
	`category` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`icon` varchar(16),
	`description` text NOT NULL,
	`when_to_use` text,
	`alternative` varchar(160),
	`pricing` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_services_catalog_id` PRIMARY KEY(`id`),
	CONSTRAINT `labs_services_catalog_name_idx` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `labs_troubleshoot_flowchart_steps` (
	`id` varchar(36) NOT NULL,
	`flow_name` varchar(160) NOT NULL,
	`step_index` int NOT NULL,
	`step_type` varchar(20) NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_troubleshoot_flowchart_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `password` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `labs_articles_category_idx` ON `labs_articles` (`category`);--> statement-breakpoint
CREATE INDEX `labs_cert_roadmap_track_idx` ON `labs_cert_roadmap_entries` (`track`);--> statement-breakpoint
CREATE INDEX `labs_cloud_comparisons_category_idx` ON `labs_cloud_comparisons` (`category`);--> statement-breakpoint
CREATE INDEX `labs_gotchas_category_idx` ON `labs_gotchas` (`category`);--> statement-breakpoint
CREATE INDEX `labs_kql_playground_level_idx` ON `labs_kql_playground_queries` (`level`);--> statement-breakpoint
CREATE INDEX `labs_production_checklist_name_idx` ON `labs_production_checklist_items` (`checklist_name`);--> statement-breakpoint
CREATE INDEX `labs_services_catalog_category_idx` ON `labs_services_catalog` (`category`);--> statement-breakpoint
CREATE INDEX `labs_troubleshoot_flowchart_flow_idx` ON `labs_troubleshoot_flowchart_steps` (`flow_name`);