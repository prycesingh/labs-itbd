-- Interview Coach parity, step 1: question types, categories, blueprint.
-- Additive only. Safe to re-run: duplicate column / key / entry errors are
-- skipped by sync-schema.mjs, and every UPDATE is idempotent.
--
-- 1) New nullable columns on the question bank.
ALTER TABLE `interview_question_bank`
  ADD COLUMN `question_type` enum('screening','concept','technical','tools','behavioral') NULL AFTER `source_id`;--> statement-breakpoint
ALTER TABLE `interview_question_bank`
  ADD COLUMN `category` varchar(100) NULL AFTER `question_type`;--> statement-breakpoint
ALTER TABLE `interview_question_bank`
  ADD COLUMN `template_prompt_text` text NULL AFTER `category`;--> statement-breakpoint
CREATE INDEX `iqb_question_type_idx` ON `interview_question_bank` (`question_type`);--> statement-breakpoint
--
-- 2) Backfill type + category for questions imported from
--    interview-coach-main, derived from source_id. Mirrors
--    classifySourceId() in lib/interview/questionTypes.ts.
--    Hand-written questions (no source_id) stay NULL.
UPDATE `interview_question_bank`
  SET `question_type` = CASE SUBSTRING_INDEX(`source_id`, '__', 1)
        WHEN 'scr' THEN 'screening'
        WHEN 'beh' THEN 'behavioral'
        WHEN 'con' THEN 'concept'
        WHEN 'tool' THEN 'tools'
        ELSE 'technical'
      END,
      `category` = CASE SUBSTRING_INDEX(`source_id`, '__', 1)
        WHEN 'scr' THEN 'Screening'
        WHEN 'beh' THEN 'Behavioral'
        WHEN 'con' THEN 'Concept'
        WHEN 'tool' THEN 'Tools'
        WHEN 'end-user-computing' THEN 'End User Computing'
        WHEN 'ad-dns-dhcp' THEN 'AD/DNS/DHCP'
        WHEN 'exchange-online' THEN 'Exchange Online'
        WHEN 'entra-id' THEN 'Entra ID'
        WHEN 'microsoft-intune' THEN 'Microsoft Intune'
        WHEN 'sharepoint' THEN 'SharePoint'
        WHEN 'teams' THEN 'Teams'
        WHEN 'one-drive' THEN 'OneDrive'
        WHEN 'security-training' THEN 'Security Training'
        WHEN 'mac-training' THEN 'Mac Training'
        WHEN 'kaseya-rmm' THEN 'Kaseya RMM'
        WHEN 'it-glue' THEN 'IT Glue'
        WHEN 'ai-training' THEN 'AI Training'
        WHEN 'windows-networking' THEN 'Windows Networking'
      END
  WHERE `source_id` LIKE '%\_\_%'
    AND SUBSTRING_INDEX(`source_id`, '__', 1) IN (
      'scr','beh','con','tool',
      'end-user-computing','ad-dns-dhcp','exchange-online','entra-id',
      'microsoft-intune','sharepoint','teams','one-drive','security-training',
      'mac-training','kaseya-rmm','it-glue','ai-training','windows-networking'
    );--> statement-breakpoint
--
-- 3) Interview Coach: enable the 7-slot interview blueprint
--    (screening, concept x2, technical x2, tools, behavioral). Matches
--    DEFAULT_COACH_BLUEPRINT in lib/interview/questionTypes.ts.
INSERT IGNORE INTO `interview_module_capabilities`
  (`id`, `module_id`, `capability_key`, `enabled`, `config`, `updated_by`)
  SELECT UUID(), m.`id`, 'interview_blueprint', 1,
    '{"slots":[{"type":"screening"},{"type":"concept"},{"type":"concept"},{"type":"technical"},{"type":"technical"},{"type":"tools"},{"type":"behavioral"}]}',
    u.`id`
  FROM `interview_modules` m
  -- updated_by is a FK to users: attribute the row to a devAdmin.
  JOIN (SELECT `id` FROM `users` WHERE `role` = 'devAdmin' ORDER BY `id` LIMIT 1) u
  WHERE m.`name` = 'Interview Coach';--> statement-breakpoint
--
-- 4) Keep the module's display count in step with the blueprint length,
--    so the activation gate and the session's question count agree.
UPDATE `interview_modules`
  SET `question_display_count` = 7
  WHERE `name` = 'Interview Coach';
