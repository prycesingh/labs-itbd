CREATE TABLE `labs_glossary_terms` (
	`id` varchar(36) NOT NULL,
	`term` varchar(160) NOT NULL,
	`category` varchar(80) NOT NULL,
	`definition` text NOT NULL,
	`example` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_glossary_terms_id` PRIMARY KEY(`id`),
	CONSTRAINT `labs_glossary_term_idx` UNIQUE(`term`)
);
--> statement-breakpoint
CREATE TABLE `labs_quiz_answers` (
	`id` varchar(36) NOT NULL,
	`attempt_id` varchar(36) NOT NULL,
	`question_id` varchar(36) NOT NULL,
	`selected_indexes` json NOT NULL,
	`is_correct` boolean NOT NULL,
	`answered_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `labs_quiz_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `labs_quiz_attempts` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`cert_id` varchar(36) NOT NULL,
	`status` enum('in_progress','completed') NOT NULL DEFAULT 'in_progress',
	`total_questions` int NOT NULL,
	`correct_count` int,
	`score_percent` int,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `labs_quiz_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `labs_quiz_certs` (
	`id` varchar(36) NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(160) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `labs_quiz_certs_id` PRIMARY KEY(`id`),
	CONSTRAINT `labs_quiz_certs_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `labs_quiz_questions` (
	`id` varchar(36) NOT NULL,
	`cert_id` varchar(36) NOT NULL,
	`question` text NOT NULL,
	`options` json NOT NULL,
	`correct_indexes` json NOT NULL,
	`explanation` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `labs_quiz_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `labs_quiz_answers` ADD CONSTRAINT `labs_quiz_answers_attempt_id_labs_quiz_attempts_id_fk` FOREIGN KEY (`attempt_id`) REFERENCES `labs_quiz_attempts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `labs_quiz_answers` ADD CONSTRAINT `labs_quiz_answers_question_id_labs_quiz_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `labs_quiz_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `labs_quiz_attempts` ADD CONSTRAINT `labs_quiz_attempts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `labs_quiz_attempts` ADD CONSTRAINT `labs_quiz_attempts_cert_id_labs_quiz_certs_id_fk` FOREIGN KEY (`cert_id`) REFERENCES `labs_quiz_certs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `labs_quiz_questions` ADD CONSTRAINT `labs_quiz_questions_cert_id_labs_quiz_certs_id_fk` FOREIGN KEY (`cert_id`) REFERENCES `labs_quiz_certs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `labs_glossary_category_idx` ON `labs_glossary_terms` (`category`);--> statement-breakpoint
CREATE INDEX `labs_quiz_answers_attempt_idx` ON `labs_quiz_answers` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `labs_quiz_answers_question_idx` ON `labs_quiz_answers` (`question_id`);--> statement-breakpoint
CREATE INDEX `labs_quiz_attempts_user_idx` ON `labs_quiz_attempts` (`user_id`);--> statement-breakpoint
CREATE INDEX `labs_quiz_attempts_cert_idx` ON `labs_quiz_attempts` (`cert_id`);--> statement-breakpoint
CREATE INDEX `labs_quiz_attempts_status_idx` ON `labs_quiz_attempts` (`status`);--> statement-breakpoint
CREATE INDEX `labs_quiz_certs_active_idx` ON `labs_quiz_certs` (`active`);--> statement-breakpoint
CREATE INDEX `labs_quiz_questions_cert_idx` ON `labs_quiz_questions` (`cert_id`);--> statement-breakpoint
CREATE INDEX `labs_quiz_questions_active_idx` ON `labs_quiz_questions` (`active`);