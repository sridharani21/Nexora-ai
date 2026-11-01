ALTER TABLE "AssessmentQuestion"
DROP CONSTRAINT "AssessmentQuestion_payload_check";

ALTER TABLE "AssessmentQuestion"
ADD CONSTRAINT "AssessmentQuestion_payload_check"
CHECK (
    ("type" = 'MCQ'
        AND "options" IS NOT NULL
        AND jsonb_typeof("options") = 'array'
        AND jsonb_array_length("options") = 4
        AND "answerKey" IS NOT NULL
        AND "answerKey" IN ('A', 'B', 'C', 'D'))
    OR
    ("type" = 'CODING' AND "options" IS NULL AND "answerKey" IS NULL
        AND "publicTestCases" IS NOT NULL
        AND jsonb_typeof("publicTestCases") = 'array'
        AND jsonb_array_length("publicTestCases") > 0
        AND "privateTestCases" IS NOT NULL
        AND jsonb_typeof("privateTestCases") = 'array'
        AND jsonb_array_length("privateTestCases") > 0)
);
