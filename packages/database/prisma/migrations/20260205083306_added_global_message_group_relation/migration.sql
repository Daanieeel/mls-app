/*
  Warnings:

  - Added the required column `groupId` to the `GlobalMessage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GlobalMessage" ADD COLUMN     "groupId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "GlobalMessage" ADD CONSTRAINT "GlobalMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
