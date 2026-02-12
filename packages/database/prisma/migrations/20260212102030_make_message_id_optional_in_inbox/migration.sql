-- DropForeignKey
ALTER TABLE "UserInboxItem" DROP CONSTRAINT "UserInboxItem_messageId_fkey";

-- AlterTable
ALTER TABLE "UserInboxItem" ALTER COLUMN "messageId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "UserInboxItem" ADD CONSTRAINT "UserInboxItem_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GlobalMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
