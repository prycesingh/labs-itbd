-- RBAC recalibration (data only — users.role is varchar(50), no DDL needed).
-- New role set: devAdmin, admin, executive, trainer, auditor, user.
--
-- 1) Guided Labs trainer authority moved from the lab_practice_trainers
--    registry to the app role. Anyone currently registered as an ACTIVE
--    trainer and holding no stronger role becomes "trainer", so existing
--    trainers keep their workspace. (devAdmin / executive are left alone:
--    devAdmin already includes trainer rights; executive is read-only.)
UPDATE `users` u
  JOIN `lab_practice_employees` e ON LOWER(e.`email`) = LOWER(u.`email`)
  JOIN `lab_practice_trainers` t ON t.`employee_id` = e.`id` AND t.`is_active` = 1
  SET u.`role` = 'trainer'
  WHERE u.`role` IN ('user','adminTeam','sales','taTeam','qateam','hrTeam','serviceDelivery');--> statement-breakpoint
-- 2) Retire the legacy roles ported from the source app. They granted no
--    access here, so everyone left on one becomes a plain "user".
UPDATE `users` SET `role` = 'user'
  WHERE `role` NOT IN ('devAdmin','admin','executive','trainer','auditor','user');
