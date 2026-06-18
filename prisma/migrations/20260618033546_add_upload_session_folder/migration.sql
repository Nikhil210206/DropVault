-- DropIndex
DROP INDEX "files_name_trgm_idx";

-- DropIndex
DROP INDEX "folders_path_prefix_idx";

-- AlterTable
ALTER TABLE "upload_sessions" ADD COLUMN     "folderId" UUID;

-- AddForeignKey
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
