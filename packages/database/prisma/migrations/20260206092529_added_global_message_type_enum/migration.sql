/*
  Warnings:

  - Changed the type of `type` on the `GlobalMessage` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "GlobalMessageType" AS ENUM ('COMMIT', 'MSG', 'WELCOME', 'TOMBSTONE', 'EDIT');

-- DropIndex
DROP INDEX "KeyPackage_userId_usedAt_idx";

-- AlterTable
ALTER TABLE "GlobalMessage" DROP COLUMN "type",
ADD COLUMN     "type" "GlobalMessageType" NOT NULL;

-- CreateIndex
CREATE INDEX "KeyPackage_userId_usedAt_createdAt_idx" ON "KeyPackage"("userId", "usedAt", "createdAt");
