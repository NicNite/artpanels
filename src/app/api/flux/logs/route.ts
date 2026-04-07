import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const TOOLS_DIR = path.resolve(process.cwd(), "tools/flux-server");
const LOG_FILE = path.join(TOOLS_DIR, ".server.log");

/**
 * GET /api/flux/logs — Read the FLUX server log file
 * Returns the last N lines (default 50).
 */
export async function GET() {
  try {
    await stat(LOG_FILE);
    const content = await readFile(LOG_FILE, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    // Return last 100 lines
    const tail = lines.slice(-100);
    return NextResponse.json({ lines: tail });
  } catch {
    return NextResponse.json({ lines: [] });
  }
}
