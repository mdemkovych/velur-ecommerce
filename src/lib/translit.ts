/**
 * Latin to Cyrillic for Nova Poshta directory queries.
 *
 * NOTE: (§5.4)
 */

/** Reverse of the national romanisation, longest sequences first. */
const DIGRAPHS: [string, string][] = [
  ["shch", "щ"],
  ["zgh", "зг"],
  ["kh", "х"],
  ["ts", "ц"],
  ["zh", "ж"],
  ["ch", "ч"],
  ["sh", "ш"],
];

/** Iotated vowels romanise as `y`+vowel at the start of a word, `i`+vowel inside one. */
const WORD_INITIAL: [string, string][] = [
  ["ya", "я"],
  ["ye", "є"],
  ["yi", "ї"],
  ["yu", "ю"],
];

const INSIDE_WORD: [string, string][] = [
  ["ia", "я"],
  ["ie", "є"],
  ["iu", "ю"],
];

const LETTERS: Record<string, string> = {
  a: "а", b: "б", v: "в", h: "г", g: "ґ", d: "д", e: "е", z: "з",
  y: "и", i: "і", j: "й", k: "к", l: "л", m: "м", n: "н", o: "о",
  p: "п", r: "р", s: "с", t: "т", u: "у", f: "ф", c: "ц", q: "к",
  w: "в", x: "кс",
};

const VOWELS = new Set(["а", "е", "и", "і", "о", "у", "я", "ю", "є", "ї"]);

/** NOTE: (§5.4) Names no rule reaches: a soft sign mid-word, or a foreign spelling. */
const EXONYMS: Record<string, string> = {
  lviv: "Львів",
  lvov: "Львів",
  kiev: "Київ",
  odessa: "Одеса",
  kharkov: "Харків",
  nikolaev: "Миколаїв",
  dnepropetrovsk: "Дніпро",
  dnepr: "Дніпро",
  khmelnytskyi: "Хмельницький",
  khmelnitsky: "Хмельницький",
  kropyvnytskyi: "Кропивницький",
  kirovograd: "Кропивницький",
  kirovohrad: "Кропивницький",
  "kamianets-podilskyi": "Кам'янець-Подільський",
  "bila-tserkva": "Біла Церква",
};

const HAS_LATIN = /[a-z]/i;

function isWordStart(source: string, at: number): boolean {
  return at === 0 || !/[a-z]/i.test(source[at - 1]!);
}

/**
 * Converts a Latin query into the Cyrillic the directory holds.
 *
 * @param query What the shopper typed, in either alphabet.
 * @returns The Cyrillic form of a Latin query; the query unchanged otherwise.
 */
export function toDirectoryQuery(query: string): string {
  const trimmed = query.trim();
  if (!HAS_LATIN.test(trimmed)) return trimmed;

  const exonym = EXONYMS[trimmed.toLowerCase()];
  if (exonym) return exonym;

  const source = trimmed.toLowerCase();
  let out = "";

  for (let i = 0; i < source.length; ) {
    // NOTE: (§5.4) A soft sign before the final consonant, which no prefix match recovers.
    if (i === source.length - 3 && source.startsWith("tsk", i)) {
      out += "цьк";
      i += 3;
      continue;
    }
    if (i === source.length - 2 && source.startsWith("sk", i)) {
      out += "ськ";
      i += 2;
      continue;
    }

    // NOTE: (§5.4) Ambiguous inside a word, so read as one letter only where it ends one.
    const pairs = isWordStart(source, i)
      ? WORD_INITIAL
      : INSIDE_WORD.filter(([latin]) => !/[a-z]/i.test(source[i + latin.length] ?? ""));
    const iotated = pairs.find(([latin]) => source.startsWith(latin, i));
    if (iotated) {
      out += iotated[1];
      i += iotated[0].length;
      continue;
    }

    const digraph = DIGRAPHS.find(([latin]) => source.startsWith(latin, i));
    if (digraph) {
      out += digraph[1];
      i += digraph[0].length;
      continue;
    }

    const char = source[i]!;
    // NOTE: (§5.4) `i` after a vowel is «ї» — the whole of "Kyiv" → «Київ».
    if (char === "i" && VOWELS.has(out.at(-1) ?? "")) {
      out += "ї";
      i += 1;
      continue;
    }

    out += LETTERS[char] ?? char;
    i += 1;
  }

  return out;
}
