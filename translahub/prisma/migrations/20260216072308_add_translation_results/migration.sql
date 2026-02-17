-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `github_id` INTEGER NOT NULL,
    `github_login` VARCHAR(191) NOT NULL,
    `github_token` VARCHAR(191) NOT NULL,
    `openrouter_api_key` VARCHAR(191) NULL,
    `is_whitelisted` BOOLEAN NOT NULL DEFAULT false,
    `daily_quota` INTEGER NOT NULL DEFAULT 100,
    `used_quota` INTEGER NOT NULL DEFAULT 0,
    `quota_reset_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_github_id_key`(`github_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repositories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `github_repo_id` INTEGER NOT NULL,
    `owner` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `default_branch` VARCHAR(191) NOT NULL DEFAULT 'main',
    `base_language` VARCHAR(191) NOT NULL DEFAULT 'zh',
    `target_languages` JSON NULL,
    `ignore_rules` VARCHAR(191) NULL,
    `last_commit_sha` VARCHAR(191) NULL,
    `baseline_sha` VARCHAR(191) NULL,
    `webhook_secret` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `repositories_user_id_idx`(`user_id`),
    UNIQUE INDEX `repositories_user_id_github_repo_id_key`(`user_id`, `github_repo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `translation_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `repository_id` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `type` VARCHAR(191) NULL,
    `target_languages` JSON NOT NULL,
    `total_files` INTEGER NOT NULL DEFAULT 0,
    `processed_files` INTEGER NOT NULL DEFAULT 0,
    `failed_files` INTEGER NOT NULL DEFAULT 0,
    `result` JSON NULL,
    `error_message` VARCHAR(191) NULL,
    `branch_name` VARCHAR(191) NULL,
    `pr_url` VARCHAR(191) NULL,
    `pr_number` INTEGER NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `translation_tasks_status_idx`(`status`),
    INDEX `translation_tasks_repository_id_idx`(`repository_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `translation_results` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `task_id` INTEGER NOT NULL,
    `original_path` VARCHAR(191) NOT NULL,
    `translated_path` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `original_content` JSON NOT NULL,
    `translated_content` JSON NOT NULL,
    `original_sha` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `error_message` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `translation_results_task_id_idx`(`task_id`),
    INDEX `translation_results_language_idx`(`language`),
    UNIQUE INDEX `translation_results_task_id_original_path_language_key`(`task_id`, `original_path`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(191) NOT NULL,
    `limit_type` VARCHAR(191) NOT NULL,
    `request_count` INTEGER NOT NULL DEFAULT 1,
    `window_start` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rate_limits_window_start_idx`(`window_start`),
    UNIQUE INDEX `rate_limits_identifier_limit_type_key`(`identifier`, `limit_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `repositories` ADD CONSTRAINT `repositories_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `translation_tasks` ADD CONSTRAINT `translation_tasks_repository_id_fkey` FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `translation_results` ADD CONSTRAINT `translation_results_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `translation_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
