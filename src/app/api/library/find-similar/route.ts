import { NextResponse } from "next/server";
import { ensureInit } from "@/lib/init";
import { findSimilarClips } from "@/lib/services/library";
import type { Scene } from "@/lib/services/scene-split";

interface Body {
  scenes?: Scene[];
  minScore?: number;
  topPerScene?: number;
}

/**
 * Body: { scenes: Scene[], minScore?: number, topPerScene?: number }
 * Returns { matches: ClipMatch[] } — possibly empty if the library has no
 * relevant clips. Throws 400 when payload is missing scenes.
 */
export async function POST(req: Request) {
  ensureInit();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.scenes || !Array.isArray(body.scenes) || body.scenes.length === 0) {
    return NextResponse.json({ error: "scenes[] is required" }, { status: 400 });
  }

  try {
    const matches = await findSimilarClips(body.scenes, {
      minScore: body.minScore,
      topPerScene: body.topPerScene,
    });
    return NextResponse.json({ matches });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
