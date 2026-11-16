-- Guided Labs: trainer review queue + one-batch-per-trainee membership + day pointer.
-- ADDITIVE ONLY: no column or table is dropped, so code deployed before this
-- migration keeps working. Every statement is safe to re-run.
ALTER TABLE `lab_practice_step_completions` ADD `reviewed_at` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `lab_practice_step_completions` ADD `reviewed_by` int NULL DEFAULT NULL;
--> statement-breakpoint
CREATE INDEX `lp_completion_reviewed_idx` ON `lab_practice_step_completions` (`reviewed_at`);
--> statement-breakpoint
ALTER TABLE `lab_practice_step_completions` ADD CONSTRAINT `lp_completion_reviewed_by_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `lab_practice_trainers`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_practice_sessions` ADD `comment_reviewed_at` timestamp NULL DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `lab_practice_batches` ADD `current_day` int NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `lab_practice_batch_members` (
	`batch_id` int NOT NULL,
	`trainee_id` int NOT NULL,
	`added_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lp_batch_member_trainee_uq` UNIQUE(`trainee_id`)
);
--> statement-breakpoint
CREATE INDEX `lp_batch_member_batch_idx` ON `lab_practice_batch_members` (`batch_id`);
--> statement-breakpoint
ALTER TABLE `lab_practice_batch_members` ADD CONSTRAINT `lp_batch_member_batch_fk` FOREIGN KEY (`batch_id`) REFERENCES `lab_practice_batches`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_batch_members` ADD CONSTRAINT `lp_batch_member_trainee_fk` FOREIGN KEY (`trainee_id`) REFERENCES `lab_practice_employees`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- Backfill: day pointer = the highest day the batch had switched on.
-- (Gaps below it are re-closed per trainee by scripts/lab-practice-convert-batches.mjs.)
UPDATE `lab_practice_batches` b SET b.`current_day` = COALESCE((SELECT MAX(d.`day_no`) FROM `lab_practice_batch_days` bd JOIN `lab_practice_schedule_days` d ON d.`id` = bd.`day_id` WHERE bd.`batch_id` = b.`id`), 0) WHERE b.`schedule_id` IS NOT NULL AND b.`current_day` = 0;
--> statement-breakpoint
-- Backfill: membership from enrollments.batch_id. A trainee found in several
-- batches keeps ONE (schedule batches first, then active, then newest); the
-- conversion script reports and resolves the rest.
INSERT IGNORE INTO `lab_practice_batch_members` (`batch_id`, `trainee_id`) SELECT e.`batch_id`, e.`trainee_id` FROM `lab_practice_module_enrollments` e JOIN `lab_practice_batches` b ON b.`id` = e.`batch_id` WHERE e.`is_active` = true ORDER BY (b.`schedule_id` IS NULL), b.`is_active` DESC, b.`id` DESC;
