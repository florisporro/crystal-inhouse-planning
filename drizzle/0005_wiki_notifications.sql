ALTER TABLE `wiki_suggestions` ADD `review_note` text;--> statement-breakpoint
ALTER TABLE `wiki_suggestions` ADD `admin_notified_at` integer;--> statement-breakpoint
ALTER TABLE `wiki_suggestions` ADD `author_notified_at` integer;--> statement-breakpoint
-- suggestions reviewed before notifications existed must not trigger outcome emails on deploy
UPDATE `wiki_suggestions` SET `author_notified_at` = `reviewed_at` WHERE `reviewed_at` IS NOT NULL;
