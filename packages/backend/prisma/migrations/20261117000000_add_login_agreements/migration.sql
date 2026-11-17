-- No existing account is marked as having accepted terms or seen a release.
-- These audit/presentation records intentionally outlive roster deletion.
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailAtAcceptance" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "termsHash" TEXT NOT NULL,
    "termsText" TEXT NOT NULL,
    "acceptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "TermsAcceptance_userId_termsHash_key" ON "TermsAcceptance"("userId", "termsHash");
CREATE INDEX "TermsAcceptance_acceptedAt_idx" ON "TermsAcceptance"("acceptedAt");

CREATE TABLE "UserReleaseVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "UserReleaseVisit_userId_version_key" ON "UserReleaseVisit"("userId", "version");
