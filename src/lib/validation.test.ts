import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  bannerSchema, capitalizeName, cartLineSchema, productSchema, toE164,
  toSubscriberDigits, validateEmail, validateName, validatePhone,
} from "./validation";

describe("telephone", () => {
  test("every familiar way of writing one normalises to a single form", () => {
    for (const raw of ["0991234567", "+380991234567", "380991234567", "099 123 45 67"]) {
      assert.equal(toSubscriberDigits(raw), "991234567", raw);
      assert.equal(toE164(raw), "+380991234567", raw);
    }
  });
  test("a short number is refused", () => assert.ok(validatePhone("09912")));
  test("an empty one gets its own message", () => assert.match(validatePhone("")!, /Enter a telephone/));
  test("a valid one is accepted", () => assert.equal(validatePhone("0991234567"), null));
});

describe("name", () => {
  test("Latin is accepted", () => assert.equal(validateName("Olena", "First name"), null));
  test("Cyrillic is accepted too", () => assert.equal(validateName("Олена", "First name"), null));
  test("digits are not", () => assert.match(validateName("Olena2", "First name")!, /letters/));
  test("one letter is too few", () => assert.match(validateName("O", "First name")!, /at least 2/));
  test("hyphen and apostrophe are allowed", () => {
    assert.equal(validateName("Anna-Maria", "First name"), null);
    assert.equal(validateName("D'Arcy", "First name"), null);
  });
  test("a capital follows every separator", () => {
    assert.equal(capitalizeName("olena maria"), "Olena Maria");
    assert.equal(capitalizeName("anna-maria"), "Anna-Maria");
  });
});

describe("email", () => {
  test("an ordinary one is accepted", () => assert.equal(validateEmail("olena@gmail.com"), null));
  test("two at-signs", () => assert.match(validateEmail("a@@b.com")!, /exactly one @/));
  test("no domain", () => assert.ok(validateEmail("olena@gmail")));
  test("Cyrillic is refused", () => assert.match(validateEmail("олена@gmail.com")!, /Latin characters only/));
});

describe("the basket as it crosses the client-server boundary", () => {
  test("only an id and a quantity are accepted", () => {
    const parsed = cartLineSchema.parse({ productId: "p1", quantity: 2 });
    assert.deepEqual(parsed, { productId: "p1", quantity: 2 });
  });

  test("unknown fields are dropped rather than breaking the parse", () => {
    // A basket sits in a browser across releases, so a field this schema has
    // never heard of must not empty it.
    const parsed = cartLineSchema.parse({ productId: "p1", quantity: 1, variantId: "legacy", price: 1 });
    assert.deepEqual(parsed, { productId: "p1", quantity: 1 });
    assert.ok(!("price" in parsed), "a price from the browser must not survive even as a stray field");
  });

  test("zero and fractions are refused", () => {
    assert.equal(cartLineSchema.safeParse({ productId: "p", quantity: 0 }).success, false);
    assert.equal(cartLineSchema.safeParse({ productId: "p", quantity: 1.5 }).success, false);
  });
});

describe("product", () => {
  const base = {
    slug: "krem", nameUk: "Крем", name: "Cream", tagline: "t", description: "d",
    usage: "u", specifications: [{ key: "k", value: "v" }], media: ["/a.webp"],
    categorySlug: "body", packaging: "p", price: 500, stock: 1,
  };

  test("a valid product saves", () => assert.equal(productSchema.safeParse(base).success, true));

  test("the promotional price must be LOWER than the ordinary one", () => {
    const r = productSchema.safeParse({ ...base, promotionalPrice: 600 });
    assert.equal(r.success, false);
    assert.match(r.error!.issues[0].message, /lower than/);
  });

  test("the same product twice in one set — refused", () => {
    const r = productSchema.safeParse({
      ...base, specifications: [],
      components: [{ productId: "a", quantity: 1 }, { productId: "a", quantity: 2 }],
    });
    assert.equal(r.success, false);
  });

  test("a set saves without specifications, an ordinary product does not", () => {
    assert.equal(productSchema.safeParse({ ...base, specifications: [] }).success, false);
    assert.equal(
      productSchema.safeParse({ ...base, specifications: [], components: [{ productId: "a", quantity: 1 }] }).success,
      true,
    );
  });

  test("a product with no photograph at all does not save", () => {
    assert.equal(productSchema.safeParse({ ...base, media: [] }).success, false);
  });

  test("video cannot come first", () => {
    // The catalogue card, the basket line and the checkout summary all render
    // media[0] through <Image>. A clip there is a broken image on the three
    // most visible screens in the shop.
    const r = productSchema.safeParse({ ...base, media: ["/a.mp4", "/b.webp"] });
    assert.equal(r.success, false);
    assert.match(r.error!.issues[0].message, /first item must be a photograph/);
  });

  test("video second is fine", () => {
    assert.equal(
      productSchema.safeParse({ ...base, media: ["/a.webp", "/b.mp4"] }).success,
      true,
    );
  });
});

