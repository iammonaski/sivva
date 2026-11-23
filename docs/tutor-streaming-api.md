# Tutor streaming API

Stage 6 provides the backend. Stage 7 adds the tabbed workspace and browser stream consumer, using the shared event schema below.

## Request

`POST /api/materials/{materialId}/tutor/stream`

- Better Auth session cookie required.
- `Origin` must equal the configured application's origin.
- `Content-Type: application/json`.
- Material must be owned by the session user and have status `ready`.

```json
{
  "question": "How does photosynthesis convert light into chemical energy?",
  "conversationId": "optional-existing-conversation-uuid"
}
```

Omit `conversationId` to start a new conversation. If supplied, it must belong to both this material and the session user. Only the question and optional conversation ID are accepted; the client cannot submit history, owner IDs, or citations.

The trimmed question is 1–2,000 characters. The body is capped at 16 KiB. Material and conversation IDs must be UUIDs.

## Streaming response

Successful setup returns `200` and `Content-Type: text/event-stream; charset=utf-8`, with private/no-store/no-transform caching. POST streaming uses `fetch` and a response reader, not browser `EventSource`.

Each event has a named `event:` field and JSON `data:` containing the same `type`. Frames end with a blank line. A network read is not necessarily a whole frame; clients must buffer incomplete frames and use a streaming UTF-8 decoder.

```text
event: delta
data: {"type":"delta","text":"Photosynthesis converts light into chemical energy [S1]."}

```

Append delta text to a **provisional** assistant message. Gemini produces structured JSON; the adapter incrementally decodes only its answer string, excluding thought parts. The complete JSON is validated after a normal provider finish.

A successful exchange ends with:

```text
event: done
data: {"type":"done","conversationId":"conversation-uuid","message":{"id":"message-uuid","role":"assistant","content":"Photosynthesis converts light into chemical energy [S1].","citations":[{"sourceId":"S1","chunkId":"chunk-uuid","pageNumber":1,"text":"Photosynthesis converts light into chemical energy."}],"grounding":"source-grounded","createdAt":"2026-11-23T00:00:00.000Z"}}

```

The symbolic IDs above illustrate the fields; actual IDs are UUIDs. `done` is sent **only after** the complete user/assistant exchange is saved atomically. Use its message as the authoritative final answer, remember its conversation ID, and invalidate the relevant history queries.

Citation IDs `[S1]`–`[S6]` are local to each answer. The server resolves them only against that turn's retrieved chunks. Citation chips must use the returned page/heading metadata, not parse page numbers from model text. DOCX citations contain `sectionHeading` when available and omit `pageNumber`; sources without either still have a chunk ID and source excerpt.

If the material does not support an answer, the final message has `grounding: "unsupported"`, no citations, and an explicit insufficient-information response. There is no external-knowledge fallback. No lexical matches skip Gemini entirely.

### Errors

Before streaming starts, failures return JSON `{ "error": "safe message", "code": "..." }` and an appropriate status:

| Status | Meaning |
|---|---|
| 400 | Invalid ID, question, JSON, or oversized request |
| 401 | No authenticated session |
| 403 | Wrong/missing Origin |
| 404 | Missing or foreign material/conversation |
| 409 | Material not ready, conversation full, or stale concurrent history |
| 408 | Cancelled request |
| 502 | Gemini connection, timeout, blocked/incomplete output, or invalid citations |
| 500 | Persistence/unexpected failure |

Session/origin rejection responses contain the error message without a code. Once streaming begins, HTTP status cannot change. Instead:

```text
event: error
data: {"type":"error","code":"INVALID_OUTPUT","error":"The tutor returned invalid source references. Please try again."}

```

On `error`, **discard provisional text** and show the safe error. EOF without `done` also means the client must not treat the provisional response as complete. Cancelling the reader/request aborts Gemini and prevents an unfinished exchange from being saved. A disconnect after the completed transaction may still leave a saved exchange; reload history before retrying if completion acknowledgement was lost.

A `CONFLICT` indicates another turn updated the same conversation while the answer was generated. Reload history before retrying. Locks are held only for the save, never across Gemini calls; a stale turn cannot overwrite a previously saved exchange. Deleting the material cascades history and causes an in-flight save to fail rather than resurrect records.

## History queries

Use the protected tRPC endpoints:

- `tutor.listConversations({ materialId })` → conversation ID/title/update time, newest first.
- `tutor.getConversation({ materialId, conversationId })` → metadata and complete persisted messages.

The backend accepts up to 50 completed exchanges per conversation. Start a new one when full. Questions and at most three recent exchanges (up to 12,000 history characters) go into the prompt. History helps resolve follow-ups but is never evidence. Retrieval also includes the last user question to resolve short follow-ups.

## Retrieval and provider limits

- Parameterized PostgreSQL English full-text search using the existing GIN index. Query lexemes are OR-matched and ranked, with stable chunk-order ties.
- Up to six whole chunks, at most 18,000 source-content characters; genuine page/section boundaries are preserved.
- Gemini timeout: 120 seconds. Output: 8,192 tokens, 16,000 answer characters. Provider SSE response cap: 1 MB.
- No SDK, embeddings, new database migration, workers, retry loop, or fabricated answers.

Automated tests cover framing, actual deltas, Unicode/escape boundaries, thought filtering, timeout/cancellation, citations, ownership, full-text retrieval, persistence, concurrent saves, and deletion. They use test doubles in `/mocks`. They do **not** establish live Gemini grounding quality or retrieval quality for real course notes; those remain acceptance checks after the Ask UI is integrated.
