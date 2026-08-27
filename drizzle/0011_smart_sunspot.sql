ALTER TABLE `interview_delivery_metrics` DROP FOREIGN KEY `interview_delivery_metrics_answer_id_candidate_interview_answers_id_fk`;
--> statement-breakpoint
ALTER TABLE `interview_question_bank` DROP FOREIGN KEY `interview_question_bank_primary_module_id_interview_modules_id_fk`;
--> statement-breakpoint
ALTER TABLE `interview_delivery_metrics` ADD CONSTRAINT `idm_answer_fk` FOREIGN KEY (`answer_id`) REFERENCES `candidate_interview_answers`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_question_bank` ADD CONSTRAINT `iqb_primary_module_fk` FOREIGN KEY (`primary_module_id`) REFERENCES `interview_modules`(`id`) ON DELETE set null ON UPDATE cascade;