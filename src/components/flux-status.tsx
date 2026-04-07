"use client";

import { useState, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
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
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const [panelSize, setPanelSize] = useState({ width: 520, height: 320 });

  // Resize handling — drag bottom-left corner to resize
  const startResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = panelSize.width;
    const startH = panelSize.height;

    function onMouseMove(ev: globalThis.MouseEvent) {
      // Left handle: dragging left increases width, dragging down increases height
      setPanelSize({
        width: Math.max(320, startW - (ev.clientX - startX)),
        height: Math.max(160, startH + (ev.clientY - startY)),
      });
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [panelSize]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/flux");
      const data = await res.json();
      setState(data);
      return data;
    } catch {
      setState({ running: false });
      return { running: false };
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/flux/logs");
      const data = await res.json();
      if (Array.isArray(data.lines)) {
        setLogs(data.lines);
      }
    } catch {
      // ignore
    }
  }, []);

  // Status polling
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Fast polling during startup: check status + logs every 2s
  useEffect(() => {
    if (!loading) {
      startTimeRef.current = null;
      return;
    }
    const interval = setInterval(async () => {
      const data = await checkStatus();
      await fetchLogs();
      if (startTimeRef.current) {
        setElapsedSecs(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
      if (data.running) {
        setLoading(false);
        startTimeRef.current = null;
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [loading, checkStatus, fetchLogs]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function startServer(mock: boolean) {
    setLoading(true);
    setElapsedSecs(0);
    startTimeRef.current = Date.now();
    setShowLogs(true);
    setLogs(mock ? ["Starting mock server..."] : ["Starting FLUX server (model may take 1-2 min to load)..."]);

    try {
      await fetch("/api/flux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", mock }),
      });
    } catch {
      setLogs((prev) => [...prev, "Failed to send start command."]);
      setLoading(false);
    }
  }

  async function stopServer() {
    setLoading(true);
    setLogs((prev) => [...prev, "Stopping server..."]);
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
    setShowLogs(false);
    checkStatus();
  }

  const dot = state.running
    ? "bg-green-500"
    : loading
      ? "bg-yellow-500 animate-pulse"
      : "bg-red-500";

  const statusText = state.running
    ? `FLUX ${state.mode === "mock" ? "(mock)" : ""} on ${state.device ?? "?"}`
    : loading
      ? `Starting... ${elapsedSecs}s`
      : "FLUX offline";

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <button
          onClick={() => { setShowLogs(!showLogs); if (!showLogs) fetchLogs(); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {statusText}
        </button>
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
        ) : !loading ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => startServer(false)}
            >
              Start
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => startServer(true)}
            >
              Mock
            </Button>
          </div>
        ) : null}
      </div>

      {showLogs && (
        <div
          className="absolute right-0 top-full mt-2 z-50 rounded-lg border bg-background shadow-lg flex flex-col"
          style={{ width: panelSize.width, height: panelSize.height, minWidth: 320, minHeight: 160 }}
        >
          {/* Title bar — drag handle for moving could be added later */}
          <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
            <span className="text-xs font-medium">FLUX Server Log</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={fetchLogs}>
                Refresh
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowLogs(false)}>
                Close
              </Button>
            </div>
          </div>
          {/* Log content */}
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed bg-black text-green-400 rounded-b-lg">
            {logs.length === 0 ? (
              <span className="text-muted-foreground">No logs yet. Start the server to see output.</span>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
          {/* Resize handle */}
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize"
            onMouseDown={startResize}
          >
            <svg viewBox="0 0 16 16" className="w-full h-full text-muted-foreground/50">
              <path d="M14 16L16 14M10 16L16 10M6 16L16 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
