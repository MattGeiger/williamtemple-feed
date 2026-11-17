-- A portable roster restore can reuse a source id for a different email.
-- Agreement evidence must still belong to the same authenticated identity.
DROP INDEX "TermsAcceptance_userId_termsHash_key";
CREATE UNIQUE INDEX "TermsAcceptance_userId_emailAtAcceptance_termsHash_key"
ON "TermsAcceptance"("userId", "emailAtAcceptance", "termsHash");
