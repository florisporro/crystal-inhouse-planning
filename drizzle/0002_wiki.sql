CREATE TABLE `wiki_images` (
	`id` text PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`private` integer DEFAULT true NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wiki_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` integer NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`private` integer DEFAULT false NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`revision_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `wiki_topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revision_id`) REFERENCES `wiki_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_pages_slug_unique` ON `wiki_pages` (`slug`);--> statement-breakpoint
CREATE TABLE `wiki_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`author_email` text NOT NULL,
	`author_name` text NOT NULL,
	`suggestion_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `wiki_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wiki_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` integer,
	`topic_id` integer,
	`base_revision_id` integer,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`author_email` text NOT NULL,
	`author_name` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	FOREIGN KEY (`page_id`) REFERENCES `wiki_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `wiki_topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`base_revision_id`) REFERENCES `wiki_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wiki_topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`intro` text DEFAULT '' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_topics_slug_unique` ON `wiki_topics` (`slug`);