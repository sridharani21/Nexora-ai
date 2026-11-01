import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTavusConversationPayload,
  endTavusConversation,
  extractTavusTranscript,
  getTavusConversation,
  getTavusConversationStatus,
  isTavusConfigured,
  mapTavusTranscriptToAnswers,
  publicProfileSnapshot,
  TavusProviderError,
  validateTavusConversationResponse,
  validateTavusRoomUrl,
  withTavusConversation,
} from "./tavus.js";

const questions = [
  {
    id: "q1",
    question: "For a UX Designer role, explain how you validate a design with user research.",
  },
  {
    id: "q2",
    question: "Describe how you prioritize accessibility when designing a product interface.",
  },
];

test("requires both server-side Tavus credentials", () => {
  assert.equal(isTavusConfigured({ TAVUS_API_KEY: "key", TAVUS_PAL_ID: "pal" }), true);
  assert.equal(isTavusConfigured({ TAVUS_API_KEY: "key" }), false);
  assert.equal(isTavusConfigured({ TAVUS_PAL_ID: "pal" }), false);
});

test("accepts Tavus's documented empty HTTP 200 response when ending a room", async () => {
  const previousKey = process.env.TAVUS_API_KEY;
  process.env.TAVUS_API_KEY = "test-only-not-a-real-key";
  let calledUrl = "";
  try {
    await endTavusConversation("conversation-123", async (url, options) => {
      calledUrl = url;
      assert.equal(options.method, "POST");
      return new Response(null, { status: 200 });
    });
    assert.equal(calledUrl, "https://tavusapi.com/v2/conversations/conversation-123/end");
  } finally {
    if (previousKey === undefined) delete process.env.TAVUS_API_KEY;
    else process.env.TAVUS_API_KEY = previousKey;
  }
});

test("reads only remote conversation status and accepts system-only transcript as finalized but unusable", async () => {
  const previousKey = process.env.TAVUS_API_KEY;
  process.env.TAVUS_API_KEY = "test-only-not-a-real-key";
  try {
    const status = await getTavusConversationStatus("conversation-123", async () => new Response(
      JSON.stringify({ status: "ended" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    assert.equal(status, "ended");
  } finally {
    if (previousKey === undefined) delete process.env.TAVUS_API_KEY;
    else process.env.TAVUS_API_KEY = previousKey;
  }
  assert.deepEqual(extractTavusTranscript({
    events: [{
      event_type: "application.transcription_ready",
      properties: { transcript: [{ role: "system", content: "No conversation turns recorded." }] },
    }],
  }), []);
});

test("stores a private Tavus room association without exposing it in the public profile snapshot", () => {
  const original = { interviewFocus: "projects" };
  const saved = withTavusConversation(original, {
    conversationId: "conversation-123",
    conversationUrl: "https://tavus.daily.co/room/123",
  });
  assert.equal(getTavusConversation(saved).conversationId, "conversation-123");
  assert.deepEqual(publicProfileSnapshot(saved), original);
  assert.equal(getTavusConversation(original), null);
});

test("builds a bounded role-specific, non-recording Tavus interview payload", () => {
  const payload = buildTavusConversationPayload({
    careerTitle: "UX Designer",
    interviewType: "mixed",
    difficulty: "intermediate",
    duration: 30,
    questions,
    profileSnapshot: { interviewFocus: "projects" },
  }, "pal-id");
  assert.equal(payload.pal_id, "pal-id");
  assert.equal(payload.properties.enable_recording, false);
  assert.equal(payload.properties.max_call_duration, 1800);
  assert.match(payload.conversational_context, /UX Designer/);
  assert.match(payload.conversational_context, /one concise, relevant follow-up/);
  assert.match(payload.conversational_context, /validate a design with user research/);
});

test("accepts only secure URLs on Tavus-owned room hosts", () => {
  const room = validateTavusConversationResponse({
    conversation_id: "conversation-123",
    conversation_url: "https://tavus.daily.co/room/123",
  });
  assert.equal(room.conversationId, "conversation-123");
  assert.equal(room.conversationUrl, "https://tavus.daily.co/room/123");
  assert.throws(() => validateTavusRoomUrl("http://tavus.daily.co/room/123"), TavusProviderError);
  assert.throws(() => validateTavusRoomUrl("https://attacker.example/room"), TavusProviderError);
  assert.throws(() => validateTavusRoomUrl("https://tavus.daily.co.attacker.example/room"), TavusProviderError);
});

test("extracts only bounded final user and assistant transcript turns", () => {
  const turns = extractTavusTranscript({
    events: [{
      event_type: "application.transcription_ready",
      properties: {
        transcript: [
          { role: "assistant", content: questions[0].question },
          { role: "user", content: "I use moderated research and compare the results to the design goals." },
          { role: "system", content: "Internal event" },
          { role: "user", content: " " },
        ],
      },
    }],
  });
  assert.deepEqual(turns, [
    { role: "assistant", content: questions[0].question },
    { role: "user", content: "I use moderated research and compare the results to the design goals." },
  ]);
  assert.equal(extractTavusTranscript({ events: [] }), null);
});

test("associates actual follow-up turns with the planned question before advancing", () => {
  const answers = mapTavusTranscriptToAnswers(questions, [
    { role: "assistant", content: questions[0].question },
    { role: "user", content: "I used moderated research and documented usability findings." },
    { role: "assistant", content: "What did one participant's feedback cause you to change?" },
    { role: "user", content: "I changed the navigation because testing showed the labels were unclear." },
    { role: "assistant", content: questions[1].question },
    { role: "user", content: "I include keyboard checks and test with assistive technology." },
  ]);
  assert.equal(answers.length, 2);
  assert.equal(answers[0].questionId, "q1");
  assert.match(answers[0].answerText, /Follow-up response/);
  assert.equal(answers[0].interviewerTurns.length, 2);
  assert.equal(answers[1].questionId, "q2");
  assert.equal(answers[1].interviewerTurns.length, 1);
});
