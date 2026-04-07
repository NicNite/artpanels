import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const FLUX_API_URL = process.env.FLUX_API_URL || "http://localhost:8000";
const TOOLS_DIR = path.resolve(process.cwd(), "tools/flux-server");

/**
 * GET /api/flux — Check FLUX server status
 */
export async function GET() {
  try {
    const res = await fetch(`${FLUX_API_URL}/api/status`, {
      signal: AbortSignal.timeout(500),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ running: true, ...data });
    }
    return NextResponse.json({ running: false });
  } catch {
    return NextResponse.json({ running: false });
  }
}

/**
 * POST /api/flux — Start or stop the FLUX server
 * Body: { action: "start" | "stop", mock?: boolean }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const action: string = body.action;

  if (action === "start") {
    const mock = body.mock === true;
    const script = path.join(TOOLS_DIR, "start.sh");
    const args = mock ? ["--mock"] : [];

    return new Promise<NextResponse>((resolve) => {
      const child = spawn("bash", [script, ...args], {
        cwd: TOOLS_DIR,
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      // Give it a moment, then check status
      setTimeout(async () => {
        try {
          const res = await fetch(`${FLUX_API_URL}/health`, {
            signal: AbortSignal.timeout(2000),
          });
          if (res.ok) {
            resolve(NextResponse.json({ started: true, mock }));
            return;
          }
        } catch {
          // Not ready yet — that's OK for GPU mode (model loading takes time)
        }
        resolve(
          NextResponse.json({
            started: true,
            pending: true,
            message: mock
              ? "Starting mock server..."
              : "Starting FLUX server (model loading may take up to 2 minutes)...",
          })
        );
      }, 3000);
    });
  }

  if (action === "stop") {
    const script = path.join(TOOLS_DIR, "stop.sh");
    return new Promise<NextResponse>((resolve) => {
      const child = spawn("bash", [script], {
        cwd: TOOLS_DIR,
        stdio: "ignore",
      });
      child.on("close", () => {
        resolve(NextResponse.json({ stopped: true }));
      });
      child.on("error", (err) => {
        resolve(
          NextResponse.json(
            { stopped: false, error: String(err) },
            { status: 500 }
          )
        );
      });
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
