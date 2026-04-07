"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

type FluxState = {
  running: boolean;
  mode?: string;
  device?: string;
  pending?: boolean;
};

export function FluxStatus() {
  const [state, setState] = useState<FluxState>({ running: false });
  const [loading, setLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/flux");
      const data = await res.json();
      setState(data);
    } catch {
      setState({ running: false });
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  async function startServer(mock: boolean) {
    setLoading(true);
    setState((s) => ({ ...s, pending: true }));
    try {
      await fetch("/api/flux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", mock }),
      });
      // Poll for readiness
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch("/api/flux");
        const data = await res.json();
        if (data.running) {
          setState(data);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore
    }
    setLoading(false);
    checkStatus();
  }

  async function stopServer() {
    setLoading(true);
    try {
      await fetch("/api/flux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    checkStatus();
  }

  const dot = state.running
    ? "bg-green-500"
    : state.pending || loading
      ? "bg-yellow-500 animate-pulse"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs text-muted-foreground">
        {state.running
          ? `FLUX ${state.mode === "mock" ? "(mock)" : ""} on ${state.device ?? "?"}`
          : loading || state.pending
            ? "Starting..."
            : "FLUX offline"}
      </span>
      {state.running ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={stopServer}
          disabled={loading}
        >
          Stop
        </Button>
      ) : (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => startServer(false)}
            disabled={loading}
          >
            Start
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => startServer(true)}
            disabled={loading}
          >
            Mock
          </Button>
        </div>
      )}
    </div>
  );
}
