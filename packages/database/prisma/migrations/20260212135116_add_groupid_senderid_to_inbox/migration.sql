/*
  Warnings:

  - Added the required column `groupId` to the `UserInboxItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserInboxItem" ADD COLUMN     "groupId" TEXT NOT NULL,
ADD COLUMN     "senderId" TEXT;

-- CreateIndex
CREATE INDEX "UserInboxItem_groupId_idx" ON "UserInboxItem"("groupId");
