const TAVUS_API_BASE = "https://tavusapi.com/v2";
const MAX_TRANSCRIPT_TURNS = 120;
const MAX_TURN_LENGTH = 6000;
const STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "by", "can", "describe",
  "do", "for", "from", "how", "i", "if", "in", "is", "it", "me", "of", "on",
  "or", "our", "please", "role", "tell", "that", "the", "their", "them", "then",
  "there", "this", "to", "use", "what", "when", "which", "with", "would", "you",
  "your",
]);

export class TavusProviderError extends Error {
  constructor(category) {
    super(category);
    this.name = "TavusProviderError";
    this.category = category;
  }
}

export function isTavusConfigured(env = process.env) {
  return Boolean(env.TAVUS_API_KEY?.trim() && env.TAVUS_PAL_ID?.trim());
}

export function getTavusConversation(profileSnapshot) {
  const conversation = profileSnapshot?.tavusConversation;
  if (typeof conversation?.conversationId !== "string" || typeof conversation?.conversationUrl !== "string") {
    return null;
  }
  return {
    conversationId: conversation.conversationId,
    conversationUrl: conversation.conversationUrl,
  };
}

export function withTavusConversation(profileSnapshot, conversation) {
  return {
    ...(profileSnapshot && typeof profileSnapshot === "object" && !Array.isArray(profileSnapshot)
      ? profileSnapshot
      : {}),
    tavusConversation: {
      conversationId: conversation.conversationId,
      conversationUrl: conversation.conversationUrl,
    },
  };
}

export function publicProfileSnapshot(profileSnapshot) {
  if (!profileSnapshot || typeof profileSnapshot !== "object" || Array.isArray(profileSnapshot)) return {};
  const { tavusConversation: _privateConversation, ...publicSnapshot } = profileSnapshot;
  return publicSnapshot;
}

export function buildTavusConversationPayload(session, palId) {
  const questions = Array.isArray(session.questions) ? session.questions : [];
  const questionLines = questions.map((question, index) => `${index + 1}. ${question.question}`);
  const focus = session.profileSnapshot?.interviewFocus || "job readiness";
  const conversationalContext = [
    `You are Nexora's interview coach for a ${session.careerTitle} role.`,
    `Interview type: ${session.interviewType}. Difficulty: ${session.difficulty}. Focus: ${focus}.`,
    "Conduct a realistic, supportive, role-specific spoken interview in English.",
    "Ask the planned questions below one at a time, preserving their wording and order.",
    "After each substantive candidate answer, respond specifically to what they said and ask at most one concise, relevant follow-up before moving on.",
    "Do not invent candidate experience, give away evaluation criteria, or claim to make hiring decisions.",
    "Do not ask for sensitive personal data. Do not record or request recording.",
    `Planned questions:\n${questionLines.join("\n")}`,
  ].join("\n");

  return {
    pal_id: palId,
    conversational_context: conversationalContext.slice(0, 12000),
    custom_greeting: `Welcome. I’m your ${session.careerTitle} interview coach. Let’s begin with the first question.`,
    properties: {
      max_call_duration: Math.max(60, Math.min(60 * 60, session.duration * 60)),
      enable_recording: false,
    },
  };
}

export function validateTavusConversationResponse(payload) {
  if (!payload || typeof payload !== "object"
    || typeof payload.conversation_id !== "string" || !payload.conversation_id.trim()
    || typeof payload.conversation_url !== "string") {
    throw new TavusProviderError("unexpected_response");
  }
  return {
    conversationId: payload.conversation_id.trim(),
    conversationUrl: validateTavusRoomUrl(payload.conversation_url),
  };
}

export function validateTavusRoomUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TavusProviderError("unexpected_response");
  }
  const trustedHost = url.hostname === "tavus.daily.co"
    || (url.hostname.endsWith(".tavus.io") && url.hostname !== "tavus.io");
  if (url.protocol !== "https:" || !trustedHost || url.username || url.password
    || (url.port && url.port !== "443")) {
    throw new TavusProviderError("unexpected_response");
  }
  return url.toString();
}

export function extractTavusTranscript(payload) {
  if (!Array.isArray(payload?.events)) return null;
  const transcriptEvents = payload.events.filter((event) => event?.event_type === "application.transcription_ready");
  let hasValidTranscript = false;
  for (const event of transcriptEvents.reverse()) {
    const transcript = event?.properties?.transcript;
    if (!Array.isArray(transcript) || transcript.length > MAX_TRANSCRIPT_TURNS) continue;
    hasValidTranscript = true;
    const turns = transcript.flatMap((turn) => {
      const role = turn?.role === "assistant" || turn?.role === "user" ? turn.role : null;
      const content = typeof turn?.content === "string" ? turn.content.trim() : "";
      if (!role || !content || content.length > MAX_TURN_LENGTH) return [];
      return [{ role, content }];
    });
    if (turns.length) return turns;
  }
  return hasValidTranscript ? [] : null;
}