describe("banner", () => {
  const base = {
    title: "YOUR DAILY RITUAL",
    images: ["/a.webp", "/b.webp", "/c.webp"],
    isActive: true,
  };

  test("a valid banner saves", () => {
    assert.equal(bannerSchema.safeParse(base).success, true);
  });

  // Three, always: a banner one photograph short renders an empty column
  // beside the two it has.
  test("fewer than three photographs will not save, and it says how many are missing", () => {
    const r = bannerSchema.safeParse({ ...base, images: ["/a.webp"] });
    assert.equal(r.success, false);
    assert.match(r.error!.issues[0].message, /add 2 more/);
  });

  test("more than three will not save either", () => {
    const r = bannerSchema.safeParse({
      ...base,
      images: ["/a.webp", "/b.webp", "/c.webp", "/d.webp"],
    });
    assert.equal(r.success, false);
  });

  test("video in a banner is refused — the hero renders through <Image>", () => {
    const r = bannerSchema.safeParse({ ...base, images: ["/a.webp", "/b.mp4", "/c.webp"] });
    assert.equal(r.success, false);
    assert.match(r.error!.issues[0].message, /photographs only/);
  });

  test("a heading may span several lines — a manager types them", () => {
    const r = bannerSchema.safeParse({ ...base, title: "YOUR DAILY\nBEAUTY RITUAL" });
    assert.equal(r.success, true);
    assert.equal(r.data!.title, "YOUR DAILY\nBEAUTY RITUAL");
  });

  // A browser on Windows sends \r\n. Without normalising, the \r would stay in
  // the text and count towards the length limit.
  test("Windows line breaks collapse to \\n", () => {
    const r = bannerSchema.safeParse({ ...base, title: "FIRST\r\nSECOND\rTHIRD" });
    assert.equal(r.success, true);
    assert.equal(r.data!.title, "FIRST\nSECOND\nTHIRD");
  });

  test("more than four lines is refused — the heading bursts its box", () => {
    const r = bannerSchema.safeParse({ ...base, title: ["A", "B", "C", "D", "E"].join("\n") });
    assert.equal(r.success, false);
    assert.match(r.error!.issues[0].message, /four at most/);
  });

  test("a button with a label but no address — refused", () => {
    const r = bannerSchema.safeParse({ ...base, ctaLabel: "BUY" });
    assert.equal(r.success, false);
    assert.match(r.error!.issues[0].message, /where the button leads/);
  });

  test("a link out of the shop is refused", () => {
    const r = bannerSchema.safeParse({
      ...base,
      ctaLabel: "BUY",
      ctaHref: "https://example.com",
    });
    assert.equal(r.success, false);
  });
});

describe("a banner button cannot lead out of the shop", () => {
  const banner = (ctaHref: string) =>
    bannerSchema.safeParse({
      title: "Heading",
      images: ["/uploads/a.webp", "/uploads/b.webp", "/uploads/c.webp"],
      ctaLabel: "Open",
      ctaHref,
      isActive: true,
    });

  test("our own addresses pass", () => {
    assert.equal(banner("/catalog").success, true);
    assert.equal(banner("/catalog?category=face").success, true);
  });

  test("a protocol-relative address is refused", () => {
    // `//evil.com` means "same scheme, different host": the home page hero
    // would lead to a copy of the shop.
    assert.equal(banner("//evil.com").success, false);
    assert.equal(banner("//evil.com/path").success, false);
    assert.equal(banner("///evil.com").success, false);
  });

  test("an absolute address is refused", () => {
    assert.equal(banner("https://evil.com").success, false);
  });

  test("dot segments lead nowhere — the browser folds them back into our own domain", () => {
    assert.equal(banner("/..//evil.com").success, true);
    assert.equal(new URL("/..//evil.com", "https://velur.example").origin, "https://velur.example");
  });

  /*
   * There is one definition (`internalHref`) and this test watches that the
   * second button is wired to it. Written out twice instead, a fix reaches one
   * copy and not the other, and the hole stays open with the suite still green.
   */
  const secondary = (ctaSecondaryHref: string) =>
    bannerSchema.safeParse({
      title: "Heading",
      images: ["/uploads/a.webp", "/uploads/b.webp", "/uploads/c.webp"],
      ctaSecondaryLabel: "About the brand",
      ctaSecondaryHref,
      isActive: true,
    });

  test("the second button lives by the same rule as the first", () => {
    assert.equal(secondary("/about").success, true);
    assert.equal(secondary("//evil.com").success, false);
    assert.equal(secondary("https://evil.com").success, false);
  });
});
