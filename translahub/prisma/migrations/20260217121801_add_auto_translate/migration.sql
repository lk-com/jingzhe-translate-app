-- AlterTable
ALTER TABLE `repositories` ADD COLUMN `auto_translate` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `ai_config` JSON NULL;
