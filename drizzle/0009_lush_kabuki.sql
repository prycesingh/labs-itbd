CREATE TABLE `email_assessment_attempt_overrides` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`daily_limit` int NOT NULL,
	`created_by` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_assessment_attempt_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `ea_attempt_overrides_user_idx` UNIQUE(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `interview_practice_attempt_overrides` ADD `lockout_threshold` int;--> statement-breakpoint
ALTER TABLE `email_assessment_attempt_overrides` ADD CONSTRAINT `email_assessment_attempt_overrides_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;