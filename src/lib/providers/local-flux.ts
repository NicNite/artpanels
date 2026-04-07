import type { ImageProvider, GenerateRequest, GenerateEvent } from "./types";

const FLUX_API_URL = process.env.FLUX_API_URL ?? "http://localhost:8000";

export const LocalFluxProvider: ImageProvider = {
  id: "local-flux",
  name: "Local FLUX.1 Schnell",

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${FLUX_API_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  async *generate(request: GenerateRequest): AsyncGenerator<GenerateEvent> {
    // Single request to FLUX server — it handles the batch internally
    const size = Math.max(request.width, request.height);
    let res: Response;
    try {
      res = await fetch(`${FLUX_API_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_prompt: request.prompt,
          count: request.count,
          size,
          steps: (request.params?.steps as number) ?? 4,
          seed: request.seed ?? null,
        }),
      });
    } catch (err) {
      yield {
        type: "error",
        index: 0,
        message: err instanceof Error ? err.message : String(err),
      };
      yield { type: "done" };
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      yield {
        type: "error",
        index: 0,
        message: `FLUX API returned ${res.status}: ${text}`,
      };
      yield { type: "done" };
      return;
    }

    const body = res.body;
    if (!body) {
      yield { type: "error", index: 0, message: "No response body" };
      yield { type: "done" };
      return;
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          // SSE format: "event: type\ndata: json" or "data: json"
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;

              if (parsed.type === "progress") {
                yield {
                  type: "progress",
                  index: parsed.index as number,
                  step: (parsed.step as number) ?? 0,
                  totalSteps: (parsed.total_steps as number) ?? 4,
                };
              } else if (parsed.type === "image") {
                yield {
                  type: "image",
                  index: parsed.index as number,
                  data: Buffer.from(parsed.image as string, "base64"),
                  seed: parsed.seed as number,
                };
              } else if (parsed.type === "error") {
                yield {
                  type: "error",
                  index: (parsed.index as number) ?? 0,
                  message: (parsed.message as string) ?? "Unknown error",
                };
              } else if (parsed.type === "done") {
                // Server signals done
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done" };
  },
};
