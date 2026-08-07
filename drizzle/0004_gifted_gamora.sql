CREATE TABLE `labs_simulator_sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`simulator_key` varchar(60) NOT NULL,
	`status` enum('active','ended') NOT NULL DEFAULT 'active',
	`accumulated_seconds` int NOT NULL DEFAULT 0,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`last_heartbeat_at` timestamp NOT NULL DEFAULT (now()),
	`ended_at` timestamp,
	CONSTRAINT `labs_simulator_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `email_assessment_ai_requests` MODIFY COLUMN `request_payload` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `email_assessment_ai_responses` MODIFY COLUMN `raw_response` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `email_assessment_ai_responses` MODIFY COLUMN `validation_errors` longtext;--> statement-breakpoint
ALTER TABLE `email_assessment_audit_logs` MODIFY COLUMN `metadata` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `email_assessment_evaluations` MODIFY COLUMN `category_scores` longtext;--> statement-breakpoint
ALTER TABLE `email_assessment_evaluations` MODIFY COLUMN `strengths` longtext;--> statement-breakpoint
ALTER TABLE `email_assessment_evaluations` MODIFY COLUMN `weaknesses` longtext;--> statement-breakpoint
ALTER TABLE `email_assessment_evaluations` MODIFY COLUMN `improvements` longtext;--> statement-breakpoint
ALTER TABLE `email_assessment_manual_scores` MODIFY COLUMN `category_scores` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `email_assessment_manual_scores` MODIFY COLUMN `improvement_areas` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `email_assessment_rubrics` MODIFY COLUMN `weights` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `labs_simulator_sessions` ADD CONSTRAINT `labs_simulator_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `labs_simulator_sessions_user_idx` ON `labs_simulator_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `labs_simulator_sessions_user_started_idx` ON `labs_simulator_sessions` (`user_id`,`started_at`);