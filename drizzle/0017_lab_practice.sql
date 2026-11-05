CREATE TABLE `lab_practice_employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`emp_id` varchar(20) NOT NULL,
	`full_name` varchar(150) NOT NULL,
	`email` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lab_practice_employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `lp_emp_emp_id_uq` UNIQUE(`emp_id`),
	CONSTRAINT `lp_emp_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `lab_practice_module_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module_id` int NOT NULL,
	`trainee_id` int NOT NULL,
	`trainer_id` int NOT NULL,
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `lab_practice_module_enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_trainee_once_per_module` UNIQUE(`module_id`,`trainee_id`)
);
--> statement-breakpoint
CREATE TABLE `lab_practice_labs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module_id` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`details` text,
	`sequence_no` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lab_practice_labs_id` PRIMARY KEY(`id`),
	CONSTRAINT `lp_lab_module_title_uq` UNIQUE(`module_id`,`title`),
	CONSTRAINT `lp_lab_module_seq_uq` UNIQUE(`module_id`,`sequence_no`)
);
--> statement-breakpoint
CREATE TABLE `lab_practice_modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`info` text,
	`progression_mode` enum('free_order','steps_in_order','fully_sequential') NOT NULL DEFAULT 'fully_sequential',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lab_practice_modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `lp_module_title_uq` UNIQUE(`title`)
);
--> statement-breakpoint
CREATE TABLE `lab_practice_practice_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollment_id` int NOT NULL,
	`practice_date` date NOT NULL,
	`additional_comments` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lab_practice_practice_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_one_session_per_day` UNIQUE(`enrollment_id`,`practice_date`),
	CONSTRAINT `uq_session_enrollment_pair` UNIQUE(`id`,`enrollment_id`)
);
--> statement-breakpoint
CREATE TABLE `lab_practice_step_completion_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`step_completion_id` int NOT NULL,
	`stored_name` varchar(255) NOT NULL,
	`file_path` varchar(500) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime_type` varchar(50) NOT NULL,
	`size_bytes` int NOT NULL,
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lab_practice_step_completion_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `lp_file_stored_name_uq` UNIQUE(`stored_name`)
);
--> statement-breakpoint
CREATE TABLE `lab_practice_step_completions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollment_id` int NOT NULL,
	`session_id` int NOT NULL,
	`step_id` int NOT NULL,
	`completed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lab_practice_step_completions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_step_once_per_enrollment` UNIQUE(`enrollment_id`,`step_id`)
);
--> statement-breakpoint
CREATE TABLE `lab_practice_step_rejections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollment_id` int NOT NULL,
	`step_id` int NOT NULL,
	`rejected_by` int NOT NULL,
	`reason` text NOT NULL,
	`original_completed_at` timestamp NOT NULL,
	`rejected_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lab_practice_step_rejections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lab_practice_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`instructions` text,
	`sequence_no` int NOT NULL,
	`requires_photo` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lab_practice_steps_id` PRIMARY KEY(`id`),
	CONSTRAINT `lp_step_task_title_uq` UNIQUE(`task_id`,`title`),
	CONSTRAINT `lp_step_task_seq_uq` UNIQUE(`task_id`,`sequence_no`)
);
--> statement-breakpoint
CREATE TABLE `lab_practice_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lab_id` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`sequence_no` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lab_practice_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `lp_task_lab_title_uq` UNIQUE(`lab_id`,`title`),
	CONSTRAINT `lp_task_lab_seq_uq` UNIQUE(`lab_id`,`sequence_no`)
);
--> statement-breakpoint
CREATE TABLE `lab_practice_trainers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`registered_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lab_practice_trainers_id` PRIMARY KEY(`id`),
	CONSTRAINT `lp_trainer_employee_uq` UNIQUE(`employee_id`)
);
--> statement-breakpoint
ALTER TABLE `lab_practice_module_enrollments` ADD CONSTRAINT `lp_enroll_module_fk` FOREIGN KEY (`module_id`) REFERENCES `lab_practice_modules`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_module_enrollments` ADD CONSTRAINT `lp_enroll_trainee_fk` FOREIGN KEY (`trainee_id`) REFERENCES `lab_practice_employees`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_module_enrollments` ADD CONSTRAINT `lp_enroll_trainer_fk` FOREIGN KEY (`trainer_id`) REFERENCES `lab_practice_trainers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_labs` ADD CONSTRAINT `lp_lab_module_fk` FOREIGN KEY (`module_id`) REFERENCES `lab_practice_modules`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_labs` ADD CONSTRAINT `lp_lab_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `lab_practice_trainers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_modules` ADD CONSTRAINT `lp_module_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `lab_practice_trainers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_practice_sessions` ADD CONSTRAINT `lp_session_enrollment_fk` FOREIGN KEY (`enrollment_id`) REFERENCES `lab_practice_module_enrollments`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_step_completion_files` ADD CONSTRAINT `lp_file_completion_fk` FOREIGN KEY (`step_completion_id`) REFERENCES `lab_practice_step_completions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_step_completions` ADD CONSTRAINT `lp_completion_session_pair_fk` FOREIGN KEY (`session_id`,`enrollment_id`) REFERENCES `lab_practice_practice_sessions`(`id`,`enrollment_id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_step_completions` ADD CONSTRAINT `lp_completion_step_fk` FOREIGN KEY (`step_id`) REFERENCES `lab_practice_steps`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_step_rejections` ADD CONSTRAINT `lp_reject_enrollment_fk` FOREIGN KEY (`enrollment_id`) REFERENCES `lab_practice_module_enrollments`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_step_rejections` ADD CONSTRAINT `lp_reject_step_fk` FOREIGN KEY (`step_id`) REFERENCES `lab_practice_steps`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_step_rejections` ADD CONSTRAINT `lp_reject_trainer_fk` FOREIGN KEY (`rejected_by`) REFERENCES `lab_practice_trainers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_steps` ADD CONSTRAINT `lp_step_task_fk` FOREIGN KEY (`task_id`) REFERENCES `lab_practice_tasks`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_steps` ADD CONSTRAINT `lp_step_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `lab_practice_trainers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_tasks` ADD CONSTRAINT `lp_task_lab_fk` FOREIGN KEY (`lab_id`) REFERENCES `lab_practice_labs`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_tasks` ADD CONSTRAINT `lp_task_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `lab_practice_trainers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lab_practice_trainers` ADD CONSTRAINT `lp_trainer_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `lab_practice_employees`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lp_enroll_trainer_idx` ON `lab_practice_module_enrollments` (`trainer_id`);--> statement-breakpoint
CREATE INDEX `lp_enroll_trainee_idx` ON `lab_practice_module_enrollments` (`trainee_id`);--> statement-breakpoint
CREATE INDEX `lp_file_completion_idx` ON `lab_practice_step_completion_files` (`step_completion_id`);--> statement-breakpoint
CREATE INDEX `lp_completion_session_idx` ON `lab_practice_step_completions` (`session_id`);--> statement-breakpoint
CREATE INDEX `lp_completion_step_idx` ON `lab_practice_step_completions` (`step_id`);--> statement-breakpoint
CREATE INDEX `lp_reject_enroll_step_idx` ON `lab_practice_step_rejections` (`enrollment_id`,`step_id`);