-- Narrow interview_type to ('customer-service', 'technical-QnA').
-- Done in three steps so no existing row is silently blanked by the final
-- MODIFY: widen the enum to hold both old and new values, remap the old
-- values, then drop them. 'technical-qa' (Interview Coach) becomes
-- 'technical-QnA'; the never-used 'hris-qa' / 'product-qa' fall back to
-- 'customer-service'. candidate_interview_sessions copies the module's type
-- at session creation, so it gets the same change.
ALTER TABLE `interview_modules` MODIFY COLUMN `interview_type` enum('hris-qa','product-qa','customer-service','technical-qa','technical-QnA') NOT NULL;--> statement-breakpoint
UPDATE `interview_modules` SET `interview_type` = 'technical-QnA' WHERE `interview_type` = 'technical-qa';--> statement-breakpoint
UPDATE `interview_modules` SET `interview_type` = 'customer-service' WHERE `interview_type` IN ('hris-qa','product-qa');--> statement-breakpoint
ALTER TABLE `interview_modules` MODIFY COLUMN `interview_type` enum('customer-service','technical-QnA') NOT NULL;--> statement-breakpoint
ALTER TABLE `candidate_interview_sessions` MODIFY COLUMN `interview_type` enum('hris-qa','product-qa','customer-service','technical-qa','technical-QnA') NOT NULL;--> statement-breakpoint
UPDATE `candidate_interview_sessions` SET `interview_type` = 'technical-QnA' WHERE `interview_type` = 'technical-qa';--> statement-breakpoint
UPDATE `candidate_interview_sessions` SET `interview_type` = 'customer-service' WHERE `interview_type` IN ('hris-qa','product-qa');--> statement-breakpoint
ALTER TABLE `candidate_interview_sessions` MODIFY COLUMN `interview_type` enum('customer-service','technical-QnA') NOT NULL;
