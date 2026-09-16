import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isVideoUrl, posterFor } from "./media";

describe("a clip's poster is derived from the clip's own URL", () => {
  test("the video extension becomes .poster.webp", () => {
    assert.equal(
      posterFor("https://x.supabase.co/storage/v1/object/public/product-media/1786_ab.mp4"),
      "https://x.supabase.co/storage/v1/object/public/product-media/1786_ab.poster.webp",
    );
  });

  test("works for the older files under /uploads too", () => {
    assert.equal(posterFor("/uploads/demo-clip.mp4"), "/uploads/demo-clip.poster.webp");
  });

  test("a query string stays where it was", () => {
    assert.equal(posterFor("/uploads/a.mp4?v=2"), "/uploads/a.poster.webp?v=2");
  });

  test("a photograph has no poster — only video needs one", () => {
    assert.equal(posterFor("/uploads/photo.webp"), undefined);
    assert.equal(posterFor(undefined), undefined);
    assert.equal(posterFor(""), undefined);
  });

  test("what counts as video and what gets a poster are the same set", () => {
    // If these two ever disagree, the gallery asks for the poster of a
    // photograph, or leaves a clip without one.
    for (const url of ["/a.mp4", "/a.webm", "/a.mov", "/a.webp", "/a.png"]) {
      assert.equal(Boolean(posterFor(url)), isVideoUrl(url), url);
    }
  });
});
