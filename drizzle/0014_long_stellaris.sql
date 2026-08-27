CREATE TABLE `page_visits` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`path` varchar(512) NOT NULL,
	`visited_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `page_visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `page_visits` ADD CONSTRAINT `page_visits_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `page_visits_user_visited_idx` ON `page_visits` (`user_id`,`visited_at`);--> statement-breakpoint
CREATE INDEX `page_visits_visited_idx` ON `page_visits` (`visited_at`);