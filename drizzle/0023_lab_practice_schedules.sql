CREATE TABLE `lab_practice_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lab_practice_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `lp_schedule_name_uq` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `lab_practice_schedules` ADD CONSTRAINT `lp_schedule_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `lab_practice_trainers`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE `lab_practice_schedule_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schedule_id` int NOT NULL,
	`day_no` int NOT NULL,
	`title` varchar(200),
	CONSTRAINT `lab_practice_schedule_days_id` PRIMARY KEY(`id`),
	CONSTRAINT `lp_sched_day_no_uq` UNIQUE(`schedule_id`,`day_no`)
);
--> statement-breakpoint
ALTER TABLE `lab_practice_schedule_days` ADD CONSTRAINT `lp_sched_day_schedule_fk` FOREIGN KEY (`schedule_id`) REFERENCES `lab_practice_schedules`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE `lab_practice_schedule_day_labs` (
	`schedule_id` int NOT NULL,
	`day_id` int NOT NULL,
	`lab_id` int NOT NULL,
	`sequence_no` int NOT NULL DEFAULT 0,
	CONSTRAINT `lp_sched_lab_uq` UNIQUE(`schedule_id`,`lab_id`)
);
--> statement-breakpoint
CREATE INDEX `lp_sched_day_lab_day_idx` ON `lab_practice_schedule_day_labs` (`day_id`);
--> statement-breakpoint
CREATE INDEX `lp_sched_day_lab_lab_idx` ON `lab_practice_schedule_day_labs` (`lab_id`);
--> statement-breakpoint
ALTER TABLE `lab_practice_schedule_day_labs` ADD CONSTRAINT `lp_sched_day_lab_sched_fk` FOREIGN KEY (`schedule_id`) REFERENCES `lab_practice_schedules`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_schedule_day_labs` ADD CONSTRAINT `lp_sched_day_lab_day_fk` FOREIGN KEY (`day_id`) REFERENCES `lab_practice_schedule_days`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_schedule_day_labs` ADD CONSTRAINT `lp_sched_day_lab_lab_fk` FOREIGN KEY (`lab_id`) REFERENCES `lab_practice_labs`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_batches` MODIFY COLUMN `module_id` int NULL;
--> statement-breakpoint
ALTER TABLE `lab_practice_batches` ADD `schedule_id` int;
--> statement-breakpoint
CREATE INDEX `lp_batch_schedule_idx` ON `lab_practice_batches` (`schedule_id`);
--> statement-breakpoint
ALTER TABLE `lab_practice_batches` ADD CONSTRAINT `lp_batch_schedule_fk` FOREIGN KEY (`schedule_id`) REFERENCES `lab_practice_schedules`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE `lab_practice_batch_days` (
	`batch_id` int NOT NULL,
	`day_id` int NOT NULL,
	CONSTRAINT `lp_batch_day_uq` UNIQUE(`batch_id`,`day_id`)
);
--> statement-breakpoint
CREATE INDEX `lp_batch_day_day_idx` ON `lab_practice_batch_days` (`day_id`);
--> statement-breakpoint
ALTER TABLE `lab_practice_batch_days` ADD CONSTRAINT `lp_batch_day_batch_fk` FOREIGN KEY (`batch_id`) REFERENCES `lab_practice_batches`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_batch_days` ADD CONSTRAINT `lp_batch_day_day_fk` FOREIGN KEY (`day_id`) REFERENCES `lab_practice_schedule_days`(`id`) ON DELETE cascade ON UPDATE no action;
