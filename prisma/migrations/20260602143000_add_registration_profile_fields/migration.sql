ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'ier_certificate';
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'ier_corporate_license';
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'rdb_certificate';
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'tin_certificate';
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'practice_license';
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'accreditation_cert';

ALTER TABLE "user"
ADD COLUMN "roleSpecific" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "registrationDocuments" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "selfieUrl" TEXT,
ADD COLUMN "registrationSubmittedAt" TIMESTAMP(3);
