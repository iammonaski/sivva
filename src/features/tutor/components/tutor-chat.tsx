"use client";

import { useEffect, useRef, useState } from "react";
import { ChatCircleText, PaperPlaneRight, Plus, Stop } from "@phosphor-icons/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StudyText } from "@/components/shared/study-text";
import { MAX_QUESTION_CHARACTERS, tutorRequestSchema } from "../schemas/tutor";
import { readTutorStream } from "../client/read-tutor-stream";

type Conversation = inferRouterOutputs<AppRouter>["tutor"]["getConversation"];

export function TutorChat({ materialId }: { materialId: string }) {
  const utils = trpc.useUtils();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<{ question: string; text: string } | null>(null);
  const [snapshot, setSnapshot] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [reloading, setReloading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const list = trpc.tutor.listConversations.useQuery({ materialId });
  const history = trpc.tutor.getConversation.useQuery(
    { materialId, conversationId: conversationId ?? "" },
    { enabled: conversationId !== null },
  );
  const saved = snapshot?.id === conversationId && (!history.data || snapshot.messages.length > history.data.messages.length)
    ? snapshot : history.data;
  const messages = conversationId ? saved?.messages ?? [] : [];
  const historyPending = conversationId !== null && history.isLoading && !saved;
  const full = messages.length >= 100;

  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => {
    // Only follow the stream if the reader was already close to the bottom.
    const element = bottom.current;
    const container = element?.parentElement;
    if (container && container.scrollHeight - container.scrollTop - container.clientHeight < 180) {
      container.scrollTop = container.scrollHeight;
    }
  }, [pending?.text, messages.length]);

  async function reloadHistory() {
    setReloading(true);
    try {
      await utils.tutor.listConversations.fetch({ materialId }, { staleTime: 0 });
      if (conversationId) await utils.tutor.getConversation.fetch({ materialId, conversationId }, { staleTime: 0 });
      setSnapshot(null);
      setNeedsReload(false);
      setError(null);
    } catch {
      setError("Conversation history could not be refreshed. Try again before sending another question.");
    } finally { setReloading(false); }
  }

  function selectConversation(id: string | null) {
    if (controller.current || reloading) return;
    setConversationId(id);
    setSnapshot(null);
    setError(null);
    setNeedsReload(false);
    setQuestion("");
  }

  async function sendQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (controller.current || historyPending || history.error || needsReload || full) return;
    const input = tutorRequestSchema.safeParse({ question, ...(conversationId ? { conversationId } : {}) });
    if (!input.success) { setError("Enter a question of 1–2,000 characters."); return; }
    const requestController = new AbortController();
    controller.current = requestController;
    setError(null);
    setPending({ question: input.data.question, text: "" });
    try {
      const response = await fetch(`/api/materials/${encodeURIComponent(materialId)}/tutor/stream`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data), signal: requestController.signal,
      });
      const result = await readTutorStream({ response, signal: requestController.signal,
        onDelta: (text) => setPending((current) => current ? { ...current, text: current.text + text } : null),
      });
      // Keep the confirmed exchange visible while the persisted history refetches.
      setSnapshot({ id: result.conversationId, title: saved?.title ?? input.data.question.slice(0, 100), updatedAt: new Date(), messages: [
        ...messages,
        { id: crypto.randomUUID(), role: "user", content: input.data.question, createdAt: new Date().toISOString() },
        result.message,
      ] });
      setConversationId(result.conversationId);
      setQuestion("");
      void utils.tutor.listConversations.invalidate({ materialId });
      void utils.tutor.getConversation.invalidate({ materialId, conversationId: result.conversationId });
    } catch (cause) {
      if (requestController.signal.aborted) {
        setError("Answer stopped. Partial text was discarded. Reload history to check whether a completed answer was saved.");
      } else {
        setError(`${cause instanceof Error ? cause.message : "The tutor request failed."} Partial text was discarded. Reload history before retrying.`);
      }
      setNeedsReload(true);
    } finally {
      setPending(null);
      controller.current = null;
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-medium">Ask about your document</h2>
          <p className="mt-1 text-sm text-muted-foreground">Answers use your notes, with source excerpts you can check.</p></div>
        <Button variant="outline" disabled={pending !== null || reloading} onClick={() => selectConversation(null)}><Plus aria-hidden="true" />New conversation</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside aria-label="Saved conversations" className="rounded-lg border border-border bg-surface p-3">
          <h3 className="mb-3 text-sm font-medium">Conversations</h3>
          {list.isLoading ? <div aria-busy="true" aria-label="Fetching conversations" className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            : list.error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{list.error.message}</p><Button variant="outline" onClick={() => void list.refetch()}>Retry</Button></div>
            : list.data?.length ? <ul className="max-h-48 space-y-1 overflow-y-auto lg:max-h-[480px]">{list.data.map((conversation) => <li key={conversation.id}>
              <button type="button" aria-current={conversationId === conversation.id ? "true" : undefined} disabled={pending !== null || reloading}
                onClick={() => selectConversation(conversation.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${conversationId === conversation.id ? "bg-accent text-primary" : "hover:bg-muted"}`}>
                <span className="line-clamp-2 break-words">{conversation.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{new Date(conversation.updatedAt).toLocaleDateString()}</span>
              </button>
            </li>)}</ul> : <p className="text-sm text-muted-foreground">Your completed conversations will appear here.</p>}
        </aside>
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="max-h-[560px] min-h-64 space-y-6 overflow-y-auto p-4 sm:p-6" aria-label="Conversation messages">
            {historyPending ? <div aria-busy="true" aria-label="Fetching conversation" className="space-y-4"><Skeleton className="ml-auto h-12 w-2/3" /><Skeleton className="h-32 w-5/6" /></div>
              : history.error && conversationId ? <p role="alert" className="text-sm text-destructive">{history.error.message}</p>
              : messages.length === 0 && !pending ? <div className="py-10 text-center"><ChatCircleText size={32} className="mx-auto text-primary" aria-hidden="true" /><h3 className="mt-3 font-medium">Make sense of your notes</h3><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Ask about a concept, compare ideas, or follow up on a topic from this document.</p></div>
              : messages.map((message) => <article key={message.id} className={message.role === "user" ? "ml-auto max-w-prose rounded-lg bg-accent p-4" : "space-y-3"}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{message.role === "user" ? "You" : "Sivva"}</p>
                <StudyText text={message.content} />
                {message.role === "assistant" && <Badge className={message.grounding === "unsupported" ? "bg-warning/10" : "bg-accent text-primary"}>{message.grounding === "unsupported" ? "Not supported by this document" : "Grounded in your document"}</Badge>}
                {!!message.citations?.length && <div className="flex flex-wrap items-start gap-2" aria-label="Answer sources">{message.citations.map((citation) => <details key={citation.sourceId} className="max-w-full rounded-lg border border-border bg-background p-2">
                  <summary className="cursor-pointer text-xs font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">[{citation.sourceId}] {citation.pageNumber ? `Page ${citation.pageNumber}` : citation.sectionHeading ?? "Source excerpt"}</summary>
                  <div className="mt-3 max-w-prose space-y-2 text-sm">{citation.sectionHeading && <p className="font-medium">{citation.sectionHeading}</p>}<p className="whitespace-pre-wrap break-words leading-6">{citation.text}</p>
                    <a className="inline-block py-1 text-primary underline focus-visible:ring-2 focus-visible:ring-ring" target="_blank" rel="noopener noreferrer" href={`/api/materials/${encodeURIComponent(materialId)}/file${citation.pageNumber ? `#page=${citation.pageNumber}` : ""}`}>Open original{citation.pageNumber ? ` at page ${citation.pageNumber}` : ""}</a>
                  </div>
                </details>)}</div>}
              </article>)}
            {pending && <>
              <article className="ml-auto max-w-prose rounded-lg bg-accent p-4"><p className="mb-2 text-xs text-muted-foreground">You</p><StudyText text={pending.question} /></article>
              <article aria-busy="true" className="space-y-3"><p className="text-xs text-muted-foreground">Sivva · Draft answer, not yet verified</p>{pending.text ? <StudyText text={pending.text} /> : <><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-3/4" /></>}</article>
            </>}
            <div ref={bottom} />
          </div>
          <form onSubmit={(event) => void sendQuestion(event)} className="space-y-3 border-t border-border p-4">
            {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p>{needsReload && <p className="text-muted-foreground">For a new conversation, check the conversation list after reloading; an answer may have saved before the connection ended.</p>}</div>}
            {(needsReload || history.error) && <Button type="button" variant="outline" disabled={reloading || pending !== null} onClick={() => void reloadHistory()}>{reloading ? "Refreshing history…" : "Reload history"}</Button>}
            {full && <p role="status" className="text-sm text-muted-foreground">This conversation is full. Start a new conversation to keep studying.</p>}
            <label htmlFor={`question-${materialId}`} className="block text-sm font-medium">Your question</label>
            <textarea id={`question-${materialId}`} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={MAX_QUESTION_CHARACTERS} rows={3} disabled={pending !== null}
              placeholder="What would you like to understand?" aria-describedby={`question-help-${materialId}`}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
            <div className="flex flex-wrap items-center justify-between gap-3"><p id={`question-help-${materialId}`} className="text-xs text-muted-foreground">{question.length.toLocaleString()} / 2,000 characters</p>
              {pending ? <Button type="button" variant="outline" onClick={() => controller.current?.abort()}><Stop aria-hidden="true" />Stop answer</Button>
                : <Button type="submit" disabled={!question.trim() || historyPending || !!history.error || needsReload || reloading || full}><PaperPlaneRight aria-hidden="true" />Ask question</Button>}
            </div>
          </form>
        </div>
      </div>
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">{pending ? "Answer is streaming. It will be verified before saving." : "AI can make mistakes. Check important details against the source excerpts."}</p>
    </section>
  );
}
