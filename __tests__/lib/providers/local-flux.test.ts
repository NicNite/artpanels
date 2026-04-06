import { describe, it, expect, vi, afterEach } from "vitest";
import { LocalFluxProvider } from "@/lib/providers/local-flux";
import type { GenerateEvent } from "@/lib/providers/types";

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper: collect all events from the generator
async function collectEvents(
  gen: AsyncGenerator<GenerateEvent>
): Promise<GenerateEvent[]> {
  const events: GenerateEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

// Helper: build a minimal SSE Response from an array of data payloads
function makeSseResponse(lines: string[]): Response {
  const body = lines.join("\n") + "\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("LocalFluxProvider identity", () => {
  it("has id 'local-flux'", () => {
    expect(LocalFluxProvider.id).toBe("local-flux");
  });

  it("has name 'Local FLUX.1 Schnell'", () => {
    expect(LocalFluxProvider.name).toBe("Local FLUX.1 Schnell");
  });
});

describe("LocalFluxProvider.healthCheck", () => {
  it("returns false when fetch throws", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await LocalFluxProvider.healthCheck()).toBe(false);
  });

  it("returns true when fetch returns 200", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 200 })
    );
    expect(await LocalFluxProvider.healthCheck()).toBe(true);
  });

  it("returns false when fetch returns non-200", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 503 })
    );
    expect(await LocalFluxProvider.healthCheck()).toBe(false);
  });
});

describe("LocalFluxProvider.generate", () => {
  const baseRequest = {
    prompt: "a sunset over the ocean",
    count: 1,
    width: 512,
    height: 512,
  };

  it("yields an error event when the API returns non-200", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" })
    );

    const events = await collectEvents(LocalFluxProvider.generate(baseRequest));

    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(errorEvents[0]).toMatchObject({ type: "error", index: 0 });
  });

  it("always yields a 'done' event at the end (non-200 response)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("bad", { status: 500, statusText: "Internal Server Error" })
    );

    const events = await collectEvents(LocalFluxProvider.generate(baseRequest));
    const last = events[events.length - 1];
    expect(last).toEqual({ type: "done" });
  });

  it("always yields a 'done' event at the end (fetch throws)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network error"));

    const events = await collectEvents(LocalFluxProvider.generate(baseRequest));
    const last = events[events.length - 1];
    expect(last).toEqual({ type: "done" });
  });

  it("yields progress and image events from SSE stream", async () => {
    const imageBase64 = Buffer.from("fake-image-bytes").toString("base64");

    const sseLines = [
      `data: ${JSON.stringify({ type: "progress", step: 1, total_steps: 4 })}`,
      `data: ${JSON.stringify({ type: "progress", step: 4, total_steps: 4 })}`,
      `data: ${JSON.stringify({ type: "image", data: imageBase64, seed: 42 })}`,
    ];

    vi.spyOn(global, "fetch").mockResolvedValueOnce(makeSseResponse(sseLines));

    const events = await collectEvents(LocalFluxProvider.generate(baseRequest));

    const progressEvents = events.filter((e) => e.type === "progress");
    expect(progressEvents.length).toBe(2);
    expect(progressEvents[0]).toMatchObject({ type: "progress", index: 0, step: 1, totalSteps: 4 });

    const imageEvents = events.filter((e) => e.type === "image");
    expect(imageEvents.length).toBe(1);
    const imgEvent = imageEvents[0];
    expect(imgEvent.type).toBe("image");
    if (imgEvent.type === "image") {
      expect(imgEvent.index).toBe(0);
      expect(imgEvent.seed).toBe(42);
      expect(imgEvent.data).toEqual(Buffer.from("fake-image-bytes"));
    }

    // done is last
    expect(events[events.length - 1]).toEqual({ type: "done" });
  });

  it("yields error event from SSE stream error message", async () => {
    const sseLines = [
      `data: ${JSON.stringify({ type: "error", message: "out of memory" })}`,
    ];

    vi.spyOn(global, "fetch").mockResolvedValueOnce(makeSseResponse(sseLines));

    const events = await collectEvents(LocalFluxProvider.generate(baseRequest));

    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0]).toMatchObject({
      type: "error",
      index: 0,
      message: "out of memory",
    });

    expect(events[events.length - 1]).toEqual({ type: "done" });
  });

  it("handles count > 1 with multiple fetch calls", async () => {
    const imageBase64 = Buffer.from("img").toString("base64");
    const sseLine = `data: ${JSON.stringify({ type: "image", data: imageBase64, seed: 1 })}`;

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(makeSseResponse([sseLine]))
      .mockResolvedValueOnce(makeSseResponse([sseLine]));

    const events = await collectEvents(
      LocalFluxProvider.generate({ ...baseRequest, count: 2 })
    );

    const imageEvents = events.filter((e) => e.type === "image");
    expect(imageEvents.length).toBe(2);
    if (imageEvents[0].type === "image") expect(imageEvents[0].index).toBe(0);
    if (imageEvents[1].type === "image") expect(imageEvents[1].index).toBe(1);

    expect(events[events.length - 1]).toEqual({ type: "done" });
  });
});
