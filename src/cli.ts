/**
 * Command line entry point.
 *
 *   pnpm ask "why is SOL up today"     one question, streamed answer
 *   pnpm brief                          full market brief in markdown
 *   pnpm ask --keyinfo                  show CMC plan and remaining credits
 */
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages";
import { runAgent, describeError } from "./agent/agent.js";
import { keyInfo } from "./cmc/endpoints.js";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

const BRIEF_PROMPT =
  "Write today's crypto market brief. Cover the market backdrop, the movers that matter, sector rotation, leverage and risk, and a short watch list with concrete numbers.";

async function ask(question: string): Promise<void> {
  const messages: BetaMessageParam[] = [{ role: "user", content: question }];
  let creditsUsed = 0;
  let calls = 0;
  await runAgent({
    messages,
    onEvent: (e) => {
      switch (e.type) {
        case "text":
          process.stdout.write(e.delta);
          break;
        case "tool_call":
          process.stderr.write(dim(`\n→ ${e.name} ${JSON.stringify(e.input)}\n`));
          break;
        case "tool_result":
          process.stderr.write(dim(`← ${e.name} ${e.ok ? "ok" : "FAILED"} ${e.ms}ms ${e.summary}\n`));
          break;
        case "api_call":
          calls += 1;
          creditsUsed += e.record.creditCount;
          process.stderr.write(dim(`  GET ${e.record.endpoint} ${e.record.httpStatus} ${e.record.cached ? "(cache)" : `${e.record.creditCount} credit(s), ${e.record.elapsedMs}ms`}\n`));
          break;
        case "done":
          process.stdout.write("\n");
          process.stderr.write(
            dim(`\n${calls} CMC call(s), ${creditsUsed} credit(s). Tokens in/out: ${e.usage.input_tokens}/${e.usage.output_tokens}, cache read: ${e.usage.cache_read_input_tokens ?? 0}\n`),
          );
          break;
        case "error":
          process.stderr.write(`\n${bold("Error:")} ${e.message}\n`);
          break;
      }
    },
  });
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;
  try {
    if (command === "ask" && rest[0] === "--keyinfo") {
      const info = await keyInfo();
      console.log(JSON.stringify(info, null, 2));
      return;
    }
    if (command === "ask") {
      const question = rest.join(" ").trim();
      if (!question) {
        console.error('Usage: pnpm ask "your question"');
        process.exit(1);
      }
      await ask(question);
      return;
    }
    if (command === "brief") {
      await ask(BRIEF_PROMPT);
      return;
    }
    console.error("Commands: ask <question> | brief | ask --keyinfo");
    process.exit(1);
  } catch (err) {
    console.error(describeError(err));
    process.exit(1);
  }
}

void main();
