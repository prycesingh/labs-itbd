CREATE TABLE `labs_simulator_states` (
	`user_id` varchar(255) NOT NULL,
	`simulator_key` varchar(60) NOT NULL,
	`state_json` json NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_simulator_states_user_id_simulator_key_pk` PRIMARY KEY(`user_id`,`simulator_key`)
);
--> statement-breakpoint
ALTER TABLE `labs_simulator_states` ADD CONSTRAINT `labs_simulator_states_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;