ALTER TABLE "Module2Blueprint"
DROP CONSTRAINT "Module2Blueprint_duration_check";

ALTER TABLE "Module2Blueprint"
ADD CONSTRAINT "Module2Blueprint_duration_check"
CHECK ("durationMinutes" > 0);
