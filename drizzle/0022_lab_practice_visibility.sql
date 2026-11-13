CREATE TABLE `lab_practice_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module_id` int NOT NULL,
	`trainer_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lab_practice_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `lp_batch_module_name_uq` UNIQUE(`module_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `lp_batch_trainer_idx` ON `lab_practice_batches` (`trainer_id`);
--> statement-breakpoint
ALTER TABLE `lab_practice_batches` ADD CONSTRAINT `lp_batch_module_fk` FOREIGN KEY (`module_id`) REFERENCES `lab_practice_modules`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_batches` ADD CONSTRAINT `lp_batch_trainer_fk` FOREIGN KEY (`trainer_id`) REFERENCES `lab_practice_trainers`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE `lab_practice_batch_labs` (
	`batch_id` int NOT NULL,
	`lab_id` int NOT NULL,
	CONSTRAINT `lp_batch_lab_uq` UNIQUE(`batch_id`,`lab_id`)
);
--> statement-breakpoint
CREATE INDEX `lp_batch_lab_lab_idx` ON `lab_practice_batch_labs` (`lab_id`);
--> statement-breakpoint
ALTER TABLE `lab_practice_batch_labs` ADD CONSTRAINT `lp_batch_lab_batch_fk` FOREIGN KEY (`batch_id`) REFERENCES `lab_practice_batches`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_batch_labs` ADD CONSTRAINT `lp_batch_lab_lab_fk` FOREIGN KEY (`lab_id`) REFERENCES `lab_practice_labs`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE `lab_practice_enrollment_lab_overrides` (
	`enrollment_id` int NOT NULL,
	`lab_id` int NOT NULL,
	`visible` boolean NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lp_enroll_lab_ovr_uq` UNIQUE(`enrollment_id`,`lab_id`)
);
--> statement-breakpoint
CREATE INDEX `lp_enroll_lab_ovr_lab_idx` ON `lab_practice_enrollment_lab_overrides` (`lab_id`);
--> statement-breakpoint
ALTER TABLE `lab_practice_enrollment_lab_overrides` ADD CONSTRAINT `lp_enroll_lab_ovr_enroll_fk` FOREIGN KEY (`enrollment_id`) REFERENCES `lab_practice_module_enrollments`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_enrollment_lab_overrides` ADD CONSTRAINT `lp_enroll_lab_ovr_lab_fk` FOREIGN KEY (`lab_id`) REFERENCES `lab_practice_labs`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `lab_practice_module_enrollments` ADD `batch_id` int;
--> statement-breakpoint
CREATE INDEX `lp_enroll_batch_idx` ON `lab_practice_module_enrollments` (`batch_id`);
--> statement-breakpoint
ALTER TABLE `lab_practice_module_enrollments` ADD CONSTRAINT `lp_enroll_batch_fk` FOREIGN KEY (`batch_id`) REFERENCES `lab_practice_batches`(`id`) ON DELETE set null ON UPDATE no action;
