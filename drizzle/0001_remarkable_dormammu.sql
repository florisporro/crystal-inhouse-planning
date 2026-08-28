CREATE TABLE `gate_opens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`apartment_number` integer NOT NULL,
	`activity_id` integer,
	`email` text NOT NULL,
	`call_id` text,
	`phase` text DEFAULT 'dialling' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`apartment_number`) REFERENCES `apartments`(`number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action
);