export function mapTavusTranscriptToAnswers(questions, turns) {
  if (!Array.isArray(questions) || !Array.isArray(turns)) {
    throw new TavusProviderError("unexpected_response");
  }
  const mapped = questions.map((question) => ({
    questionId: question.id,
    answerParts: [],
    interviewerTurns: [],
  }));
  let activeQuestionIndex = -1;
  for (const turn of turns) {
    if (turn.role === "assistant") {
      const nextIndex = activeQuestionIndex + 1;
      if (nextIndex < questions.length && questionMatchScore(turn.content, questions[nextIndex].question) >= 0.55) {
        activeQuestionIndex = nextIndex;
      }
      if (activeQuestionIndex >= 0) {
        mapped[activeQuestionIndex].interviewerTurns.push({
          text: turn.content,
          savedAt: null,
        });
      }
    } else if (turn.role === "user" && activeQuestionIndex >= 0) {
      mapped[activeQuestionIndex].answerParts.push(turn.content);
    }
  }
  const answers = mapped.flatMap((item) => {
    const answerText = item.answerParts.join("\n\nFollow-up response: ").trim();
    if (answerText.length < 5) return [];
    return [{
      questionId: item.questionId,
      answerText: answerText.slice(0, 12000),
      interviewerTurns: item.interviewerTurns,
    }];
  });
  if (!answers.length) throw new TavusProviderError("transcript_unusable");
  return answers;
}

function questionMatchScore(transcript, question) {
  const expectedTokens = tokenize(question);
  const heardTokens = new Set(tokenize(transcript));
  if (expectedTokens.length < 4) return 0;
  const matches = expectedTokens.filter((token) => heardTokens.has(token)).length;
  return matches / expectedTokens.length;
}

function tokenize(value) {
  return [...new Set(value.toLowerCase().match(/[a-z0-9]+/g) || [])]
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

async function tavusRequest(path, { method = "GET", body, fetchImpl = fetch, allowEmptyResponse = false } = {}) {
  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey?.trim()) throw new TavusProviderError("not_configured");
  let response;
  try {
    response = await fetchImpl(`${TAVUS_API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new TavusProviderError("network");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new TavusProviderError("credentials");
    if (response.status === 429) throw new TavusProviderError("rate_limited");
    if (response.status >= 500) throw new TavusProviderError("provider_unavailable");
    if (response.status === 404 || response.status === 409) throw new TavusProviderError("conversation_closed");
    throw new TavusProviderError("provider_rejected");
  }
  if (response.status === 204) return {};
  try {
    const responseText = await response.text();
    if (!responseText.trim() && allowEmptyResponse) return {};
    return JSON.parse(responseText);
  } catch {
    throw new TavusProviderError("unexpected_response");
  }
}

export async function createTavusConversation(session, fetchImpl) {
  if (!isTavusConfigured()) throw new TavusProviderError("not_configured");
  const payload = await tavusRequest("/conversations", {
    method: "POST",
    body: buildTavusConversationPayload(session, process.env.TAVUS_PAL_ID.trim()),
    fetchImpl,
  });
  return validateTavusConversationResponse(payload);
}

export async function endTavusConversation(conversationId, fetchImpl) {
  try {
    await tavusRequest(`/conversations/${encodeURIComponent(conversationId)}/end`, {
      method: "POST",
      fetchImpl,
      allowEmptyResponse: true,
    });
  } catch (error) {
    if (error.category !== "conversation_closed") throw error;
  }
}

export async function getTavusTranscript(conversationId, fetchImpl) {
  const payload = await tavusRequest(
    `/conversations/${encodeURIComponent(conversationId)}?verbose=true`,
    { fetchImpl },
  );
  return extractTavusTranscript(payload);
}

export async function getTavusConversationStatus(conversationId, fetchImpl) {
  const payload = await tavusRequest(
    `/conversations/${encodeURIComponent(conversationId)}`,
    { fetchImpl },
  );
  if (typeof payload?.status !== "string") {
    throw new TavusProviderError("unexpected_response");
  }
  return payload.status;
}

export function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function tavusErrorMessage(category) {
  const messages = {
    not_configured: "Tavus video interviews are not configured. Add TAVUS_API_KEY and TAVUS_PAL_ID to .env.local, then restart the server.",
    credentials: "Tavus rejected the server credentials. Check the API key and PAL ID in .env.local.",
    rate_limited: "Tavus is temporarily rate-limiting requests. Please wait and retry.",
    network: "Could not reach Tavus. Check the server connection and retry.",
    provider_unavailable: "Tavus is temporarily unavailable. Please retry shortly.",
    provider_rejected: "Tavus could not start this conversation. Verify that the PAL is enabled for CVI.",
    unexpected_response: "Tavus returned an unexpected response. Please retry or use audio-only practice.",
    conversation_closed: "The Tavus conversation has already ended.",
    transcript_unusable: "Tavus ended without a usable spoken exchange, so no report was saved. Retry the video room; if it stays blank, open the Tavus room in a new tab and speak after the interviewer joins.",
    transcript_pending: "Tavus is still preparing the transcript. Please wait a few seconds and retry.",
  };
  return messages[category] || "The Tavus interview could not be completed. Please retry.";
}
