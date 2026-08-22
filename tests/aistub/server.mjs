// Deterministic stand-in for the OpenAI-compatible provider, used by the e2e
// suite. Two jobs:
//
//   1. Answer /v1/chat/completions predictably, so tests assert on app
//      behaviour instead of on model output.
//   2. Record what the app actually sent, so tests can assert things that are
//      otherwise invisible from outside -- that the prompt carries budgets and
//      bills, and that chat history is capped rather than resent in full.
//
// Action requests are answered with SSE tool_calls, deliberately: that is what
// the real provider does whenever `tools` is present, even with stream:false,
// so the suite exercises the streaming tool-call parser rather than a shape
// production never sees.

import http from "node:http";

const ACTION_PREFIX = "You turn one message";

const stats = {
  lastSystemPrompt: null,
  lastActionPrompt: null,
  lastAnswerMessageCount: 0,
  maxAnswerMessageCount: 0,
  answerCalls: 0,
  actionCalls: 0,
};

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoDaysAhead(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Intentionally dumb pattern matching: the suite tests the app's plumbing, not
// the model's judgement. One message can yield several calls.
function decideCalls(text) {
  const lower = text.toLowerCase();
  const calls = [];

  if (/\b(switch|change).*(currency|naira|ngn|euro|eur)\b/.test(lower)) {
    calls.push({ name: "set_currency", args: { code: /euro|eur/.test(lower) ? "EUR" : "NGN" } });
  }

  if (/\b(add|create|make)\b.*\bcategory\b|\bcategory for\b/.test(lower)) {
    const name = (/(?:category for|category called)\s+([a-z0-9 ]+)/.exec(lower)?.[1] ?? "pets").trim();
    calls.push({
      name: "create_category",
      args: { name: name.charAt(0).toUpperCase() + name.slice(1), emoji: "🐶" },
    });
  }

  if (/\bdelete\b.*\bcategory\b/.test(lower)) {
    calls.push({ name: "delete_category", args: { category: 1 } });
  }

  if (/\b(add|open|create)\b.*\baccount\b/.test(lower)) {
    calls.push({ name: "create_account", args: { name: "Holiday", type: "savings" } });
  }

  if (/\b(add|new)\b[^.]*\b(bill|netflix)\b/.test(lower)) {
    calls.push({
      name: "create_bill",
      args: { name: "Netflix", amount: 15.99, recurrence: "monthly", due_day: 5 },
    });
  }

  if (/\b(pay for|need to pay|owe).*\b(once|on)\b/.test(lower) && !/\bnetflix\b/.test(lower)) {
    calls.push({
      name: "create_bill",
      args: {
        name: "School trip",
        amount: 40,
        recurrence: "once",
        due_date: isoDaysAhead(7),
      },
    });
  }

  if (/\bmark\b.*\bpaid\b|\bpaid\b.*\bbill\b/.test(lower)) {
    calls.push({ name: "mark_bill_paid", args: { bill: "Netflix" } });
  }

  if (/\bremind\b/.test(lower)) {
    calls.push({ name: "set_bill_reminder", args: { bill: "Netflix", days_before: 3 } });
  }

  if (/\bset\b[^.]*\bbudget\b/.test(lower)) {
    const period = /\bday|daily\b/.test(lower) ? "day" : /\bweek|weekly\b/.test(lower) ? "week" : "month";
    calls.push({ name: "set_budget", args: { category: 1, amount: 50, period } });
  }

  if (calls.length === 0) {
    let m = /(?:spent|paid|bought)\s+\$?([\d.]+)\s*(?:on|for)?\s*([a-z ]*)/.exec(lower);
    const type = m ? "spend" : null;
    if (!m) m = /(?:made|earned|got paid)\s+\$?([\d.]+)\s*(?:from|for)?\s*([a-z ]*)/.exec(lower);
    if (m) {
      calls.push({
        name: "log_transaction",
        args: {
          type: type ?? "make",
          amount: Number(m[1]),
          description: (m[2] || "").trim() || "something",
          ...(/savings/.test(lower) ? { account: 2 } : {}),
          ...(/yesterday/.test(lower) ? { date: isoDaysAgo(1) } : {}),
        },
      });
    }
  }

  return calls;
}

function sseToolCalls(res, calls) {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  send({ choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] });
  calls.forEach((call, index) => {
    // Split the arguments across two chunks so the parser has to accumulate,
    // exactly as the real provider streams them.
    const args = JSON.stringify(call.args);
    const half = Math.ceil(args.length / 2);
    send({
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              { id: `call_${index}`, index, type: "function", function: { name: call.name, arguments: args.slice(0, half) } },
            ],
          },
        },
      ],
    });
    send({
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index, function: { arguments: args.slice(half) } }] },
        },
      ],
    });
  });
  send({ choices: [{ index: 0, delta: {}, finish_reason: calls.length ? "tool_calls" : "stop" }] });
  res.write("data: [DONE]\n\n");
  res.end();
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/_stats") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
    return;
  }
  if (req.method === "POST" && req.url === "/_reset") {
    Object.assign(stats, {
      lastSystemPrompt: null,
      lastActionPrompt: null,
      lastAnswerMessageCount: 0,
      maxAnswerMessageCount: 0,
      answerCalls: 0,
      actionCalls: 0,
    });
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

    if (system.startsWith(ACTION_PREFIX)) {
      stats.actionCalls += 1;
      stats.lastActionPrompt = system;
      sseToolCalls(res, decideCalls(last));
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
      // A reply written the way models actually write them, for the renderer.
      const chunks = /formatting probe/i.test(last)
        ? [
            "* \u{1F354} **Food budget expenses:** **$3,012** (lunch included)\n",
            "* \u{1F6DE} **Other purchases:** **$65**\n\n",
            "Total logged spending is **$3,077** so far.",
          ]
        : ["Stub ", "answer ", "about ", "your ", "money."];
      for (const chunk of chunks) {
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
