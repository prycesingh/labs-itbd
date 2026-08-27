CREATE TABLE `interview_followup_questions` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`parent_answer_id` varchar(36) NOT NULL,
	`question_text` text NOT NULL,
	`ideal_points` longtext,
	`status` enum('pending','answered','skipped') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ifq_id` PRIMARY KEY(`id`),
	CONSTRAINT `ifq_id_unique` UNIQUE(`id`)
);
--> statement-breakpoint
ALTER TABLE `interview_followup_questions` ADD CONSTRAINT `ifq_session_fk` FOREIGN KEY (`session_id`) REFERENCES `candidate_interview_sessions`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_followup_questions` ADD CONSTRAINT `ifq_parent_answer_fk` FOREIGN KEY (`parent_answer_id`) REFERENCES `candidate_interview_answers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ifq_session_idx` ON `interview_followup_questions` (`session_id`,`status`);--> statement-breakpoint
CREATE INDEX `ifq_parent_answer_idx` ON `interview_followup_questions` (`parent_answer_id`);