-- Guided Labs: open / close single days per batch + switch a day off in a schedule.
-- ADDITIVE ONLY and safe to re-run (a repeat just errors on the existing
-- column / table / index and moves on). No backfill: with no exception rows,
-- every batch behaves exactly as before (days 1..current_day open).
ALTER TABLE `lab_practice_schedule_days` ADD `is_active` boolean NOT NULL DEFAULT true;
--> statement-breakpoint
CREATE TABLE `lab_practice_batch_day_overrides` (
	`batch_id` int NOT NULL,
	`day_id` int NOT NULL,
	`is_open` boolean NOT NULL,
	CONSTRAINT `lp_batch_day_ovr_uq` UNIQUE(`batch_id`,`day_id`)
);
--> statement-breakpoint
CREATE INDEX `lp_batch_day_ovr_day_idx` ON `lab_practice_batch_day_overrides` (`day_id`);
--> statement-breakpoint
ALTER TABLE `lab_practice_batch_day_overrides` ADD CONSTRAINT `lp_batch_day_ovr_batch_fk` FOREIGN KEY (`batch_id`) REFERENCES `lab_practice_batches`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_batch_day_overrides` ADD CONSTRAINT `lp_batch_day_ovr_day_fk` FOREIGN KEY (`day_id`) REFERENCES `lab_practice_schedule_days`(`id`) ON DELETE cascade ON UPDATE no action;
