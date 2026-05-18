import { NextResponse } from "next/server";

/**
 * DEPRECATED in Conveyer Grok.
 *
 * The original "smart reassemble" route was inherited from Conveyer Isabell,
 * which had a Ken-Burns-on-images flow (images + audio → final.mp4).
 * Conveyer Grok is video-only — every scene is a Grok clip in `animations/`,
 * not a still image — so the old reassemble logic (refill missing images via
 * generateImage) does not apply.
 *
 * A Conveyer-Grok-aware reassemble would refill missing `animations/scene_N.mp4`
 * via `animateScene` from `img2vid.ts`. That's a TODO — for now, the route is
 * disabled to prevent users from clicking a button that produces broken output.
 *
 * If you reach this endpoint, either:
 *   1. Just re-run the pipeline from /  (the library can reuse existing clips).
 *   2. Wait for Conveyer-Grok-aware reassemble to be implemented.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Reassemble is disabled in Conveyer Grok. Re-run the pipeline from /  — the library reuse will skip scenes whose clips already exist on Drive.",
    },
    { status: 410 }
  );
}
