import type { ReactNode } from "react";

// Models write markdown whether or not you ask them to: bold labels, bullet
// lists, the occasional heading. Rendered as plain text those asterisks show
// up literally, which is what "**Food budget:** **$3,012**" looked like.
//
// This is a deliberately small renderer rather than a markdown library: the
// grammar below is all the models actually emit in a chat reply, and building
// React nodes (never HTML strings) means model output can't inject markup.
// Anything outside the grammar is left exactly as written rather than guessed
// at.

// **bold**, *italic*, _italic_, `code`
const INLINE = /(\*\*[\s\S]+?\*\*|`[^`\n]+?`|\*[^*\n]+?\*|_[^_\n]+?_)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "" && part !== undefined)
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`;
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={key} className="font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={key}
            className="rounded px-1 py-0.5 text-[0.9em]"
            style={{ backgroundColor: "color-mix(in srgb, var(--gus-navy) 10%, transparent)" }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (
        part.length > 2 &&
        ((part.startsWith("*") && part.endsWith("*")) ||
          (part.startsWith("_") && part.endsWith("_")))
      ) {
        return (
          <em key={key} className="italic">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={key}>{part}</span>;
    });
}

type Block =
  | { kind: "para"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] };

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    const bullet = /^\s*[*\-•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];

    if (bullet) {
      if (last?.kind === "list" && !last.ordered) last.items.push(bullet[1]);
      else blocks.push({ kind: "list", ordered: false, items: [bullet[1]] });
      continue;
    }
    if (numbered) {
      if (last?.kind === "list" && last.ordered) last.items.push(numbered[1]);
      else blocks.push({ kind: "list", ordered: true, items: [numbered[1]] });
      continue;
    }
    // A heading in a chat bubble is just an emphasised line.
    if (heading) {
      blocks.push({ kind: "para", lines: [`**${heading[1]}**`] });
      continue;
    }
    if (line.trim() === "") {
      // Blank line closes whatever was open.
      if (last?.kind === "para" && last.lines.length > 0) blocks.push({ kind: "para", lines: [] });
      continue;
    }
    if (last?.kind === "para") last.lines.push(line);
    else blocks.push({ kind: "para", lines: [line] });
  }

  return blocks.filter((b) => (b.kind === "para" ? b.lines.length > 0 : b.items.length > 0));
}

export default function Markdown({ text }: { text: string }) {
  const blocks = toBlocks(text);

  return (
    <div className="space-y-2">
      {blocks.map((block, i) =>
        block.kind === "list" ? (
          <ul key={i} className="space-y-1 pl-1">
            {block.items.map((item, j) => (
              <li key={j} className="flex gap-2">
                <span aria-hidden="true" className="shrink-0 text-ink-2">
                  {block.ordered ? `${j + 1}.` : "•"}
                </span>
                <span className="min-w-0">{renderInline(item, `${i}-${j}`)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderInline(line, `${i}-${j}`)}
              </span>
            ))}
          </p>
        )
      )}
    </div>
  );
}
