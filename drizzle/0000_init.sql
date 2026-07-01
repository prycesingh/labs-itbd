CREATE TABLE `accounts` (
	`userId` varchar(255) NOT NULL,
	`type` varchar(255) NOT NULL,
	`provider` varchar(255) NOT NULL,
	`providerAccountId` varchar(255) NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` int,
	`token_type` varchar(255),
	`scope` varchar(255),
	`id_token` text,
	`session_state` varchar(255),
	CONSTRAINT `accounts_provider_providerAccountId` PRIMARY KEY(`provider`,`providerAccountId`)
);
--> statement-breakpoint
CREATE TABLE `background_jobs` (
	`id` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`active_lock_key` varchar(100),
	`status` enum('queued','running','completed','failed') NOT NULL,
	`progress` int NOT NULL DEFAULT 0,
	`attempts` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 3,
	`max_execution_time_ms` int NOT NULL DEFAULT 900000,
	`user_id` varchar(255) NOT NULL,
	`started_at` timestamp,
	`completed_at` timestamp,
	`execution_time_ms` int,
	`error` text,
	`result` json,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`correlation_id` varchar(255),
	`parent_job_id` varchar(255),
	`next_retry_at` timestamp,
	`heartbeat_at` timestamp,
	CONSTRAINT `background_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `background_jobs_active_lock_unique` UNIQUE(`active_lock_key`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`sessionToken` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`expires` timestamp NOT NULL,
	CONSTRAINT `sessions_sessionToken` PRIMARY KEY(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(255) NOT NULL,
	`emailVerified` timestamp,
	`image` text,
	`role` varchar(50) NOT NULL DEFAULT 'user',
	`username` varchar(50),
	`password` varchar(50),
	`sessionVersion` int NOT NULL DEFAULT 0,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` varchar(255) NOT NULL,
	`token` varchar(255) NOT NULL,
	`expires` timestamp NOT NULL,
	CONSTRAINT `verification_tokens_identifier_token` PRIMARY KEY(`identifier`,`token`)
);
--> statement-breakpoint
CREATE TABLE `admin_interview_evaluations` (
	`id` varchar(36) NOT NULL,
	`answer_id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`admin_user_id` varchar(255) NOT NULL,
	`totalScoreOverride` int NOT NULL,
	`dimension_overrides` json,
	`admin_notes` text,
	`comparison_to_ai` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_interview_evaluations_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_interview_evaluations_answer_id_unique` UNIQUE(`answer_id`),
	CONSTRAINT `admin_interview_evaluations_id_unique` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_interview_evaluations` (
	`id` varchar(36) NOT NULL,
	`answer_id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`model_used` varchar(50) NOT NULL DEFAULT 'gpt-4-turbo',
	`prompt_version` varchar(20) NOT NULL DEFAULT '1.0',
	`evaluation_json_structured` json NOT NULL,
	`tokens_used` json NOT NULL,
	`processing_time_ms` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ai_interview_evaluations_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_interview_evaluations_answer_id_unique` UNIQUE(`answer_id`),
	CONSTRAINT `ai_interview_evaluations_id_unique` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidate_interview_answers` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`question_id` varchar(255) NOT NULL,
	`questionIndex` int NOT NULL,
	`audio_storage_path` varchar(500) NOT NULL,
	`audio_mime_type` varchar(50) NOT NULL,
	`audioSizeBytes` int NOT NULL,
	`audioDurationMs` int NOT NULL,
	`uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`uploadRetries` int NOT NULL DEFAULT 0,
	`transcript_status` enum('pending','transcribing','completed','failed') NOT NULL DEFAULT 'pending',
	`transcript_job_id` varchar(255),
	`transcripted_text` text,
	`transcript_provider` varchar(50) DEFAULT 'openai',
	`transcript_detected_language` varchar(10),
	`transcript_confidence` decimal(5,4),
	`transcript_raw_response` json,
	`transcript_processing_time_ms` int,
	`evaluation_status` enum('pending','evaluating','completed','failed') NOT NULL DEFAULT 'pending',
	`evaluation_job_id` varchar(255),
	`ai_evaluation_id` varchar(36),
	`admin_evaluation_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interview_answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `interview_answers_id_unique` UNIQUE(`id`),
	CONSTRAINT `interview_answers_session_question_idx` UNIQUE(`session_id`,`question_id`)
);
--> statement-breakpoint
CREATE TABLE `candidate_interview_sessions` (
	`id` varchar(36) NOT NULL,
	`candidate_id` varchar(255) NOT NULL,
	`module_id` varchar(255) NOT NULL,
	`interview_type` enum('hris-qa','product-qa','customer-service','technical-qa') NOT NULL,
	`status` enum('draft','recording','recorded','processing','completed','failed') NOT NULL DEFAULT 'draft',
	`session_state` json NOT NULL DEFAULT ('{}'),
	`audio_storage_mode` enum('filesystem','s3') NOT NULL DEFAULT 'filesystem',
	`totalQuestions` int NOT NULL,
	`recordedCount` int NOT NULL DEFAULT 0,
	`processedCount` int NOT NULL DEFAULT 0,
	`started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`recording_completed_at` timestamp,
	`processing_started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interview_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `interview_sessions_id_unique` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_module_question_assignments` (
	`id` varchar(36) NOT NULL,
	`module_id` varchar(36) NOT NULL,
	`question_id` varchar(36) NOT NULL,
	`question_order` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `imqa_id` PRIMARY KEY(`id`),
	CONSTRAINT `imqa_id_unique` UNIQUE(`id`),
	CONSTRAINT `imqa_module_question_unique` UNIQUE(`module_id`,`question_id`),
	CONSTRAINT `imqa_module_order_unique` UNIQUE(`module_id`,`question_order`)
);
--> statement-breakpoint
CREATE TABLE `interview_modules` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`question_display_count` int NOT NULL DEFAULT 5,
	`description` text,
	`interview_type` enum('hris-qa','product-qa','customer-service','technical-qa') NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interview_modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `interview_modules_id_unique` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_question_bank` (
	`id` varchar(36) NOT NULL,
	`prompt_text` text NOT NULL,
	`prompt_audio_path` varchar(500),
	`prompt_transcript` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `iqb_id` PRIMARY KEY(`id`),
	CONSTRAINT `iqb_id_unique` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_question_standard_responses` (
	`id` varchar(36) NOT NULL,
	`question_id` varchar(36) NOT NULL,
	`response_text` text NOT NULL,
	`response_audio_path` varchar(500),
	`response_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interview_standard_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `interview_standard_responses_id_unique` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_questions` (
	`id` varchar(36) NOT NULL,
	`module_id` varchar(36) NOT NULL,
	`prompt_text` text NOT NULL,
	`prompt_audio_path` varchar(500),
	`prompt_transcript` text,
	`question_order` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interview_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `interview_questions_id_unique` UNIQUE(`id`),
	CONSTRAINT `interview_questions_module_order_unique` UNIQUE(`module_id`,`question_order`)
);
--> statement-breakpoint
CREATE TABLE `interview_session_summaries` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`candidate_id` varchar(255) NOT NULL,
	`module_id` varchar(255) NOT NULL,
	`overall_ai_score` decimal(5,2),
	`overall_admin_score` decimal(5,2),
	`ai_strengths` json NOT NULL DEFAULT ('[]'),
	`ai_improvement_areas` json NOT NULL DEFAULT ('[]'),
	`admin_notes` text,
	`generated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`summary_generation_job_id` varchar(255),
	CONSTRAINT `interview_session_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `interview_session_summaries_session_id_unique` UNIQUE(`session_id`),
	CONSTRAINT `interview_session_summaries_id_unique` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_ai_requests` (
	`id` varchar(36) NOT NULL,
	`submission_id` varchar(36) NOT NULL,
	`prompt_version_id` varchar(36),
	`model` varchar(120) NOT NULL,
	`status` enum('pending','completed','failed','retrying') NOT NULL DEFAULT 'pending',
	`request_payload` json NOT NULL,
	`input_tokens` int,
	`output_tokens` int,
	`cost_usd_cents` int,
	`error_message` text,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `email_assessment_ai_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_ai_responses` (
	`id` varchar(36) NOT NULL,
	`ai_request_id` varchar(36) NOT NULL,
	`raw_response` json NOT NULL,
	`validation_errors` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_assessment_ai_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_assessments` (
	`id` varchar(36) NOT NULL,
	`candidate_id` varchar(255) NOT NULL,
	`scenario_id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`session_index` int,
	`status` enum('in_progress','submitted','evaluating','completed','expired','failed') NOT NULL DEFAULT 'in_progress',
	`time_limit_minutes` int NOT NULL DEFAULT 30,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`due_at` timestamp NOT NULL,
	`submitted_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_assessment_assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_audit_logs` (
	`id` varchar(36) NOT NULL,
	`actor_id` varchar(255),
	`action` enum('scenario_created','scenario_updated','scenario_archived','assessment_started','submission_created','evaluation_completed','manual_score_created','report_exported') NOT NULL,
	`entity_type` varchar(80) NOT NULL,
	`entity_id` varchar(36),
	`metadata` json NOT NULL,
	`ip_address` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_assessment_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_evaluations` (
	`id` varchar(36) NOT NULL,
	`submission_id` varchar(36) NOT NULL,
	`prompt_version_id` varchar(36),
	`rubric_id` varchar(36),
	`status` enum('pending','completed','failed_validation','pending_retry','failed') NOT NULL DEFAULT 'pending',
	`overall_score` int,
	`grade` enum('A','B','C','D','E'),
	`category_scores` json,
	`strengths` json,
	`weaknesses` json,
	`improvements` json,
	`detailed_feedback` text,
	`verdict` text,
	`ai_detected` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_assessment_evaluations_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_assessment_evaluations_submission_id_unique` UNIQUE(`submission_id`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_manual_scores` (
	`id` varchar(36) NOT NULL,
	`submission_id` varchar(36) NOT NULL,
	`assessor_id` varchar(255) NOT NULL,
	`overall_score` int NOT NULL,
	`grade` enum('A','B','C','D','E') NOT NULL,
	`category_scores` json NOT NULL,
	`summary` text NOT NULL,
	`improvement_areas` json NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_assessment_manual_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_prompt_versions` (
	`id` varchar(36) NOT NULL,
	`version` varchar(64) NOT NULL,
	`system_prompt` text NOT NULL,
	`evaluation_prompt` text NOT NULL,
	`rubric_id` varchar(36) NOT NULL,
	`model` varchar(120) NOT NULL DEFAULT 'gpt-4o-mini',
	`active` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_assessment_prompt_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ea_prompt_versions_version_idx` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_rate_limits` (
	`key` varchar(240) NOT NULL,
	`window_start` timestamp NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_assessment_rate_limits_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_rubrics` (
	`id` varchar(36) NOT NULL,
	`version` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`weights` json NOT NULL,
	`active` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_assessment_rubrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `ea_rubrics_version_idx` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_scenarios` (
	`id` varchar(36) NOT NULL,
	`title` varchar(220) NOT NULL,
	`prompt` text NOT NULL,
	`difficulty` enum('beginner','intermediate','advanced') NOT NULL,
	`category` varchar(120) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`model_answer` text,
	`scoring_notes` text,
	`source` varchar(160) NOT NULL DEFAULT 'ITBD scenario bank',
	`created_by_id` varchar(255),
	`archived_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_assessment_scenarios_id` PRIMARY KEY(`id`),
	CONSTRAINT `ea_scenarios_title_idx` UNIQUE(`title`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_session_manual_scores` (
	`session_id` varchar(36) NOT NULL,
	`score` int NOT NULL,
	`notes` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_assessment_session_manual_scores_session_id` PRIMARY KEY(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `email_assessment_submissions` (
	`id` varchar(36) NOT NULL,
	`assessment_id` varchar(36) NOT NULL,
	`candidate_id` varchar(255) NOT NULL,
	`scenario_id` varchar(36) NOT NULL,
	`subject` varchar(998),
	`content` text NOT NULL,
	`word_count` int NOT NULL,
	`copy_penalty` int NOT NULL DEFAULT 0,
	`ip_address` varchar(64),
	`user_agent` text,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_assessment_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_assessment_submissions_assessment_id_unique` UNIQUE(`assessment_id`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `background_jobs` ADD CONSTRAINT `background_jobs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_interview_evaluations` ADD CONSTRAINT `admin_interview_evaluations_answer_id_candidate_interview_answers_id_fk` FOREIGN KEY (`answer_id`) REFERENCES `candidate_interview_answers`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `admin_interview_evaluations` ADD CONSTRAINT `admin_interview_evaluations_session_id_candidate_interview_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `candidate_interview_sessions`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `admin_interview_evaluations` ADD CONSTRAINT `admin_interview_evaluations_admin_user_id_users_id_fk` FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_interview_evaluations` ADD CONSTRAINT `ai_interview_evaluations_answer_id_candidate_interview_answers_id_fk` FOREIGN KEY (`answer_id`) REFERENCES `candidate_interview_answers`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ai_interview_evaluations` ADD CONSTRAINT `ai_interview_evaluations_session_id_candidate_interview_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `candidate_interview_sessions`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `candidate_interview_answers` ADD CONSTRAINT `candidate_interview_answers_session_id_candidate_interview_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `candidate_interview_sessions`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_module_question_assignments` ADD CONSTRAINT `interview_module_question_assignments_module_id_interview_modules_id_fk` FOREIGN KEY (`module_id`) REFERENCES `interview_modules`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_module_question_assignments` ADD CONSTRAINT `interview_module_question_assignments_question_id_interview_question_bank_id_fk` FOREIGN KEY (`question_id`) REFERENCES `interview_question_bank`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_question_standard_responses` ADD CONSTRAINT `interview_question_standard_responses_question_id_interview_question_bank_id_fk` FOREIGN KEY (`question_id`) REFERENCES `interview_question_bank`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_questions` ADD CONSTRAINT `interview_questions_module_id_interview_modules_id_fk` FOREIGN KEY (`module_id`) REFERENCES `interview_modules`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `interview_session_summaries` ADD CONSTRAINT `interview_session_summaries_session_id_candidate_interview_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `candidate_interview_sessions`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `email_assessment_ai_requests` ADD CONSTRAINT `email_assessment_ai_requests_submission_id_email_assessment_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `email_assessment_submissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_ai_requests` ADD CONSTRAINT `email_assessment_ai_requests_prompt_version_id_email_assessment_prompt_versions_id_fk` FOREIGN KEY (`prompt_version_id`) REFERENCES `email_assessment_prompt_versions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_ai_responses` ADD CONSTRAINT `email_assessment_ai_responses_ai_request_id_email_assessment_ai_requests_id_fk` FOREIGN KEY (`ai_request_id`) REFERENCES `email_assessment_ai_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_assessments` ADD CONSTRAINT `email_assessment_assessments_candidate_id_users_id_fk` FOREIGN KEY (`candidate_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_assessments` ADD CONSTRAINT `email_assessment_assessments_scenario_id_email_assessment_scenarios_id_fk` FOREIGN KEY (`scenario_id`) REFERENCES `email_assessment_scenarios`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_audit_logs` ADD CONSTRAINT `email_assessment_audit_logs_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_evaluations` ADD CONSTRAINT `email_assessment_evaluations_submission_id_email_assessment_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `email_assessment_submissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_evaluations` ADD CONSTRAINT `email_assessment_evaluations_prompt_version_id_email_assessment_prompt_versions_id_fk` FOREIGN KEY (`prompt_version_id`) REFERENCES `email_assessment_prompt_versions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_evaluations` ADD CONSTRAINT `email_assessment_evaluations_rubric_id_email_assessment_rubrics_id_fk` FOREIGN KEY (`rubric_id`) REFERENCES `email_assessment_rubrics`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_manual_scores` ADD CONSTRAINT `email_assessment_manual_scores_submission_id_email_assessment_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `email_assessment_submissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_manual_scores` ADD CONSTRAINT `email_assessment_manual_scores_assessor_id_users_id_fk` FOREIGN KEY (`assessor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_prompt_versions` ADD CONSTRAINT `email_assessment_prompt_versions_rubric_id_email_assessment_rubrics_id_fk` FOREIGN KEY (`rubric_id`) REFERENCES `email_assessment_rubrics`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_scenarios` ADD CONSTRAINT `email_assessment_scenarios_created_by_id_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_submissions` ADD CONSTRAINT `email_assessment_submissions_assessment_id_email_assessment_assessments_id_fk` FOREIGN KEY (`assessment_id`) REFERENCES `email_assessment_assessments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_submissions` ADD CONSTRAINT `email_assessment_submissions_candidate_id_users_id_fk` FOREIGN KEY (`candidate_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_assessment_submissions` ADD CONSTRAINT `email_assessment_submissions_scenario_id_email_assessment_scenarios_id_fk` FOREIGN KEY (`scenario_id`) REFERENCES `email_assessment_scenarios`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`userId`);--> statement-breakpoint
CREATE INDEX `background_jobs_user_idx` ON `background_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `background_jobs_status_idx` ON `background_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `background_jobs_name_status_idx` ON `background_jobs` (`name`,`status`);--> statement-breakpoint
CREATE INDEX `background_jobs_created_idx` ON `background_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `background_jobs_correlation_idx` ON `background_jobs` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `background_jobs_parent_idx` ON `background_jobs` (`parent_job_id`);--> statement-breakpoint
CREATE INDEX `background_jobs_retry_idx` ON `background_jobs` (`next_retry_at`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `admin_interview_evaluations_admin_idx` ON `admin_interview_evaluations` (`admin_user_id`);--> statement-breakpoint
CREATE INDEX `admin_interview_evaluations_session_idx` ON `admin_interview_evaluations` (`session_id`);--> statement-breakpoint
CREATE INDEX `admin_interview_evaluations_updated_idx` ON `admin_interview_evaluations` (`updated_at`);--> statement-breakpoint
CREATE INDEX `ai_interview_evaluations_session_idx` ON `ai_interview_evaluations` (`session_id`);--> statement-breakpoint
CREATE INDEX `ai_interview_evaluations_created_idx` ON `ai_interview_evaluations` (`created_at`);--> statement-breakpoint
CREATE INDEX `interview_answers_transcript_status_idx` ON `candidate_interview_answers` (`transcript_status`,`evaluation_status`);--> statement-breakpoint
CREATE INDEX `interview_answers_transcript_job_idx` ON `candidate_interview_answers` (`transcript_job_id`);--> statement-breakpoint
CREATE INDEX `interview_answers_evaluation_job_idx` ON `candidate_interview_answers` (`evaluation_job_id`);--> statement-breakpoint
CREATE INDEX `interview_answers_created_idx` ON `candidate_interview_answers` (`created_at`);--> statement-breakpoint
CREATE INDEX `interview_sessions_candidate_idx` ON `candidate_interview_sessions` (`candidate_id`,`status`);--> statement-breakpoint
CREATE INDEX `interview_sessions_module_idx` ON `candidate_interview_sessions` (`module_id`,`status`);--> statement-breakpoint
CREATE INDEX `interview_sessions_created_idx` ON `candidate_interview_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `imqa_module_active_idx` ON `interview_module_question_assignments` (`module_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `imqa_question_idx` ON `interview_module_question_assignments` (`question_id`);--> statement-breakpoint
CREATE INDEX `interview_modules_type_active_idx` ON `interview_modules` (`interview_type`,`is_active`);--> statement-breakpoint
CREATE INDEX `interview_modules_created_idx` ON `interview_modules` (`created_at`);--> statement-breakpoint
CREATE INDEX `iqb_active_idx` ON `interview_question_bank` (`is_active`);--> statement-breakpoint
CREATE INDEX `iqb_created_idx` ON `interview_question_bank` (`created_at`);--> statement-breakpoint
CREATE INDEX `interview_standard_responses_question_idx` ON `interview_question_standard_responses` (`question_id`);--> statement-breakpoint
CREATE INDEX `interview_standard_responses_question_order_idx` ON `interview_question_standard_responses` (`question_id`,`response_order`);--> statement-breakpoint
CREATE INDEX `interview_questions_module_active_idx` ON `interview_questions` (`module_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `interview_session_summaries_candidate_idx` ON `interview_session_summaries` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `interview_session_summaries_module_idx` ON `interview_session_summaries` (`module_id`);--> statement-breakpoint
CREATE INDEX `ea_ai_requests_submission_idx` ON `email_assessment_ai_requests` (`submission_id`);--> statement-breakpoint
CREATE INDEX `ea_ai_requests_status_idx` ON `email_assessment_ai_requests` (`status`);--> statement-breakpoint
CREATE INDEX `ea_assessments_candidate_idx` ON `email_assessment_assessments` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `ea_assessments_scenario_idx` ON `email_assessment_assessments` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `ea_assessments_status_idx` ON `email_assessment_assessments` (`status`);--> statement-breakpoint
CREATE INDEX `ea_assessments_session_idx` ON `email_assessment_assessments` (`session_id`);--> statement-breakpoint
CREATE INDEX `ea_audit_logs_actor_idx` ON `email_assessment_audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `ea_audit_logs_action_idx` ON `email_assessment_audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `ea_audit_logs_entity_idx` ON `email_assessment_audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `ea_evaluations_status_idx` ON `email_assessment_evaluations` (`status`);--> statement-breakpoint
CREATE INDEX `ea_evaluations_grade_idx` ON `email_assessment_evaluations` (`grade`);--> statement-breakpoint
CREATE INDEX `ea_manual_scores_submission_idx` ON `email_assessment_manual_scores` (`submission_id`);--> statement-breakpoint
CREATE INDEX `ea_manual_scores_assessor_idx` ON `email_assessment_manual_scores` (`assessor_id`);--> statement-breakpoint
CREATE INDEX `ea_prompt_versions_active_idx` ON `email_assessment_prompt_versions` (`active`);--> statement-breakpoint
CREATE INDEX `ea_rubrics_active_idx` ON `email_assessment_rubrics` (`active`);--> statement-breakpoint
CREATE INDEX `ea_scenarios_active_idx` ON `email_assessment_scenarios` (`active`);--> statement-breakpoint
CREATE INDEX `ea_scenarios_difficulty_idx` ON `email_assessment_scenarios` (`difficulty`);--> statement-breakpoint
CREATE INDEX `ea_scenarios_category_idx` ON `email_assessment_scenarios` (`category`);--> statement-breakpoint
CREATE INDEX `ea_submissions_candidate_idx` ON `email_assessment_submissions` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `ea_submissions_scenario_idx` ON `email_assessment_submissions` (`scenario_id`);