/*
  Warnings:

  - The `logo` column on the `work_experiences` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "work_experiences" DROP COLUMN "logo",
ADD COLUMN     "logo" UUID;
