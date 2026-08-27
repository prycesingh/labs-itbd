CREATE TABLE `labs_site_sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`status` enum('active','ended') NOT NULL DEFAULT 'active',
	`accumulated_seconds` int NOT NULL DEFAULT 0,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`last_heartbeat_at` timestamp NOT NULL DEFAULT (now()),
	`ended_at` timestamp,
	CONSTRAINT `labs_site_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `labs_site_sessions` ADD CONSTRAINT `labs_site_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `labs_site_sessions_user_idx` ON `labs_site_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `labs_site_sessions_user_started_idx` ON `labs_site_sessions` (`user_id`,`started_at`);