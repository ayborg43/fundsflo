// Deterministic stand-in for the OpenAI-compatible provider, used by the e2e
// suite. Two jobs:
//
//   1. Answer /v1/chat/completions predictably, so tests assert on app
//      behaviour instead of on model output.
//   2. Record what the app actually sent, so tests can assert things that are
//      otherwise invisible from outside -- that the prompt carries budgets and
//      bills, and that chat history is capped rather than resent in full.
//
// Framing follows the request: stream:true gets SSE, stream:false gets JSON.

import http from "node:http";

const CLASSIFIER_PREFIX = "You classify a single message";

const stats = {
  lastSystemPrompt: null,
  lastAnswerMessageCount: 0,
  maxAnswerMessageCount: 0,
  answerCalls: 0,
  classifierCalls: 0,
};

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Mirrors the shapes the real classifier is asked for. Kept intentionally dumb:
// the suite tests the app's plumbing, not the model's judgement.
function classify(text) {
  const lower = text.toLowerCase();

  if (/^\s*(add|create|make)\b.*\bcategory\b/.test(lower) || /\bcategory for\b/.test(lower)) {
    const name = (/(?:category for|category called)\s+([a-z0-9 ]+)/.exec(lower)?.[1] ?? "pets").trim();
    return { kind: "category", name: name.charAt(0).toUpperCase() + name.slice(1), emoji: "🐶" };
  }

  let m = /(?:spent|paid|bought)\s+\$?([\d.]+)\s*(?:on|for)?\s*([a-z ]*)/.exec(lower);
  const type = m ? "spend" : null;
  if (!m) m = /(?:made|earned|got paid)\s+\$?([\d.]+)\s*(?:from|for)?\s*([a-z ]*)/.exec(lower);
  if (!m) return { kind: "chat" };

  const account = /savings/.test(lower) ? 2 : null;
  const date = /yesterday/.test(lower) ? isoDaysAgo(1) : null;

  return {
    kind: "log",
    type: type ?? "make",
    amount: Number(m[1]),
    description: (m[2] || "").trim() || "something",
    account,
    category: null,
    date,
  };
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/_stats") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
    return;
  }
  if (req.method === "POST" && req.url === "/_reset") {
    stats.lastSystemPrompt = null;
    stats.lastAnswerMessageCount = 0;
    stats.maxAnswerMessageCount = 0;
    stats.answerCalls = 0;
    stats.classifierCalls = 0;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
    return;
  }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let payload = {};
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      /* fall through to the chat default */
    }
    const messages = payload.messages ?? [];
    const system = messages[0]?.content ?? "";
    const last = messages[messages.length - 1]?.content ?? "";

    if (system.startsWith(CLASSIFIER_PREFIX)) {
      stats.classifierCalls += 1;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: JSON.stringify(classify(last)) } }],
        })
      );
      return;
    }

    // Anything else is an answer built from the financial context: record what
    // the app sent so tests can assert on the prompt it composed.
    stats.answerCalls += 1;
    stats.lastSystemPrompt = system;
    stats.lastAnswerMessageCount = messages.length;
    stats.maxAnswerMessageCount = Math.max(stats.maxAnswerMessageCount, messages.length);

    if (payload.stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const chunk of ["Stub ", "answer ", "about ", "your ", "money."]) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: "Stub insight for your money." } }],
      })
    );
  });
});

server.listen(8080, "0.0.0.0", () => console.log("aistub listening on 8080"));
