ALTER TABLE `interview_practice_attempt_overrides` DROP FOREIGN KEY `interview_practice_attempt_overrides_user_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `interview_practice_attempt_overrides` DROP FOREIGN KEY `interview_practice_attempt_overrides_module_id_interview_modules_id_fk`;
--> statement-breakpoint
ALTER TABLE `interview_practice_attempt_overrides` ADD CONSTRAINT `ipao_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_practice_attempt_overrides` ADD CONSTRAINT `ipao_module_fk` FOREIGN KEY (`module_id`) REFERENCES `interview_modules`(`id`) ON DELETE cascade ON UPDATE cascade;