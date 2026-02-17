/*
  Warnings:

  - You are about to drop the column `github_token` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `users` DROP COLUMN `github_token`;
