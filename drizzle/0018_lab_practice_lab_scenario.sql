UPDATE `lab_practice_labs` SET `details` = '' WHERE `details` IS NULL;--> statement-breakpoint
ALTER TABLE `lab_practice_labs` MODIFY COLUMN `details` text NOT NULL;--> statement-breakpoint
ALTER TABLE `lab_practice_labs` ADD `scenario` text;
