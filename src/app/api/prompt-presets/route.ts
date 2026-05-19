import { NextResponse } from "next/server";
import { ensureInit } from "@/lib/init";
import { listPromptPresets, createPromptPreset } from "@/lib/prompts";

export async function GET() {
  ensureInit();
  return NextResponse.json(listPromptPresets());
}

export async function POST(req: Request) {
  ensureInit();
  let body: {
    name?: string;
    content?: string;
    animation_motion?: string | null;
    image_prompt?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  const content = body.content ?? "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!content.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 });

  try {
    const id = createPromptPreset(name, content, body.animation_motion, body.image_prompt);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // SQLite UNIQUE constraint on name
    if (msg.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: `A preset named "${name}" already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
