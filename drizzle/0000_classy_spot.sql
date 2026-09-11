CREATE TABLE `entries` (
	`owner_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`day` text NOT NULL,
	PRIMARY KEY(`owner_id`, `habit_id`, `day`),
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`start_date` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_habits_owner` ON `habits` (`owner_id`);