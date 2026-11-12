BEGIN;

-- Human calibration ratings are append-only. A correction is a new, separately
-- attributable review workflow; submitted evidence must never be silently rewritten.
-- Human ratings are retained when attempts are retired. Only an explicit cleanup role
-- may remove synthetic fixtures in disposable review databases.
ALTER TABLE "RnDQAReferenceRating" DROP CONSTRAINT "RnDQAReferenceRating_attemptId_fkey";
ALTER TABLE "RnDQAReferenceRating" ADD CONSTRAINT "RnDQAReferenceRating_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "RnDAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "rnd_calibration_review_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = 'dmh_calibration_cleanup'
     AND current_database() ~ '^dmh71_review_[0-9a-f]{16}$'
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND NOT rolcanlogin AND NOT rolinherit AND NOT rolbypassrls AND NOT rolsuper) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Calibration reviews are immutable; submit a separately audited correction.'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "RnDQAReferenceRating_immutable"
  BEFORE UPDATE OR DELETE ON "RnDQAReferenceRating"
  FOR EACH ROW EXECUTE FUNCTION "rnd_calibration_review_immutable"();

COMMIT;
