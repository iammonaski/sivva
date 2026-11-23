import { Fragment } from "react";

// Render study text without interpreting model-generated HTML or remote links.
function InlineText({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-muted px-1 text-sm">{part.slice(1, -1)}</code>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function StudyText({ text }: { text: string }) {
  return (
    <div className="max-w-prose space-y-4 break-words text-sm leading-7 text-foreground">
      {text.split(/\n\s*\n/).map((block, index) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
          return <ul key={index} className="list-disc space-y-1 pl-5">{lines.map((line, i) => <li key={i}><InlineText text={line.replace(/^\s*[-*]\s+/, "")} /></li>)}</ul>;
        }
        if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
          return <ol key={index} className="list-decimal space-y-1 pl-5">{lines.map((line, i) => <li key={i}><InlineText text={line.replace(/^\s*\d+\.\s+/, "")} /></li>)}</ol>;
        }
        return <div key={index}>{lines.map((line, i) => /^#{1,6}\s+/.test(line)
          ? <h3 key={i} className="mb-2 text-lg font-medium"><InlineText text={line.replace(/^#{1,6}\s+/, "")} /></h3>
          : <p key={i}><InlineText text={line} /></p>)}</div>;
      })}
    </div>
  );
}
