CREATE TABLE `interview_delivery_metrics` (
	`id` varchar(36) NOT NULL,
	`answer_id` varchar(36) NOT NULL,
	`wpm` decimal(6,2),
	`pause_count` int,
	`total_pause_s` decimal(6,2),
	`longest_pause_s` decimal(6,2),
	`pause_ratio` decimal(5,3),
	`filler_count` int,
	`fillers_per_min` decimal(6,2),
	`pitch_mean_hz` decimal(7,2),
	`pitch_dynamism_st` decimal(6,3),
	`pitch_range_st` decimal(6,3),
	`loudness_db_mean` decimal(6,2),
	`loudness_variation_db` decimal(6,3),
	`delivery_scores` longtext NOT NULL,
	`delivery_overall` decimal(3,1),
	`calibration_mode` enum('static','population-relative') NOT NULL DEFAULT 'static',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `idm_id` PRIMARY KEY(`id`),
	CONSTRAINT `interview_delivery_metrics_answer_id_unique` UNIQUE(`answer_id`),
	CONSTRAINT `idm_id_unique` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_module_capabilities` (
	`id` varchar(36) NOT NULL,
	`module_id` varchar(36) NOT NULL,
	`capability_key` varchar(100) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`config` longtext,
	`updated_by` varchar(255) NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `imc_id` PRIMARY KEY(`id`),
	CONSTRAINT `imc_id_unique` UNIQUE(`id`),
	CONSTRAINT `imc_module_capability_unique` UNIQUE(`module_id`,`capability_key`)
);
--> statement-breakpoint
ALTER TABLE `candidate_interview_answers` ADD `is_follow_up` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `candidate_interview_answers` ADD `follow_up_of_answer_id` varchar(36);--> statement-breakpoint
ALTER TABLE `interview_question_bank` ADD `primary_module_id` varchar(36);--> statement-breakpoint
ALTER TABLE `interview_question_bank` ADD `grounded_ideal_points` longtext;--> statement-breakpoint
ALTER TABLE `interview_question_bank` ADD `grounded_acceptance_criteria` longtext;--> statement-breakpoint
ALTER TABLE `interview_question_bank` ADD `grounded_sources` longtext;--> statement-breakpoint
ALTER TABLE `interview_question_bank` ADD `grounded_coverage` enum('full','partial','none');--> statement-breakpoint
ALTER TABLE `interview_question_bank` ADD `source_id` varchar(255);--> statement-breakpoint
ALTER TABLE `interview_delivery_metrics` ADD CONSTRAINT `interview_delivery_metrics_answer_id_candidate_interview_answers_id_fk` FOREIGN KEY (`answer_id`) REFERENCES `candidate_interview_answers`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_module_capabilities` ADD CONSTRAINT `interview_module_capabilities_module_id_interview_modules_id_fk` FOREIGN KEY (`module_id`) REFERENCES `interview_modules`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_module_capabilities` ADD CONSTRAINT `interview_module_capabilities_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `idm_created_idx` ON `interview_delivery_metrics` (`created_at`);--> statement-breakpoint
CREATE INDEX `imc_module_idx` ON `interview_module_capabilities` (`module_id`);--> statement-breakpoint
ALTER TABLE `candidate_interview_answers` ADD CONSTRAINT `interview_answers_follow_up_of_fk` FOREIGN KEY (`follow_up_of_answer_id`) REFERENCES `candidate_interview_answers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interview_question_bank` ADD CONSTRAINT `interview_question_bank_primary_module_id_interview_modules_id_fk` FOREIGN KEY (`primary_module_id`) REFERENCES `interview_modules`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `interview_answers_follow_up_of_idx` ON `candidate_interview_answers` (`follow_up_of_answer_id`);--> statement-breakpoint
CREATE INDEX `iqb_primary_module_idx` ON `interview_question_bank` (`primary_module_id`);--> statement-breakpoint
CREATE INDEX `iqb_source_idx` ON `interview_question_bank` (`source_id`);