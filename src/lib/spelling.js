// UK/US spelling variant rules for quiz answer checking (lenient, broad)
const UK_US_RULES = [
  [/ise$/, "ize"], [/ize$/, "ise"],
  [/isation$/, "ization"], [/ization$/, "isation"],
  [/yse$/, "yze"], [/yze$/, "yse"],
  [/([bcdfghlmnpstvw])our$/, "$1or"], [/([bcdfghlmnpstvw])or$/, "$1our"],
  [/([a-z]{2})re$/, "$1er"], [/([a-z]{2})er$/, "$1re"],
  [/ogue$/, "og"], [/og$/, "ogue"],
  [/mme$/, "m"], [/([a-z]{3})m$/, "$1mme"],
  [/ence$/, "ense"], [/ense$/, "ence"],
  [/([a-z])lled$/, "$1led"], [/([a-z])led$/, "$1lled"],
  [/([a-z])lling$/, "$1ling"], [/([a-z])ling$/, "$1lling"],
  [/([a-z])ller$/, "$1ler"], [/([a-z])ler$/, "$1ller"],
  [/grey/, "gray"], [/gray/, "grey"],
  [/ae/, "e"],
  [/oeu/, "eu"],
];

export function isSpellingVariant(a, b) {
  if (a === b) return true;
  for (const [pat, rep] of UK_US_RULES) {
    if (pat.test(a) && a.replace(pat, rep) === b) return true;
    if (pat.test(b) && b.replace(pat, rep) === a) return true;
  }
  return false;
}

// -ise words where the ending is part of the root, NOT a UK suffix
const ISE_EXCEPTIONS = new Set([
  "advise", "advertise", "arise", "bruise", "capsize", "chaise",
  "chastise", "circumcise", "clockwise", "comprise", "compromise",
  "concise", "counterclockwise", "cruise", "demise", "despise", "devise",
  "disenfranchise", "disfranchise", "disguise", "downsize", "enfranchise",
  "enterprise", "equipoise", "excise", "exercise", "expertise", "fanwise",
  "franchise", "fundraise", "guise", "improvise", "incise", "likewise",
  "merchandise", "otherwise", "oversize", "paradise", "porpoise", "praise",
  "precise", "premise", "promise", "reprise", "revise", "rise", "size",
  "stepwise", "supervise", "sunrise", "surprise", "surmise", "televise",
  "tortoise", "treatise", "turquoise", "undersize", "valise", "wise",
  "appraise", "imprecise", "malaise", "mortise", "lengthwise",
]);

// Curated pairs for non-productive patterns: [UK, US]
const CURATED_PAIRS = [
  ["behaviour", "behavior"], ["colour", "color"], ["endeavour", "endeavor"],
  ["favour", "favor"], ["favourite", "favorite"], ["flavour", "flavor"],
  ["harbour", "harbor"], ["honour", "honor"], ["humour", "humor"],
  ["labour", "labor"], ["neighbour", "neighbor"], ["odour", "odor"],
  ["rigour", "rigor"], ["rumour", "rumor"], ["savour", "savor"],
  ["splendour", "splendor"], ["tumour", "tumor"], ["vapour", "vapor"],
  ["vigour", "vigor"],
  ["calibre", "caliber"], ["centre", "center"], ["fibre", "fiber"],
  ["litre", "liter"], ["lustre", "luster"], ["meagre", "meager"],
  ["metre", "meter"], ["sabre", "saber"], ["sombre", "somber"],
  ["spectre", "specter"], ["theatre", "theater"],
  ["analogue", "analog"], ["catalogue", "catalog"], ["dialogue", "dialog"],
  ["epilogue", "epilog"], ["monologue", "monolog"], ["prologue", "prolog"],
  ["defence", "defense"], ["licence", "license"],
  ["offence", "offense"], ["pretence", "pretense"],
  ["programme", "program"], ["gramme", "gram"], ["practise", "practice"],
  ["analyse", "analyze"], ["paralyse", "paralyze"],
  ["cancelled", "canceled"], ["cancelling", "canceling"],
  ["counselled", "counseled"], ["counselling", "counseling"],
  ["counsellor", "counselor"], ["labelled", "labeled"],
  ["labelling", "labeling"], ["levelled", "leveled"],
  ["levelling", "leveling"], ["modelled", "modeled"],
  ["modelling", "modeling"], ["panelled", "paneled"],
  ["quarrelled", "quarreled"], ["signalled", "signaled"],
  ["travelled", "traveled"], ["travelling", "traveling"],
  ["traveller", "traveler"],
  ["grey", "gray"], ["aluminium", "aluminum"], ["jewellery", "jewelry"],
  ["mould", "mold"], ["moult", "molt"], ["plough", "plow"],
  ["pyjamas", "pajamas"], ["sceptical", "skeptical"], ["cosy", "cozy"],
  ["moustache", "mustache"], ["draught", "draft"], ["kerb", "curb"],
  ["tyre", "tire"], ["aeroplane", "airplane"], ["cheque", "check"],
  ["manoeuvre", "maneuver"], ["marvellous", "marvelous"],
  ["doughnut", "donut"],
];

const VARIANT_MAP = {};
for (const [uk, us] of CURATED_PAIRS) {
  VARIANT_MAP[uk] = { variant: us, label: "美式" };
  VARIANT_MAP[us] = { variant: uk, label: "英式" };
}

/**
 * Get display-safe UK/US variant for a word.
 * Uses curated map + productive -ise/-ize rule.
 * Returns { variant, label } or null.
 */
export function getSpellingVariant(word) {
  const w = word.toLowerCase();

  const curated = VARIANT_MAP[w];
  if (curated) return curated;

  // Productive: -ise → -ize (UK→US)
  if (w.length >= 6 && w.endsWith("ise") && !ISE_EXCEPTIONS.has(w)) {
    return { variant: w.slice(0, -3) + "ize", label: "美式" };
  }
  if (w.length >= 6 && w.endsWith("ize") && !ISE_EXCEPTIONS.has(w.slice(0, -3) + "ise")) {
    return { variant: w.slice(0, -3) + "ise", label: "英式" };
  }
  // Productive: -isation → -ization
  if (w.endsWith("isation")) {
    return { variant: w.replace(/isation$/, "ization"), label: "美式" };
  }
  if (w.endsWith("ization")) {
    return { variant: w.replace(/ization$/, "isation"), label: "英式" };
  }

  return null;
}

/**
 * Split "program/programme" into ['program', 'programme'].
 * For words without /, returns [word].
 */
export function getWordForms(word) {
  if (!word) return [];
  return word.includes("/") ? word.split("/") : [word];
}

/**
 * Extract the first (short) form for audio playback.
 * "program/programme" → "program"
 */
export function toAudioWord(word) {
  if (!word) return "";
  const idx = word.indexOf("/");
  return idx >= 0 ? word.slice(0, idx) : word;
}

/**
 * Build the "short/long" combined form from a word.
 * Returns the combined form if variant exists, otherwise the original word.
 */
export function toCombinedWord(word) {
  const v = getSpellingVariant(word);
  if (!v) return word;
  const a = word, b = v.variant;
  return a.length <= b.length ? `${a}/${b}` : `${b}/${a}`;
}
