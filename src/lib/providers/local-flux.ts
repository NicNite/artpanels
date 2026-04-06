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
    for (let index = 0; index < request.count; index++) {
      let res: Response;
      try {
        res = await fetch(`${FLUX_API_URL}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: request.prompt,
            negative_prompt: request.negativePrompt,
            width: request.width,
            height: request.height,
            seed: request.seed,
            ...request.params,
          }),
        });
      } catch (err) {
        yield {
          type: "error",
          index,
          message: err instanceof Error ? err.message : String(err),
        };
        continue;
      }

      if (!res.ok) {
        yield {
          type: "error",
          index,
          message: `API returned ${res.status}: ${res.statusText}`,
        };
        continue;
      }

      // Read SSE stream
      const body = res.body;
      if (!body) {
        yield { type: "error", index, message: "No response body" };
        continue;
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
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;

            if (trimmed.startsWith("data:")) {
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data) as Record<string, unknown>;

                if (parsed.type === "progress") {
                  yield {
                    type: "progress",
                    index,
                    step: parsed.step as number,
                    totalSteps: parsed.total_steps as number,
                  };
                } else if (parsed.type === "image") {
                  const base64 = parsed.data as string;
                  yield {
                    type: "image",
                    index,
                    data: Buffer.from(base64, "base64"),
                    seed: parsed.seed as number,
                  };
                } else if (parsed.type === "error") {
                  yield {
                    type: "error",
                    index,
                    message: (parsed.message as string) ?? "Unknown error",
                  };
                }
              } catch {
                // Skip unparseable SSE data lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    yield { type: "done" };
  },
};
