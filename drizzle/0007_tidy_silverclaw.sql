CREATE TABLE `interview_practice_attempt_overrides` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`module_id` varchar(36) NOT NULL,
	`daily_limit` int NOT NULL,
	`created_by` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ipao_id` PRIMARY KEY(`id`),
	CONSTRAINT `ipao_id_unique` UNIQUE(`id`),
	CONSTRAINT `ipao_user_module_unique` UNIQUE(`user_id`,`module_id`)
);
--> statement-breakpoint
ALTER TABLE `interview_practice_attempt_overrides` ADD CONSTRAINT `interview_practice_attempt_overrides_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_practice_attempt_overrides` ADD CONSTRAINT `interview_practice_attempt_overrides_module_id_interview_modules_id_fk` FOREIGN KEY (`module_id`) REFERENCES `interview_modules`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `ipao_user_idx` ON `interview_practice_attempt_overrides` (`user_id`);--> statement-breakpoint
CREATE INDEX `ipao_module_idx` ON `interview_practice_attempt_overrides` (`module_id`);--> statement-breakpoint
CREATE INDEX `interview_sessions_candidate_module_created_idx` ON `candidate_interview_sessions` (`candidate_id`,`module_id`,`created_at`);