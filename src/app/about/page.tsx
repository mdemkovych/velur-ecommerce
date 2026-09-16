import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import closing01 from "../../../public/about-closing-01.jpg";
import closing02 from "../../../public/about-closing-02.jpg";
import Overline from "@/components/Overline";
import RitualGallery from "./RitualGallery";

export const metadata: Metadata = {
  title: "About the brand",
  description:
    "The story of VELUR, a Ukrainian premium cosmetics brand: its origin, philosophy and mission.",
  alternates: { canonical: "/about" },
};

/**
 * Editorial brand philosophy, origin and product craftsmanship showcase page.
 */
export default function AboutPage() {

  return (
    <main className="flex-1 bg-white text-black">
      {/* The title sits on the photograph; a 3:2 frame is too short to hold it on a phone,
          so the crop tightens to the centre of the group as the screen narrows. */}
      <section className="border-b border-black">
        <div className="relative aspect-[3/4] w-full sm:aspect-[4/3] lg:aspect-[2/1]">
          <Image
            src="/about-cover.jpg"
            alt="A linen-covered table by sunlit windows, unlabelled vessels along it"
            fill
            priority
            className="object-cover object-[center_42%]"
            sizes="100vw"
          />
          {/* Explicit stops rather than from/via/to: the title sits over the pale
              tablecloth, so the dark band has to reach where the text is and clear
              the middle. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.52)_20%,rgba(0,0,0,0.12)_42%,rgba(0,0,0,0.12)_56%,rgba(0,0,0,0.5)_80%,rgba(0,0,0,0.8)_100%)]" />
          <div className="absolute inset-0 flex flex-col items-center justify-between px-6 py-8 text-center sm:py-10 lg:py-14">
            <h1 className="font-[family-name:var(--font-cormorant)] max-w-3xl text-3xl font-bold uppercase leading-[1.02] tracking-tight text-balance text-white min-[380px]:text-4xl sm:text-5xl lg:text-6xl">
              VELUR IS MORE
              <br />
              THAN <span className="italic font-normal">COSMETICS</span>
            </h1>
            <div className="flex flex-col items-center gap-5 sm:gap-6">
              <p className="font-[family-name:var(--font-tenor-sans)] max-w-md text-sm leading-relaxed tracking-wide text-balance text-white/90 sm:max-w-lg sm:text-base lg:text-lg">
                It is a state. It is a feeling.
                <br />
                It is about a woman who chooses herself every day.
              </p>
              <a
                href="https://instagram.com/velur.brand"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 border border-white/55 px-5 font-montserrat text-[10px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:border-white hover:bg-white hover:text-black sm:text-[11px] sm:tracking-[0.2em]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0"
                  aria-hidden
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                <span>@velur.brand</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Brand story */}
      <section className="border-b border-black">
        <div className="max-w-7xl mx-auto px-6 py-14 lg:py-20">
          {/* From tablet up the portrait stretches to the story's height instead of
              holding a square: at 768 the text runs taller and left the photo stranded. */}
          <div className="grid grid-cols-1 items-center gap-8 tablet:grid-cols-2 tablet:items-stretch tablet:gap-10 lg:gap-16">
            {/* Stacked, the frame is wider than the file, so the crop is pinned to the
                bottom: the bench and her hands are there, and what is lost is the shelving
                above. From tablet up the text sets the height instead. */}
            <div className="relative aspect-[9/8] w-full overflow-hidden tablet:aspect-auto tablet:h-full tablet:min-h-[420px]">
              <Image
                src="/about-ritual-01.jpg"
                alt="A woman in a linen apron filling a jar at a workshop bench"
                fill
                className="object-cover object-bottom tablet:object-center"
                sizes="(max-width: 700px) 100vw, 46vw"
              />
            </div>

            {/* Where the brand came from */}
            <div className="flex flex-col tablet:h-full tablet:justify-between">
              <div>
                <h2 className="font-[family-name:var(--font-cormorant)] mb-6 text-3xl font-bold uppercase lg:text-4xl">
                  THE ORIGIN
                </h2>
                {/* Justified only from lg: the column is 580px there and both edges
                    line up; narrower than that the same setting opens rivers. */}
                <div className="space-y-5 text-sm leading-[1.75] text-ink-2 font-medium lg:hyphens-auto lg:text-justify">
                  <p>
                    The brand grew from a simple but strong idea: to prove that a
                    Ukrainian product can be premium, desirable and competitive
                    in the world.
                  </p>
                  <p>
                    It began in a small workshop, with formulations reworked until the
                    texture was right rather than merely acceptable — the difference a
                    hand notices before a label explains it.
                  </p>
                  <p>
                    Confidence begins with details: the touch on the skin, the scent,
                    the feeling of looking precious.
                  </p>
                </div>
              </div>

              <p className="font-[family-name:var(--font-cormorant)] mt-8 text-2xl font-semibold text-black italic tablet:mt-10">
                That is how VELUR was born.
              </p>
            </div>

          </div>

          {/* Philosophy */}
          <div className="mt-12 border-t border-black pt-12 lg:mt-16 lg:pt-16">
            {/* Once the section outgrows the prose's own max-w-3xl the rest of it stands
                empty, so the photographs take that column rather than the text widening
                into it, which would run the lines past a readable measure. From 820px
                it holds two rows that are swiped sideways; at lg it is wide enough
                for all six at once. */}
            <div className="grid grid-cols-1 gap-10 min-[820px]:grid-cols-[minmax(0,1fr)_18rem] min-[820px]:items-start min-[820px]:gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
              {/* Centred until the photographs come alongside: left-aligned with nothing
                  to its right, the block leans on one edge of an empty section. */}
              <div className="max-w-3xl text-center min-[820px]:text-left">
                <h2 className="font-[family-name:var(--font-cormorant)] text-3xl lg:text-4xl font-bold uppercase mb-8">
                  A RITUAL OF SELF-LOVE
                </h2>
                <div className="space-y-5 text-sm leading-[1.75] text-ink-2 font-medium">
                  <p>
                    We believe body care is not a chore.
                    <br />
                    It is a daily ritual of loving yourself.
                  </p>
                  <p>Every VELUR product is made to:</p>
                  {/* Centred, the list is bracketed by two short rules rather than full-width
                      ones, which are what separate sections everywhere else on the site. They
                      sit close, or the pair reads as two dividers rather than as a bracket. */}
                  <ul className="space-y-3 mt-3 before:mx-auto before:mb-3 before:block before:h-px before:w-10 before:bg-black after:mx-auto after:mt-3 after:block after:h-px after:w-10 after:bg-black min-[820px]:mt-5 min-[820px]:border-l min-[820px]:border-black min-[820px]:pl-5 min-[820px]:before:hidden min-[820px]:after:hidden">
                    <li className="font-semibold text-black">Bring out natural beauty</li>
                    <li className="font-semibold text-black">Give the feeling of something precious</li>
                    <li className="font-semibold text-black">
                      Turn an ordinary day into a small luxury
                    </li>
                  </ul>
                  <p className="font-[family-name:var(--font-cormorant)] text-2xl italic text-black font-semibold pt-4">
                    We do not simply make a cream or a gel.
                    <br />
                    We make a feeling.
                  </p>
                </div>
              </div>

              <RitualGallery />
            </div>
          </div>
        </div>
      </section>

      {/* Mission — Black Section */}
      <section className="bg-black text-white border-b border-black">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
          {/* ink-3 is the tertiary grey for white ground; on black it falls under the
              contrast floor, so light-on-dark text uses neutral-300 as the cards do. */}
          <h2 className="font-[family-name:var(--font-cormorant)] text-4xl lg:text-5xl font-bold uppercase text-white mb-16 max-w-3xl leading-tight">
            TO SHOW UKRAINE AND THE WORLD
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="border-t border-neutral-700 pt-8">
              <p className="text-white text-xs font-extrabold tracking-[0.3em] uppercase mb-4">01</p>
              <p className="text-sm leading-[1.8] text-neutral-300 font-medium">
                We can make a premium product that stands beside
                the best-known brands in the world.
              </p>
            </div>
            <div className="border-t border-neutral-700 pt-8">
              <p className="text-white text-xs font-extrabold tracking-[0.3em] uppercase mb-4">02</p>
              <p className="text-sm leading-[1.8] text-neutral-300 font-medium">
                We can set trends rather than follow them. A new era of the
                Ukrainian beauty industry begins here.
              </p>
            </div>
            <div className="border-t border-neutral-700 pt-8">
              <p className="text-white text-xs font-extrabold tracking-[0.3em] uppercase mb-4">03</p>
              <p className="text-sm leading-[1.8] text-neutral-300 font-medium">
                We can stand level with the best-known brands in the
                world. VELUR is the proof.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About the product */}
      <section className="border-b border-black">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <div className="max-w-2xl mx-auto text-center">
            <Overline>UKRAINIAN MANUFACTURING</Overline>
            <h2 className="font-[family-name:var(--font-cormorant)] text-3xl lg:text-4xl font-bold uppercase mb-8">
              A BALANCE OF EFFICACY, AESTHETICS AND FEELING
            </h2>
            <div className="space-y-6 text-sm leading-[1.9] text-ink-2">
              <p>We pay attention to everything:</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div className="border border-black p-8 text-left">
                <p className="font-[family-name:var(--font-cormorant)] text-xl font-bold uppercase mb-2 text-black">TEXTURES</p>
                <p className="text-xs leading-[1.8] text-ink-2 font-medium">
                  That you want to feel again and again
                </p>
              </div>
              <div className="border border-black p-8 text-left">
                <p className="font-[family-name:var(--font-cormorant)] text-xl font-bold uppercase mb-2 text-black">SCENTS</p>
                <p className="text-xs leading-[1.8] text-ink-2 font-medium">
                  That linger and set a mood
                </p>
              </div>
              <div className="border border-black p-8 text-left">
                <p className="font-[family-name:var(--font-cormorant)] text-xl font-bold uppercase mb-2 text-black">DESIGN</p>
                <p className="text-xs leading-[1.8] text-ink-2 font-medium">
                  That looks like a refined piece of the interior
                </p>
              </div>
            </div>
          </div>

          <p className="font-[family-name:var(--font-cormorant)] mt-12 text-center text-xl font-semibold text-black italic sm:text-2xl lg:mt-16">
            Cosmetics that do not merely stand in the bathroom — they adorn it.
          </p>
        </div>
      </section>

      {/* For whom — High-Contrast Architectural Grid */}
      <section className="border-b border-black">
        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 lg:mb-16 gap-6">
            <div>
              <h2 className="font-[family-name:var(--font-cormorant)] text-4xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight leading-[1.05]">
                FOR THE WOMAN
                <br />
                <span className="italic font-normal">WHO CHOOSES HERSELF</span>
              </h2>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-balance text-ink-2 max-w-xs">
              Four principles that shape the philosophy of care
            </p>
          </div>

          {/* Two per row on a phone, which leaves a cell 157px wide: the padding and
              both type sizes step down with it, or a 24px heading would not fit and
              the body would run at ten characters to the line. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {/* Card 01 */}
            <div className="border border-black p-5 sm:p-8 flex flex-col min-h-60 sm:min-h-72 bg-white hover:bg-black hover:text-white transition-colors duration-300 group">
              <span className="text-xs font-extrabold tracking-[0.3em] uppercase text-ink-3 group-hover:text-neutral-300">01</span>
              {/* The block is offset from the top rather than pushed to the bottom, and
                  the heading reserves two lines whether it needs them or not: that is
                  what puts every title on one level across the row. */}
              <div className="mt-8 sm:mt-10">
                <h3 className="font-[family-name:var(--font-cormorant)] text-lg sm:text-2xl font-bold uppercase tracking-wide leading-[1.15] min-h-[2.3em] mb-2 sm:mb-3">CHOOSES QUALITY</h3>
                <p className="text-[11px] sm:text-xs leading-[1.7] sm:leading-[1.8] text-ink-2 group-hover:text-neutral-300 font-medium">
                  Makes no compromises and picks faultless formulations and selected ingredients.
                </p>
              </div>
            </div>

            {/* Card 02 */}
            <div className="border border-black p-5 sm:p-8 flex flex-col min-h-60 sm:min-h-72 bg-white hover:bg-black hover:text-white transition-colors duration-300 group">
              <span className="text-xs font-extrabold tracking-[0.3em] uppercase text-ink-3 group-hover:text-neutral-300">02</span>
              <div className="mt-8 sm:mt-10">
                <h3 className="font-[family-name:var(--font-cormorant)] text-lg sm:text-2xl font-bold uppercase tracking-wide leading-[1.15] min-h-[2.3em] mb-2 sm:mb-3">VALUES AESTHETICS</h3>
                <p className="text-[11px] sm:text-xs leading-[1.7] sm:leading-[1.8] text-ink-2 group-hover:text-neutral-300 font-medium">
                  Holds every detail to matter: the texture under the hand, a refined scent, a minimal design.
                </p>
              </div>
            </div>

            {/* Card 03 */}
            <div className="border border-black p-5 sm:p-8 flex flex-col min-h-60 sm:min-h-72 bg-white hover:bg-black hover:text-white transition-colors duration-300 group">
              <span className="text-xs font-extrabold tracking-[0.3em] uppercase text-ink-3 group-hover:text-neutral-300">03</span>
              <div className="mt-8 sm:mt-10">
                <h3 className="font-[family-name:var(--font-cormorant)] text-lg sm:text-2xl font-bold uppercase tracking-wide leading-[1.15] min-h-[2.3em] mb-2 sm:mb-3">FEELS THE LUXURY</h3>
                <p className="text-[11px] sm:text-xs leading-[1.7] sm:leading-[1.8] text-ink-2 group-hover:text-neutral-300 font-medium">
                  Knows her worth and wants daily care to give confidence and the feeling of something precious.
                </p>
              </div>
            </div>

            {/* Card 04 — Signature Dark Accent Box */}
            <div className="border border-black p-5 sm:p-8 flex flex-col min-h-60 sm:min-h-72 bg-black text-white">
              <span className="text-xs font-extrabold tracking-[0.3em] uppercase text-neutral-300">04</span>
              <div className="mt-8 sm:mt-10">
                <h3 className="font-[family-name:var(--font-cormorant)] text-lg sm:text-2xl font-bold uppercase tracking-wide leading-[1.15] min-h-[2.3em] mb-2 sm:mb-3 text-white">LOVES HERSELF</h3>
                <p className="text-[11px] sm:text-xs leading-[1.7] sm:leading-[1.8] text-neutral-300 font-medium">
                  Knows that real beauty and inner strength begin with a daily ritual of self-love.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The closing lines sit on a diptych, full-bleed. The band is shaped to the number
          of cells rather than the cells to the band — 4:5 for the phone's single photograph,
          8:5 for two — so a cell is always the 4:5 the files already are. */}
      <section>
        {/* On a desktop the band stops exactly one footer band short of the fold,
            the same measurement --hero-peek makes on the home page: the band must stop short of the fold on
            any screen, so the footer shows and the page reads as continuing. */}
        <div className="relative aspect-[4/5] w-full tablet:aspect-[8/5] lg:aspect-auto lg:h-[calc(100svh_-_var(--header-h)_-_85px)] lg:min-h-[460px]">
          {/* A phone gets the second photograph alone: half of a 375px screen is too
              little to read a face in. The first is lazy and boxless below tablet, so
              it is never fetched there. */}
          {/* Imported rather than named by path so the build can inline a blurred
              placeholder: each half then has something to show from the first paint,
              and the two arriving milliseconds apart stops reading as one loading
              before the other. */}
          <div className="absolute inset-0 grid grid-cols-1 tablet:grid-cols-2">
            <div className="relative hidden tablet:block">
              <Image
                src={closing01}
                placeholder="blur"
                alt="A woman in profile by a window, backlit"
                fill
                className="object-cover object-[center_25%]"
                sizes="50vw"
              />
            </div>
            <div className="relative">
              <Image
                src={closing02}
                placeholder="blur"
                alt="A woman looking into the camera in warm daylight"
                fill
                className="object-cover object-[center_25%]"
                sizes="(max-width: 700px) 100vw, 50vw"
              />
            </div>
          </div>
          {/* Nothing sits between the photographs and the type — no panel, no veil — so the
              shadow is the whole of the contrast. Kept weak and close to the letters: widened
              or darkened, it stops reading as contrast and starts reading as a smudge. */}
          <div className="on-dark absolute inset-0 flex items-center justify-center px-5 text-center sm:px-8">
            {/* The type keeps the band's exact centre and the button hangs off its
                bottom edge, so adding the button did not shift the lines upwards. */}
            <div className="relative">
              <div className="font-[family-name:var(--font-cormorant)] text-[22px] leading-[1.25] font-bold tracking-tight text-white uppercase [text-shadow:0_1px_3px_rgba(0,0,0,0.38),0_2px_16px_rgba(0,0,0,0.42)] min-[390px]:text-[23px] min-[430px]:text-[26px] sm:text-4xl lg:text-5xl">
                <p className="mb-2 sm:mb-3">YOU CAN BE MANY THINGS.</p>
                <p className="mb-2 sm:mb-3">
                  BUT ALWAYS — <span className="font-normal italic">YOURSELF</span>.
                </p>
                <p>
                  AND ALWAYS — <span className="font-normal italic">AT YOUR BEST</span>.
                </p>
              </div>
              {/* Solid white rather than the cover's outline: with no veil left under it,
                  an outlined button on a white dress has nothing to sit against. */}
              <Link
                href="/catalog"
                className="absolute top-full left-1/2 mt-7 inline-flex min-h-11 -translate-x-1/2 items-center border border-white bg-white px-7 font-montserrat text-[10px] font-semibold tracking-[0.18em] whitespace-nowrap text-black uppercase transition-colors hover:bg-transparent hover:text-white sm:mt-9 sm:px-9 sm:text-[11px] sm:tracking-[0.2em]"
              >
                Choose yours
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
