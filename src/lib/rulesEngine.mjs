import { explainDieNotation, findRelevantRules } from "./rulesAssistant.mjs";
import { STRUCTURED_RULE_FACTS } from "../data/rules/structuredFacts.mjs";

const FOLLOW_UP_PATTERN = /^(and\b|also\b|but\b|then\b|(?:okay|ok)(?:,?\s+(?:and|but))?\b|what about\b|how about\b|what if\b|does (?:it|that|this)\b|do (?:they|those)\b|can (?:it|that|they)\b|could (?:it|that|they)\b|is (?:it|that|this)\b|are (?:they|those)\b|where (?:does|do|is|are)\b|why (?:does|do|is|are)\b)/i;
const CARD_FACT_PATTERN = /\b(cost|price|worth|value|rp|victory|vp|points?|health|hp|defen[cs]e|attack|dice|die|kind|type|class|category|zone|habitat|slot|fit|place|weakness|ability|abilities|effect|printed|do|does|work)\b/i;
const SPECIFIC_CARD_FACT_PATTERN = /\b(cost|price|worth|value|rp|victory|vp|points?|health|hp|school density|density|defen[cs]e|attack|dice|die|kind|type|class|category|zone|habitat|slot|fit|place|play|weakness|ability|abilities|effect|printed|stage|version|which)\b/i;
const OUT_OF_SCOPE_PATTERN = /\b(artist|artwork|author|creator|designed the (?:logo|website)|designer|logo|music|programmer|website)\b/i;
const UNDOCUMENTED_TERM_PATTERN = /\b(pressure markers?|armor (?:value|points?)|energy crystals?|reserve deck|evolution points?|critical hits?|speed stat|mana|initiative markers?|shield counters?|bonus lane)\b/i;
const INTENT_ROUTES = [
  {
    question: /^(?=.*\bcorals?\b)(?=.*\bstun(?:s|ned|ning)?\b)(?=.*\b(?:how|become|became|get|got|cause|make|cards?|effects?)\b).*$/i,
    title: /^How a Coral becomes Stunned$/i,
  },
  {
    question: /^(?=.*\btoxic\b)(?=.*\b(?:defeat|beat|remove|discard|kill|attack|counter|handle|get past|deal with|play around|fight|survive)\b).*$/i,
    title: /^Playing around Toxic$/i,
  },
  {
    question: /^(?=.*\b(?:creature schools?|bait ?balls?)\b)(?=.*\b(?:protect|defend|safe|survive|alive|strategy|help|what can i do|keeps? attacking)\w*\b).*$/i,
    title: /^Protecting Creature Schools from attacks$/i,
  },
  {
    question: /^(?=.*\bcorals?\b)(?=.*\b(?:protect|defend|safe|survive|prevent|reduce|repair|heal)\w*\b)(?=.*\b(?:attack|attacks|damage|destroy|opponent|best|how|ways?)\b).*$/i,
    title: /^Protecting Coral from attacks$/i,
  },
  {
    question: /^(?!.*\b(?:cloak|cloaked|transparency|transparent)\b)(?=.*\b(?:attack|on play|abilit(?:y|ies))\b)(?=.*\b(?:target\w*|attacked|hit|affect\w*)\b)(?=.*\b(?:how|what|which|who|where|whether|can|allowed|legal|look)\b).*$/i,
    title: /^Reading targets on attacks and abilities$/i,
  },
  {
    question: /^(?:(?=.*\breef\b)(?=.*\bdeep\b)|(?=.*\breef\b)(?=.*\boceanic\b)|(?=.*\boceanic\b)(?=.*\bdeep\b))(?=.*\b(?:fish|predator|apex|invertebrate|filter feeder)\b)(?=.*\b(?:difference|different|compare|versus|vs\.?|same)\b).*$/i,
    title: /^Comparing Reef, Oceanic, and Deep creatures$/i,
  },
  {
    question: /^(?!.*\b(?:which deck|what deck|where\b.*\bgo|belong|shuffl)\b)(?=.*\bdeck\b)(?=.*\b(?:good|strong|consistent|balanced|reliable|competitive|advice|tips?)\b).*$/i,
    title: /^Building a consistent deck$/i,
  },
  {
    question: /^(?!.*\b(?:which deck|what deck|where\b.*\bgo|belong|shuffl\w*)\b)(?:.*\b(?:help|show|walk)\b.*\b(?:build|make|create|construct|start)\b.*\bdeck\b|.*\b(?:build|make|create|construct|start)\b(?:\s+\w+){0,5}\s+deck\b|.*\bput together\b(?:\s+\w+){0,5}\s+deck\b|.*\bdeck[ -]?building (?:guide|help)\b).*$/i,
    title: /^A step-by-step deck-building guide$/i,
  },
  {
    question: /(?=.*\b(?:players?|player count)\b)(?=.*\b(?:recommended|vp target|quick game|full game|how many)\b)/i,
    title: /^How many players can play and recommended VP targets$/i,
  },
  {
    question: /(?=.*\bfoundation deck\b)(?=.*\bpals deck\b)(?=.*\b(?:route|routing|which|belong|go)\b)/i,
    title: /^Foundation and Pals deck routing$/i,
  },
  {
    question: /(?=.*\b(?:foundation deck|pals deck)\b)(?=.*\b(?:coral|creature schools?|regular creatures?|support cards?|habitat cards?)\b)(?=.*\b(?:belong|contains?|go|kept|which deck)\b)/i,
    title: /^Foundation and Pals deck routing$/i,
  },
  {
    question: /(?=.*\bcoral cards?\b)(?=.*\b(?:build my deck|which deck|where.*go)\b)/i,
    title: /^Foundation and Pals deck routing$/i,
  },
  {
    question: /\b(?:setup round|walk me through (?:the )?setup)\b/i,
    title: /^Setup round$/i,
  },
  {
    question: /(?=.*\bround\b)(?=.*\bturn\b)(?=.*\b(?:structure|order|work)\b)/i,
    title: /^Round and turn structure$/i,
  },
  {
    question: /(?=.*\bchoose\b)(?=.*\bdraw\b)/i,
    title: /^Choose and draw$/i,
  },
  {
    question: /(?=.*\bbuild\b)(?=.*\b(?:paid actions?|phase|may i do)\b)/i,
    title: /^Build phase and paid actions$/i,
  },
  {
    question: /(?=.*\bhabitat\b)(?=.*\bclass\b)(?=.*\b(?:matching|slots?|work)\b)/i,
    title: /^Habitat and class matching for Reef Fish and Deep slots$/i,
  },
  {
    question: /(?=.*\b(?:foundation|coral)\b)(?=.*\b(?:destroyed|dies|die)\b)/i,
    title: /^Foundation destruction and what happens when Coral dies$/i,
  },
  {
    question: /\bwhat do d4,? d6,? d8,? d10,? d12,? (?:and )?d20 mean\b/i,
    title: /^What D4, D6, D8, D10, D12, and D20 mean$/i,
  },
  {
    question: /\b(?:repeated attacks?|attacks? repeat)\b.*\b(?:resolve|resolved|work|share|roll|target)\b/i,
    title: /^Repeated attacks$/i,
  },
  {
    question: /\b(?:those|these|the) (?:(?:two|three|four|repeated)\s+)?attacks?\b.*\b(?:separately|same (?:card|creature|target)|exact same|each)\b|\beach of (?:those|these) attacks?\b/i,
    title: /^Repeated attacks$/i,
  },
  {
    question: /(?=.*\b(?:creature schools?|bait ?balls?)\b)(?=.*\b(?:attack\w*|damage|defen[cs]e)\b)/i,
    title: /^Creature Schools and bait balls$/i,
  },
  {
    question: /(?=.*\bschool density\b)(?=.*\b(?:requirements?|reductions?|work|for)\b)/i,
    title: /^School Density requirements$/i,
  },
  {
    question: /(?=.*\boceanic apex\b)(?=.*\b(?:sacrifice|sacrificed|additional cost|qualify|two (?:copies|fish)|same card name)\b)/i,
    title: /^Oceanic Apex additional cost$/i,
  },
  {
    question: /(?=.*\bsupport cards?\b)(?=.*\b(?:after|resolves?|where|go)\b)/i,
    title: /^Support cards$/i,
  },
  {
    question: /(?=.*\bdeep creatures?\b)(?=.*\babyss\b)(?=.*\b(?:darkness shroud|relate|work)\b)/i,
    title: /^Deep creatures and Abyss$/i,
  },
  {
    question: /(?=.*\bhabitat cards?\b)(?=.*\b(?:physical copies|independent cards?|behave)\b)/i,
    title: /^Habitats$/i,
  },
  {
    question: /(?=.*\bcontinuous health bonus\b)(?=.*\b(?:leaves play|removed|ends)\b)/i,
    title: /^Continuous health bonuses$/i,
  },
  {
    question: /(?=.*\b(?:moving|moves?)\b)(?=.*\b(?:once-per-turn|action cooldown)\b)/i,
    title: /^Action timing and cooldowns$/i,
  },
  {
    question: /(?=.*\blost zone\b)(?=.*\b(?:when|may|move|moved|send|sent|go|goes|enter|destroy|destroyed|discard|discarding|apex|filter feeder)\b)/i,
    title: /^Lost Zone$/i,
  },
  {
    question: /(?=.*\b(?:four steps|turn order)\b)(?=.*\b(?:list|explain|what|steps?)\b)/i,
    title: /^Turn order$/i,
  },
  {
    question: /^(?!.*\battack\s+(?:box|indicator|count|symbol|icon)\b)(?=.*\battack(?:s|ing)?\b)(?=.*\b(?:how do i attack|how do attacks work|how does attacking work|walk me through|steps? to|procedure|start to finish|what do i do|new player)\b).*$/i,
    title: /^How normal attacks resolve$/i,
  },
  {
    question: /(?=.*\b(?:combat rolls?|attack and defen[cs]e)\b)(?=.*\b(?:match|equal|tie)\b)/i,
    title: /^Defense rolls$/i,
  },
  {
    question: /\bwhat does advantage do\b/i,
    title: /^Massive, advantage, and disadvantage$/i,
  },
  {
    question: /\bhow do i collect rp\b/i,
    title: /^Collecting RP$/i,
  },
  {
    question: /\bhow do i upgrade coral\b/i,
    title: /^Coral upgrades$/i,
  },
  {
    question: /\b(?:colored star circles?|star icons?.*colored circles?)\b/i,
    title: /^Star icons and colored circles under On Play abilities$/i,
  },
  {
    question: /(?=.*\bmassive\b)(?=.*\b(?:combat|advantage|disadvantage)\b)/i,
    title: /^Massive, advantage, and disadvantage$/i,
  },
  {
    question: /\bwhat if\b.*\btoxic\b/i,
    title: /^Toxic creatures$/i,
  },
  {
    question: /(?=.*\bshared condition\b)(?=.*\b(?:change|changes|reveal|next)\b)/i,
    title: /^What Conditions cards are used for$/i,
  },
  {
    question: /(?=.*\b(?:order of decisions|turn order|four steps)\b)(?=.*\bturn\b)/i,
    title: /^Turn order$/i,
  },
  {
    question: /(?=.*\b(?:move|moving|moved)\b)(?=.*\baction\b)(?=.*\b(?:again|refresh|once-per-turn|same turn)\b)/i,
    title: /^Action timing and cooldowns$/i,
  },
  {
    question: /(?=.*\breef fish\b)(?=.*\b(?:predator|deep) slots?\b)/i,
    title: /^Habitat and class matching for Reef Fish and Deep slots$/i,
  },
  {
    question: /(?=.*\bcoral reef\b)(?=.*\b(?:taking damage|maintenance|composition)\b)/i,
    title: /^Coral Reef Habitat maintenance$/i,
  },
  {
    question: /(?=.*\bcondition(?:s)?\s+cards?\b)(?=.*\b(?:for|mean|used|work)\b)/i,
    title: /^What Conditions cards are used for$/i,
  },
  {
    question: /(?=.*\b(?:victory points?|vp)\b)(?=.*\b(?:count|counts|counted|winning|win)\b)/i,
    title: /^Victory Points$/i,
  },
  {
    question: /(?=.*\b(?:victory points?|vp|points on a (?:card|creature))\b)(?=.*\b(?:discard|leaves? play|left play|still count|remove|subtract)\b)/i,
    title: /^Victory Points$/i,
  },
  {
    question: /^(?!.*\brp bank\b)(?=.*\b(?:draw|drawing|hand)\b)(?=.*\b(?:exceed|full|limit|overflow)\b)/i,
    title: /^Hand limits and overflow$/i,
  },
  {
    question: /(?=.*\b(?:collect|collecting)\b)(?=.*\brp\b)(?=.*\b(?:bank|cap|limit)\b)/i,
    title: /^Collecting RP$/i,
  },
  {
    question: /^\s*(?:can you explain\s+)?what\s+is\s+defen[cs]e\s+in\s+(?:this|the)\s+game\b/i,
    title: /^Defense rolls$/i,
  },
  {
    question: /(?=.*\bschool density\b)(?=.*\bfor\b)/i,
    title: /^School Density requirements$/i,
  },
  {
    question: /^\s*(?:how|where)\s+(?:do|should|can)\s+(?:i|we)\s+(?:start|begin)(?:\s+(?:playing|the game|a game|seapals|sea pals))?\s*[?.!]*$/i,
    title: /^Starting a game$/i,
  },
  {
    question: /(?=.*\b(?:begin|start|starting|sit down)\b)(?=.*\b(?:cards?|hand|rp|resources?)\b)/i,
    title: /^Starting a game$/i,
  },
  {
    question: /(?=.*\b(?:upgrade|upgrades|upgraded|upgrading)\b)(?=.*\bcoral\b)(?=.*\b(?:damage|damaged|heal|healed|hurt)\b)/i,
    title: /^Coral upgrades$/i,
  },
  {
    question: /\b(?:cloak(?:ed)?|transparency)\b/i,
    title: /^Cloak and Transparency$/i,
  },
  {
    question: /(?=.*\btoxic\b)(?=.*\b(?:eat|ate|eaten|consum|consumed|consuming)\w*\b)/i,
    title: /^Toxic creatures$/i,
  },
  {
    question: /\bregenerate\b/i,
    title: /^Regenerate$/i,
  },
  {
    question: /(?=.*\battack\b)(?=.*\bdefen[cs]e\b)(?=.*\b(?:equal|equals|match|same|tie|ties|tied)\b)/i,
    title: /^How normal attacks resolve$/i,
  },
];
const CONCEPT_INTENT_ROUTES = [
  { id: "glossary:hosted-cards", question: /\b(?:hosted cards?|attachments?|attached cards?)\b.*\b(?:what|mean|are|work)\b|\bwhat are hosted cards\b/i },
  { id: "glossary:cost", question: /^\s*is an? rp cost\b/i },
  { id: "glossary:passive-abilities", question: /^\s*is (?:an? )?passive\b|\b(?:pay|activate).*(?:passive|keep.*passive)|\bpassive.*(?:running|active).*turn\b/i },
  { id: "glossary:creature-class", question: /\bfish\b.*\bpredator\b.*\bcreature classes?\b/i },
  { id: "glossary:rp", question: /^\s*is rp\b.*\b(?:oceanic|creature schools?)\b/i },
  { id: "glossary:build", question: /\bbuild\b.*\bpaid actions?\b/i },
  { id: "glossary:play-requirements", question: /\b(?:play requirements?|prerequisite)\b.*\b(?:cost|pay|before|check|satisf)/i },
  { id: "glossary:star-family-icons", question: /\b(?:circles? with stars?|little circles?.*stars?|colored circles?.*stars?)\b/i },
  { id: "glossary:on-play-abilities", question: /\b(?:on play|when played)\b/i },
  { id: "glossary:actions", question: /\bactivated abilities?\b|\b(?:use|using|paid|activate|activated)\b.*\bactions?\b|\bactions?\b.*\b(?:choose|order|activate|paid)\b/i },
  { id: "glossary:cost", question: /\b(?:number by rp|printed rp price|rp (?:price|cost)|price to play|discard requirements?.*(?:price|rp|number|included|cost))\b/i },
  { id: "glossary:attack-count", question: /\b(?:attack says (?:two|three|four|\d+)|repeated attacks?|multiple attacks?|roll once or .*times?)\b/i },
  { id: "glossary:target-icons", question: /\b(?:who.*attack.*allowed to hit|restrictions?.*target (?:picture|icon|symbol)|target pictures?.*(?:tell|mean)|pictures? on an attack)\b/i },
  { id: "glossary:star-family-icons", question: /\b(?:any apex star|family stars?|star (?:icon|symbol)|circles? with stars?|circle with a star|colored star|little family stars?|little circles?.*stars?)\b/i },
  { id: "glossary:weakness", question: /\b(?:condition\b.*\bmatches?\b.*\bweakness|weak(?:ness|-to) (?:symbols?|icons?)|coral weakness)\b/i },
  { id: "glossary:card-kind", question: /\b(?:creature,? coral,? support,? habitat|broad card kinds?|card(?:'s)? kind)\b/i },
  { id: "glossary:creature-class", question: /\b(?:fish,? predator,? (?:and )?apex|fish and predator)\b.*\b(?:class|habitat|kind)s?\b|\bcreature classes?\b/i },
  { id: "glossary:creature-habitat", question: /\b(?:reef,? oceanic,? (?:and )?deep|oceanic|reef|deep)\b.*\b(?:mean|creatures?|slot|habitat zone|class distinction)\b|\breef versus deep\b/i },
  { id: "glossary:creature-subtype", question: /\b(?:baitball|bait ball)\b.*\b(?:kind|class|subtype)\b/i },
  { id: "glossary:apex", question: /\bwhat does apex mean\b/i },
  { id: "glossary:invertebrate", question: /\binvertebrates?\b.*\b(?:slot|predator|habitat)\b|\b(?:slot|predator)\w*\b.*\binvertebrates?\b/i },
  { id: "glossary:coral", question: /\bwhat does coral provide\b/i },
  { id: "glossary:habitat", question: /\bhabitats?\b.*\b(?:stay|remain|replace).*\b(?:ecosystem|foundation|play)\b/i },
  { id: "glossary:condition", question: /\b(?:play conditions? from|conditions?.*from (?:my |your )?hand|condition.*like a support|condition.*destroy coral|condition.*printed effect)\b/i },
  { id: "glossary:creature-school", question: /\b(?:bait ?ball|creature school)\b.*\bdefen[cs]e roll\b/i },
  { id: "glossary:foundation", question: /\b(?:which cards count as foundations?|every foundation.*habitat)\b/i },
  { id: "glossary:foundation-deck", question: /\b(?:regular support.*foundation deck|later coral stages|coral upgrades?.*pals deck)\b/i },
  { id: "glossary:pals-deck", question: /\b(?:support and habitat.*pals deck|regular creatures?.*(?:foundation deck|pals deck)|pals deck.*shared pile)\b/i },
  { id: "glossary:conditions-deck", question: /\b(?:condition pile|conditions?.*(?:shuffled|deck).*(?:each player|pals deck)|revealed condition.*first player)\b/i },
  { id: "glossary:discard", question: /\bwhere does a destroyed card.*go\b/i },
  { id: "glossary:ecosystem", question: /\bcards? in (?:my |your )?hand.*(?:part of|in).*ecosystem\b/i },
  { id: "glossary:lost-zone", question: /\bdiscarded cards?.*lost zone\b/i },
  { id: "glossary:slots", question: /\b(?:any creature.*(?:empty )?coral (?:space|slot)|creature fit.*coral)\b/i },
  { id: "glossary:rp-bank", question: /\b(?:rp bank|rp.*beyond the cap|bank cap.*cards? in hand)\b/i },
  { id: "glossary:round", question: /\b(?:player(?:'s)? turn|one turn)\b.*\b(?:whole|entire|same).*round\b/i },
  { id: "glossary:choose", question: /\b(?:which deck|where).*(?:draw from|draw).*(?:first turn step|choose)\b/i },
  { id: "glossary:collect", question: /\b(?:foundations? produce rp|bank cap.*(?:before|after) collecting)\b/i },
  { id: "glossary:build", question: /\b(?:when.*allowed to upgrade|build.*paid actions?|requirements?.*before resolving a card play)\b/i },
  { id: "glossary:attack-step", question: /\bchoose targets?.*roll combat dice\b/i },
  { id: "glossary:base-stage", question: /\b(?:which card|what).*starts? an upgrade line\b/i },
  { id: "glossary:health", question: /^\s*is hp\b/i },
  { id: "glossary:victory-points", question: /^\s*do (?:the )?vp\b/i },
  { id: "glossary:hand", question: /\bhand is full\b.*\b(?:collect|rp)\b/i },
  { id: "glossary:dice-notation", question: /\b(?:fixed )?\+?\d+ die modifier\b.*\badvantage\b/i },
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NUMBER_WORD_PATTERN = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/i;
const QUANTITY_EXCEPTION_PATTERN = /\b(?:how many|how much|no fixed|not|does not|do not|is not|are not|depends? on|printed|capacity|varies|not documented|doesn't|isn't|aren't)\b/i;
const LOCATION_SIGNAL_PATTERN = /\b(?:deck|hand|discard|ecosystem|slot|reef|ocean(?:ic)?|deep|play area|zone|foundation|pals|conditions?|host|card)\b/i;
const TIMING_SIGNAL_PATTERN = /\b(?:if|during|before|after|start|begin|end|turn|round|until|while|once|next|when|then|follows?|successfully played|leaves play)\b/i;
const PROCEDURE_SIGNAL_PATTERN = /\b(?:first|then|before|after|choose|pay|draw|roll|resolve|play|apply|place|spend|gain|collect|reveal|discard|subtract|keep|match|take|produce|stop)\b/i;
const BOOLEAN_SIGNAL_PATTERN = /^(?:yes|no)\b|\b(?:can(?:not|'t)?|does not|do not|is not|are not|not|only|unless|must|may|has to|have to|requires?|required|permitted|allowed|instead|either|belongs?|persistent|remains?|stays?|lost|discard(?:ed)?)\b/i;

export function inferQuestionTypes(question) {
  const value = String(question ?? "").trim();
  const normalized = normalize(value);
  const types = [];
  const add = (type) => {
    if (!types.includes(type)) types.push(type);
  };

  const politeDefinition = /^(?:can|could|would) you (?:explain|define|tell me)\b/i.test(normalized);
  const politeProcedure = /^(?:can|could|would) you (?:give me .*steps|walk me through|show me how)\b/i.test(normalized);
  const booleanClause = /^(?:and |now )?(?:can|could|does|do|did|is|are|am|was|were|will|would|should|must|may|have|has)\b/i.test(normalized)
    || /(?:[,.;!?]\s+)(?:can|could|does|do|did|is|are|am|was|were|will|would|should|must|may|have|has)\b/i.test(value)
    || /\b(?:if|when|after|before|once)\b[^,?]{0,140},\s*(?:can|could|does|do|did|is|are|am|was|were|will|would|should|must|may|have|has)\b/i.test(value);
  const quantityQuestion = /\bhow (?:many|much)\b/i.test(normalized)
    || /\b(?:number|amount|total)\s+of\b/i.test(value)
    || /^what(?: s| is)\b.*\b(?:score|number|amount|total|maximum|minimum|limit|cap|target)\b/i.test(normalized)
    || /\b(?:needed|required)\s+to\b/i.test(value);
  const locationQuestion = /^where\b/i.test(normalized)
    || /\bwhich\s+(?:deck|pile|zone|slot|area|habitat)\b|\bwhat\s+(?:deck|pile|zone|slot|area)\b/i.test(value);
  const procedureQuestion = /\bwhat happens\b|\bwalk me through\b|\bwhat (?:can|should) i do\b/i.test(value)
    || /^how (?:do|does|can|should|is|are)\b/i.test(normalized)
    || /^what if\b/i.test(normalized);
  const timingQuestion = /^when\b/i.test(normalized)
    || /^how long\b/i.test(normalized)
    || /\bat what (?:point|time)\b|\bwhich (?:step|phase)\b/i.test(value);
  const comparisonQuestion = /\b(?:difference|different|same|versus|vs\.?|compare|compared)\b/i.test(value);
  const definitionQuestion = /^(?:what (?:is|are|does|do)|define|explain|tell me about|who|why)\b/i.test(normalized)
    || /\bwhat does\b.*\bmean\b|\bwhat do\b.*\bmean\b/i.test(value);

  let primary = "definition";
  if (politeProcedure) primary = "procedure";
  else if (politeDefinition) primary = "definition";
  else if (booleanClause) primary = "boolean";
  else if (quantityQuestion) primary = "quantity";
  else if (locationQuestion) primary = "location";
  else if (procedureQuestion) primary = "procedure";
  else if (timingQuestion) primary = "timing";
  else if (comparisonQuestion) primary = "comparison";
  else if (definitionQuestion) primary = "definition";

  add(primary);
  if (quantityQuestion) add("quantity");
  if (locationQuestion) add("location");
  if (timingQuestion) add("timing");
  if (booleanClause) add("boolean");
  if (procedureQuestion || politeProcedure) add("procedure");
  if (comparisonQuestion) add("comparison");
  if (definitionQuestion || politeDefinition) add("definition");
  return types;
}

function phraseInQuestion(normalizedQuestion, phrase) {
  const normalizedPhrase = normalize(phrase);
  return normalizedPhrase && ` ${normalizedQuestion} `.includes(` ${normalizedPhrase} `);
}

function phraseWeight(phrase, multiplier) {
  const normalizedPhrase = normalize(phrase);
  const words = normalizedPhrase.split(" ").filter(Boolean).length;
  return words * multiplier + Math.min(normalizedPhrase.length / 5, 5);
}

function numericFactValues(value) {
  if (typeof value === "number") return [value];
  if (Array.isArray(value)) return value.flatMap(numericFactValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(numericFactValues);
  return [];
}

function ruleForStructuredFact(fact, rules) {
  const matches = rules.filter((rule) => normalize(rule.title) === normalize(fact.sourceTitle));
  if (!matches.length) return null;
  const glossaryTitle = /^(?:Special Rules|Passive abilities|On Play abilities|Actions|Target icons)$/i.test(fact.sourceTitle);
  if (glossaryTitle) return matches.find((rule) => rule.source === "glossary") ?? matches[0];
  return matches.find((rule) => rule.source !== "glossary" && !["ability", "card", "concept"].includes(rule.entity?.type))
    ?? matches.find((rule) => rule.source !== "glossary")
    ?? matches[0];
}

function sourcesForStructuredFact(match, rules) {
  const glossary = match.fact.glossaryId
    ? rules.find((rule) => rule.id === match.fact.glossaryId)
    : null;
  return uniqueSources([sourceFor(match.rule), ...(glossary ? [sourceFor(glossary)] : [])]);
}

export function findStructuredFact(question, rules) {
  const normalizedQuestion = normalize(question);
  const questionTypes = inferQuestionTypes(question);
  const candidates = STRUCTURED_RULE_FACTS.map((fact) => {
    const conceptMatches = fact.concepts.filter((phrase) => phraseInQuestion(normalizedQuestion, phrase));
    if (!conceptMatches.length) return null;
    const intentMatches = fact.intents.filter((phrase) => phraseInQuestion(normalizedQuestion, phrase));
    const typeMatches = fact.answerTypes.filter((type) => questionTypes.includes(type));
    if (!intentMatches.length && !typeMatches.length) return null;
    const strongestConcept = Math.max(...conceptMatches.map((phrase) => phraseWeight(phrase, 12)));
    const strongestIntent = intentMatches.length
      ? Math.max(...intentMatches.map((phrase) => phraseWeight(phrase, 7)))
      : 0;
    const specificity = Math.max(...conceptMatches.map((phrase) => normalize(phrase).split(" ").length));
    const genericConceptOnly = specificity === 1 && strongestIntent === 0 && typeMatches.length === 0;
    if (genericConceptOnly) return null;
    const score = strongestConcept + strongestIntent + typeMatches.length * 9 + Math.min(conceptMatches.length - 1, 2) * 2;
    const rule = ruleForStructuredFact(fact, rules);
    return rule && score >= 24 ? {
      conceptMatches,
      fact,
      intentMatches,
      questionTypes,
      rule,
      score,
      typeMatches,
    } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
    const firstTypes = candidates[0].fact.answerTypes.filter((type) => questionTypes.includes(type)).length;
    const secondTypes = candidates[1].fact.answerTypes.filter((type) => questionTypes.includes(type)).length;
    if (secondTypes > firstTypes) return candidates[1];
  }
  return candidates[0] ?? null;
}

export function validateAnswerSufficiency(question, result) {
  if (!result || result.kind !== "answer") return { valid: true, type: null, reason: null };
  const types = inferQuestionTypes(question);
  const primaryType = types[0];
  const text = String(result.text ?? "");
  let valid = true;
  let reason = null;

  if (primaryType === "quantity" && !/\b\d+(?:\.\d+)?\b/.test(text) && !NUMBER_WORD_PATTERN.test(text) && !QUANTITY_EXCEPTION_PATTERN.test(text)) {
    valid = false;
    reason = "the requested number";
  } else if (primaryType === "location" && !LOCATION_SIGNAL_PATTERN.test(text)) {
    valid = false;
    reason = "the requested location";
  } else if (primaryType === "timing" && !TIMING_SIGNAL_PATTERN.test(text)) {
    valid = false;
    reason = "the requested timing";
  } else if (primaryType === "boolean" && !BOOLEAN_SIGNAL_PATTERN.test(text)
    && !(/\bor\b/i.test(String(question)) && text.trim().split(/\s+/).length >= 6)
    && !(/\b(?:my|own)\b/i.test(String(question)) && /\bopponent\b/i.test(text))
    && !(/\bsame\b/i.test(String(question)) && /\badvantage\b/i.test(text) && /\bdisadvantage\b/i.test(text))) {
    valid = false;
    reason = "a clear yes-or-no answer";
  } else if (primaryType === "procedure" && !PROCEDURE_SIGNAL_PATTERN.test(text)) {
    valid = false;
    reason = "the requested procedure";
  } else if (primaryType === "definition" && text.trim().split(/\s+/).length < 5) {
    valid = false;
    reason = "a usable definition";
  }

  if (valid && !result.sources?.length) {
    valid = false;
    reason = "a supporting rule source";
  }
  return { valid, type: primaryType, reason };
}

function titleCase(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceFor(rule) {
  return {
    id: rule.id,
    label: rule.sourceLabel ?? rule.title,
    href: rule.sourceHref ?? "/instructions",
  };
}

function sourcesFor(rule) {
  if (!rule.sourceCards?.length) return [sourceFor(rule)];
  return [sourceFor(rule), ...rule.sourceCards.slice(1, 6)];
}

function sourcesForIntentRule(rule, rules) {
  const sources = [sourceFor(rule)];
  if (/^Victory Points$/i.test(rule.title)) {
    const glossary = rules.find((candidate) => candidate.id === "glossary:victory-points");
    const inPlay = rules.find((candidate) => candidate.id === "knowledge:victory-points-in-play");
    if (inPlay) sources.push(sourceFor(inPlay));
    if (glossary) sources.push(sourceFor(glossary));
  }
  if (/^Reading targets on attacks and abilities$/i.test(rule.title)) {
    for (const id of ["glossary:target-icons", "glossary:legal-target"]) {
      const concept = rules.find((candidate) => candidate.id === id);
      if (concept) sources.push(sourceFor(concept));
    }
  }
  if (/^(?:Building a consistent deck|A step-by-step deck-building guide)$/i.test(rule.title)) {
    const construction = rules.find((candidate) => /^Deck construction$/i.test(candidate.title) && candidate.source !== "glossary");
    if (construction) sources.push(sourceFor(construction));
  }
  return uniqueSources(sources);
}

function uniqueSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    if (!source?.id || seen.has(source.id)) return false;
    seen.add(source.id);
    return true;
  });
}

function nextContext(question, answer, previous = {}, mentionedRules = [], roles = {}) {
  const turn = Number(previous.turn ?? 0) + 1;
  const previousEntities = Array.isArray(previous.entities) ? previous.entities : [];
  const entities = previousEntities.map((entity) => ({ ...entity }));
  const additions = [...mentionedRules];
  if (answer.entity && !additions.some((rule) => rule.entity?.id === answer.entity.id)) {
    additions.push({ entity: answer.entity, facts: {} });
  }

  for (const rule of additions) {
    if (!rule?.entity?.id) continue;
    const existing = entities.find((entity) => entity.id === rule.entity.id);
    const details = {
      id: rule.entity.id,
      label: rule.entity.label ?? rule.title,
      type: rule.entity.type ?? "card",
      kind: rule.facts?.kind ?? existing?.kind ?? "",
      category: rule.facts?.category ?? existing?.category ?? "",
      mentionedAt: turn,
    };
    if (existing) Object.assign(existing, details);
    else entities.push(details);
  }

  const active = [...additions].reverse().find((rule) => rule?.entity?.type === "card")?.entity
    ?? (answer.entity?.type === "card" ? answer.entity : null);
  const condition = [...additions].reverse().find((rule) =>
    rule?.entity?.id && (rule.facts?.kind === "condition" || rule.facts?.category === "condition"),
  );
  const history = [...(Array.isArray(previous.history) ? previous.history : []), {
    question,
    ruleIds: (answer.sources ?? []).map((source) => source.id).filter(Boolean),
  }].slice(-6);

  return {
    activeEntityId: active?.id ?? previous.activeEntityId ?? null,
    activeEntityLabel: active?.label ?? previous.activeEntityLabel ?? null,
    attackerId: roles.attackerId ?? previous.attackerId ?? null,
    defenderId: roles.defenderId ?? previous.defenderId ?? null,
    previousConditionId: condition?.entity.id ?? previous.previousConditionId ?? null,
    entities: entities.slice(-10),
    history,
    lastQuestion: question,
    lastRuleIds: (answer.sources ?? []).map((source) => source.id).filter(Boolean),
    turn,
  };
}

function candidateMatches(question, rules) {
  const normalizedQuestion = ` ${normalize(question)} `;
  const matches = [];
  for (const rule of rules) {
    if (rule.entity?.type !== "card") continue;
    const matchingAliases = (rule.aliases ?? [rule.title])
      .map((alias) => normalize(alias))
      .filter((alias) => alias && normalizedQuestion.includes(` ${alias} `));
    if (matchingAliases.length) {
      matches.push({ rule, matchLength: Math.max(...matchingAliases.map((alias) => alias.length)) });
    }
  }
  const exactTitleMatches = matches.filter(({ rule }) => normalizedQuestion.includes(` ${normalize(rule.title)} `));
  const pool = exactTitleMatches.length ? exactTitleMatches : matches;
  const longest = Math.max(0, ...pool.map((match) => match.matchLength));
  return pool.filter((match) => match.matchLength === longest).map((match) => match.rule);
}

function explicitCardMatches(question, rules) {
  const normalizedQuestion = normalize(question);
  const cardRules = rules.filter((rule) => rule.entity?.type === "card");
  const spans = [];
  for (const rule of cardRules) {
    const normalizedTitle = normalize(rule.title);
    const aliases = [...new Set([rule.title, ...(rule.aliases ?? [])].map(normalize).filter(Boolean))];
    for (const alias of aliases) {
      let start = normalizedQuestion.indexOf(alias);
      while (start >= 0) {
        const end = start + alias.length;
        const leftBoundary = start === 0 || normalizedQuestion[start - 1] === " ";
        const rightBoundary = end === normalizedQuestion.length || normalizedQuestion[end] === " ";
        if (leftBoundary && rightBoundary) {
          spans.push({ end, exactTitle: alias === normalizedTitle, length: alias.length, rule, start });
        }
        start = normalizedQuestion.indexOf(alias, start + 1);
      }
    }
  }
  if (spans.length) {
    const accepted = [];
    for (const span of spans.sort((a, b) => b.length - a.length || Number(b.exactTitle) - Number(a.exactTitle) || a.start - b.start)) {
      if (accepted.some((candidate) => candidate.rule.id === span.rule.id)) continue;
      const shadowedByExactTitle = accepted.some((candidate) => candidate.exactTitle
        && !span.exactTitle
        && span.start === candidate.start
        && span.end === candidate.end);
      if (shadowedByExactTitle) continue;
      const conflictsWithMoreSpecificMatch = accepted.some((candidate) => {
        const overlaps = span.start < candidate.end && span.end > candidate.start;
        const samePhrase = span.start === candidate.start && span.end === candidate.end;
        return overlaps && !samePhrase;
      });
      if (conflictsWithMoreSpecificMatch) continue;
      accepted.push(span);
    }
    return accepted.sort((a, b) => a.start - b.start).map((span) => span.rule);
  }
  return candidateMatches(question, rules);
}

function isCardFocusedQuestion(question, cardRule) {
  if (/\b(maintenance|general rule|rules? for)\b/i.test(question)) return false;
  const normalizedQuestion = normalize(question);
  if (` ${normalizedQuestion} `.includes(` ${normalize(cardRule.title)} `)) return true;
  const aliases = (cardRule.aliases ?? [cardRule.title]).map(normalize).sort((a, b) => b.length - a.length);
  const alias = aliases.find((candidate) => ` ${normalizedQuestion} `.includes(` ${candidate} `));
  const remainder = normalize(normalizedQuestion.replace(alias ?? "", ""))
    .split(" ")
    .filter((word) => word && !["a", "about", "can", "card", "condition", "coral", "creature", "do", "does", "explain", "fish", "for", "foundation", "give", "habitat", "how", "is", "me", "of", "on", "please", "practical", "rundown", "support", "tell", "the", "through", "to", "walk", "what", "work", "works", "you"].includes(word));
  return remainder.length === 0 || SPECIFIC_CARD_FACT_PATTERN.test(question);
}

function isFollowUp(question) {
  const normalized = String(question ?? "").trim();
  return FOLLOW_UP_PATTERN.test(normalized) || normalize(normalized).split(" ").length <= 8 && /\b(it|its|that|this|they|those|one)\b/i.test(normalized);
}

function findIntentRule(question, rules) {
  const route = INTENT_ROUTES.find((candidate) => candidate.question.test(question));
  if (!route) return null;
  const matches = rules.filter((rule) => route.title.test(rule.title));
  return matches.find((rule) => rule.source !== "glossary" && !["ability", "card", "concept"].includes(rule.entity?.type))
    ?? matches[0]
    ?? null;
}

function findExplicitReferenceRule(question, rules) {
  const subject = normalize(question).replace(/^(?:can you |could you )?(?:define|explain|tell me about)\s+/, "");
  return rules
    .filter((rule) => !["ability", "card", "glossary"].includes(rule.source) && rule.entity?.type !== "concept")
    .filter((rule) => subject === normalize(rule.title))
    .filter((rule) => !rules.some((candidate) => candidate.entity?.type === "concept" && normalize(candidate.title) === normalize(rule.title)))
    .sort((a, b) => normalize(b.title).length - normalize(a.title).length)[0] ?? null;
}

function findNamedAbility(question, rules, explicitCards = []) {
  const normalizedQuestion = ` ${normalize(question)} `;
  const genericAbilityNames = new Set([
    "action", "attack", "build", "choose", "collect", "condition", "coral", "damage", "defense",
    "destroyed", "fish", "habitat", "maintenance", "passive", "round", "support", "target", "turn", "upgrade", "weakness",
  ]);
  const candidates = rules
    .filter((rule) => rule.entity?.type === "ability")
    .map((rule) => ({
      rule,
      aliases: (rule.aliases ?? [rule.title])
        .map((alias) => normalize(alias))
        .filter((alias) => alias && normalizedQuestion.includes(` ${alias} `)),
    }))
    .map((candidate) => ({ ...candidate, alias: candidate.aliases.sort((a, b) => b.length - a.length)[0] }))
    .filter((candidate) => candidate.alias)
    .filter(({ alias }) => {
      const nestedInCardTitle = explicitCards.some((card) => ` ${normalize(card.title)} `.includes(` ${alias} `));
      return !nestedInCardTitle || /\b(ability|passive|action|effect)\b/i.test(question);
    })
    .map((candidate) => {
      const explicitlyAbilityFocused = /\b(abilit(?:y|ies)|action|called|effect|named|on play|passive|printed versions?)\b/i.test(question);
      const subjectMatch = !genericAbilityNames.has(candidate.alias) || explicitlyAbilityFocused;
      return { ...candidate, matchLength: candidate.alias.length, subjectMatch };
    })
    .filter((candidate) => candidate.subjectMatch)
    .sort((a, b) => b.matchLength - a.matchLength);
  return candidates[0]?.rule ?? null;
}

function findExactConcept(question, rules) {
  const routed = CONCEPT_INTENT_ROUTES.find((route) => route.question.test(question));
  if (routed) {
    const rule = rules.find((candidate) => candidate.id === routed.id);
    if (rule) return rule;
  }
  const normalizedQuestion = ` ${normalize(question)} `;
  const matches = rules
    .filter((rule) => rule.entity?.type === "concept")
    .map((rule) => {
      const aliases = [rule.title, ...(rule.aliases ?? [])]
        .map((candidate) => normalize(candidate))
        .filter((candidate) => candidate && normalizedQuestion.includes(` ${candidate} `))
        .sort((a, b) => b.split(" ").length - a.split(" ").length || b.length - a.length);
      const alias = aliases[0];
      if (!alias) return null;
      const start = normalizedQuestion.indexOf(` ${alias} `);
      const wordCount = alias.split(" ").length;
      const firstConceptMention = rules
        .filter((candidate) => candidate.entity?.type === "concept")
        .flatMap((candidate) => [candidate.title, ...(candidate.aliases ?? [])])
        .map((candidate) => normalize(candidate))
        .filter((candidate) => candidate && normalizedQuestion.includes(` ${candidate} `))
        .map((candidate) => normalizedQuestion.indexOf(` ${candidate} `))
        .reduce((earliest, index) => Math.min(earliest, index), Number.POSITIVE_INFINITY);
      const targeted = new RegExp(`(?:what (?:is|are|does|do)|explain|define|mean|means|do i|does|can|which|when|where|why|how) [a-z ]{0,28}\\b${alias.replace(/ /g, "\\s+")}\\b`, "i")
        .test(normalize(question));
      const score = wordCount * 100 + alias.length + (targeted ? 75 : 0) + (start === firstConceptMention ? 35 : 0) - start / 100;
      return { alias, rule, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return matches[0]?.rule ?? null;
}

function mentionedConcepts(question, rules) {
  const normalizedQuestion = ` ${normalize(question)} `;
  return rules
    .filter((rule) => rule.entity?.type === "concept")
    .map((rule) => {
      const aliases = [rule.title, ...(rule.aliases ?? [])]
        .map((candidate) => normalize(candidate))
        .filter((candidate) => candidate && normalizedQuestion.includes(` ${candidate} `))
        .sort((a, b) => b.split(" ").length - a.split(" ").length || b.length - a.length);
      const alias = aliases[0];
      return alias ? { rule, alias, index: normalizedQuestion.indexOf(` ${alias} `) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index || b.alias.length - a.alias.length)
    .filter((entry, index, values) => values.findIndex((candidate) => candidate.index === entry.index) === index)
    .filter((entry, index, values) => values.findIndex((candidate) => candidate.rule.id === entry.rule.id) === index);
}

function conceptComparisonAnswer(question, rules, context = {}) {
  if (!/\b(?:difference|different|compare|compared|comparison|versus|vs\.?|same(?: thing| as)?|distinction|like)\b/i.test(question)) return null;
  const concepts = mentionedConcepts(question, rules);
  if (concepts.length === 1 && isFollowUp(question)) {
    const previousConcept = (context.lastRuleIds ?? [])
      .map((id) => rules.find((rule) => rule.id === id && rule.entity?.type === "concept"))
      .find((rule) => rule && rule.id !== concepts[0].rule.id);
    if (previousConcept) concepts.unshift({ rule: previousConcept, alias: normalize(previousConcept.title), index: -1 });
  }
  if (concepts.length < 2) return null;
  const [first, second] = concepts;
  const pair = [first.rule.id, second.rule.id].sort().join("|");
  const bridges = {
    "glossary:rp|glossary:victory-points": "The key difference is that RP is a spendable resource, while VP is your score toward winning. Spending RP does not spend VP, and gaining VP does not add RP.",
    "glossary:rp|glossary:school-density": "RP is spent to pay costs. School Density is an ecosystem threshold that is checked, not spent, so meeting an SD requirement does not reduce your SD.",
    "glossary:creature-class|glossary:creature-habitat": "Class says what kind of creature it is; habitat says which Reef, Oceanic, or Deep zone it belongs to. Placement and targeting may check either or both.",
    "glossary:cost|glossary:play-requirements": "A play requirement must already be satisfied, while a cost is paid. Meeting one does not satisfy the other.",
    "glossary:on-play-abilities|glossary:passive-abilities": "An On Play ability resolves when the card enters play; a Passive remains active while its condition and card remain in play.",
    "glossary:round|glossary:turn": "A round contains the shared Condition timing and every player's turn; one player's turn is only their part of that round.",
    "glossary:foundation-deck|glossary:pals-deck": "The Foundation Deck holds Corals and Creature Schools, while the Pals Deck holds regular creatures, Support cards, and Habitat cards.",
  };
  const bridge = bridges[pair] ?? "They are separate rules terms, so use the definition that matches what the card or instruction is asking you to check.";
  return {
    kind: "answer",
    title: `${first.rule.title} vs. ${second.rule.title}`,
    text: `${first.rule.title}: ${first.rule.text} ${second.rule.title}: ${second.rule.text} ${bridge}`,
    sources: uniqueSources([first.rule, second.rule].map(sourceFor)),
  };
}

function isDefinitionQuestion(question) {
  return /^(?:can|could)\s+you\s+explain\b|^\s*(?:define|explain|tell me about)\b|\bwhat\s+(?:does|do|is|are)\b.*\b(?:mean|means)?\b/i.test(question)
    || /^\s*what\s+(?:is|are)\b/i.test(question)
    || /^\s*how\s+(?:do|does)\b.*\bwork\b/i.test(question);
}

function questionNamesRule(question, rule) {
  const normalizedQuestion = ` ${normalize(question)} `;
  return [rule.title, ...(rule.aliases ?? [])]
    .map((value) => normalize(value))
    .some((value) => value && normalizedQuestion.includes(` ${value} `));
}

function unsupportedDefinition(question, relevant) {
  const options = uniqueRules(relevant).slice(0, 3).map((rule) => rule.title);
  return {
    kind: "clarification",
    title: "Which SeaPals term do you mean?",
    text: `I don't have a strong enough match for “${String(question).trim().replace(/[.!?]+$/, "")},” and I don't want to substitute a merely related rule. ${options.length ? `The closest documented topics are ${joinList(options)}—which one did you mean?` : "Please name the card label, icon, phase, or ability you are looking at."}`,
    options,
    sources: [],
  };
}

function cardById(id, rules) {
  if (!id) return null;
  return rules.find((rule) => rule.entity?.type === "card" && rule.entity.id === id) ?? null;
}

function requestedStageLabel(question) {
  if (/\bbase(?:\s+(?:stage|version|card))?\b/i.test(question)) return "Base";
  const match = String(question).match(/\bstage\s*(\d+|one|two|three|four)\b/i);
  if (!match) return null;
  const words = { one: 1, two: 2, three: 3, four: 4 };
  const number = words[match[1].toLowerCase()] ?? Number(match[1]);
  return Number.isInteger(number) ? `Stage ${number}` : null;
}

function cardVersionExistenceAnswer(question, candidates, rules) {
  const requestedStage = requestedStageLabel(question);
  const asksForList = /\b(?:what|which)\s+(?:stages?|versions?)\b.*\b(?:have|exist|available|are there)\b|\blist\b.*\b(?:stages?|versions?)\b|\bhow many\s+(?:stages?|versions?)\b|\b(?:stages?|versions?)\b.*\b(?:exist|available)\b/i.test(question);
  if ((!requestedStage || !/\b(?:is there|are there|does .* have|do .* have|exists?|available|made)\b/i.test(question)) && !asksForList) return null;
  const normalizedQuestion = ` ${normalize(question)} `;
  const stagedFromQuestion = rules.filter((rule) => rule.entity?.type === "card" && rule.facts?.stageLabel
    && (rule.aliases ?? [rule.title]).some((alias) => {
      const normalizedAlias = normalize(alias);
      return normalizedAlias && normalizedQuestion.includes(` ${normalizedAlias} `);
    }));
  const staged = uniqueRules([...candidates.filter((rule) => rule.facts?.stageLabel), ...stagedFromQuestion]);
  if (!staged.length) return null;
  const family = staged[0].title.replace(/\s+â€”\s+(?:Base|Stage \d+)$/i, "").replace(/\s+—\s+(?:Base|Stage \d+)$/i, "");
  const versions = rules.filter((rule) => rule.entity?.type === "card" && rule.facts?.stageLabel
    && rule.title.replace(/\s+â€”\s+(?:Base|Stage \d+)$/i, "").replace(/\s+—\s+(?:Base|Stage \d+)$/i, "") === family);
  const available = versions.map((rule) => rule.facts.stageLabel);
  if (asksForList && !requestedStage) {
    return {
      kind: "answer",
      title: `${family} versions`,
      text: `The current card data has ${family} in ${joinList(available)}.`,
      sources: uniqueSources(versions.map(sourceFor)),
    };
  }
  const requested = versions.find((rule) => rule.facts.stageLabel.toLowerCase() === requestedStage.toLowerCase());
  return {
    kind: "answer",
    title: `${family} versions`,
    text: requested
      ? `Yes. ${requested.title} exists in the current card data. The documented ${family} versions are ${joinList(available)}.`
      : `No. The current card data has ${family} in ${joinList(available)}, but it does not contain a ${requestedStage} version.`,
    entity: requested?.entity,
    sources: uniqueSources(versions.map(sourceFor)),
  };
}

function findContextCard(context, rules) {
  return cardById(context?.activeEntityId, rules);
}

function findContextAbility(context, rules) {
  const ids = Array.isArray(context?.lastRuleIds) ? context.lastRuleIds : [];
  return ids.map((id) => rules.find((rule) => rule.id === id))
    .find((rule) => rule?.entity?.type === "ability") ?? null;
}

function referencedContextCards(question, context, rules) {
  const entities = (context?.entities ?? []).map((entity) => cardById(entity.id, rules)).filter(Boolean);
  const references = [];
  const add = (rule) => {
    if (rule && !references.some((candidate) => candidate.entity.id === rule.entity.id)) references.push(rule);
  };

  if (/\b(?:the\s+)?first\s+(?:one|card|pal)\b/i.test(question)) add(entities[0]);
  if (/\b(?:the\s+)?second\s+(?:one|card|pal)\b/i.test(question)) add(entities[1]);
  if (/\b(?:the\s+)?third\s+(?:one|card|pal)\b/i.test(question)) add(entities[2]);
  if (/\b(?:that|the|previous)\s+attacker\b/i.test(question)) add(cardById(context?.attackerId, rules));
  if (/\b(?:that|the|previous)\s+(?:defender|target)\b/i.test(question)) add(cardById(context?.defenderId, rules));
  if (/\b(?:the\s+)?previous\s+condition\b/i.test(question)) add(cardById(context?.previousConditionId, rules));
  if (!references.length && isFollowUp(question)) add(findContextCard(context, rules));
  return references;
}

function inferRoles(question, cards, context = {}) {
  if (!/\b(?:attack|attacks|attacking|fight|fights|target|targets)\b/i.test(question)) return {};
  if (cards.length >= 2) return { attackerId: cards[0].entity.id, defenderId: cards[1].entity.id };
  if (cards.length === 1 && /\b(?:attacker|attacks|attacking)\b/i.test(question)) {
    return { attackerId: cards[0].entity.id, defenderId: context.defenderId ?? null };
  }
  return {};
}

function joinList(items) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function cardType(facts) {
  return [facts.zone, facts.subtype, facts.class || facts.category, facts.kind === "creature" ? "creature" : "card"]
    .filter(Boolean)
    .map(titleCase)
    .join(" ");
}

function cardAnswer(question, rule, rules) {
  const facts = rule.facts ?? {};
  const q = normalize(question);
  let text = "";

  if (/\b(cost|rp)\b/.test(q)) {
    text = facts.cost === null || facts.cost === undefined
      ? `${rule.title} does not have a documented RP play cost in the current card data.`
      : `${rule.title} costs ${facts.cost} RP to play.`;
  } else if (/\b(victory|vp|points?|worth|value)\b/.test(q)) {
    text = facts.victoryPoints === null || facts.victoryPoints === undefined
      ? `${rule.title} does not have printed Victory Points in the current card data.`
      : `${rule.title} is worth ${facts.victoryPoints} VP while it remains in play.`;
  } else if (/\b(health|hp)\b/.test(q)) {
    text = facts.health === null || facts.health === undefined
      ? `${rule.title} does not have a documented HP value.`
      : `${rule.title} has ${facts.health} HP.`;
  } else if (/\bdefen[cs]e\b/.test(q)) {
    text = facts.defense
      ? `${rule.title} rolls ${facts.defense} for defense.`
      : `${rule.title} does not have a defense die in the current card data.`;
  } else if (/\b(attack|attack die|attack dice)\b/.test(q)) {
    text = facts.attackDice
      ? `${rule.title} attacks with ${facts.attackDice}. ${facts.printedRules?.length ? facts.printedRules.join(" ") : "Resolve the attack using its printed targets and count."}`
      : `${rule.title} does not have a documented attack die. ${facts.printedRules?.join(" ") ?? ""}`.trim();
  } else if (/\b(kind|type|class|category|zone|habitat)\b/.test(q)) {
    text = `${rule.title} is a ${cardType(facts)}.`;
  } else if (/\b(slot|fit|place|played? into)\b/.test(q)) {
    return placementAnswer(question, rule, rules);
  } else if (/\bweakness/.test(q)) {
    text = facts.weaknesses?.length
      ? `${rule.title} is weak to ${joinList(facts.weaknesses.map(titleCase))}.`
      : `${rule.title} has no documented weaknesses in the current card data.`;
  } else {
    text = rule.text;
  }

  return {
    kind: "answer",
    title: rule.title,
    text,
    entity: rule.entity,
    sources: [sourceFor(rule)],
  };
}

function cardMultiFactAnswer(question, rule) {
  const facts = rule?.facts ?? {};
  const requested = [];
  const add = (key, pattern) => {
    if (pattern.test(question) && !requested.includes(key)) requested.push(key);
  };
  add("cost", /\b(?:cost|price|rp)\b/i);
  add("victoryPoints", /\b(?:victory points?|vp|worth|value)\b/i);
  add("health", /\b(?:health|hp)\b/i);
  add("defense", /\bdefen[cs]e(?:\s+die)?\b/i);
  add("attackDice", /\battack(?:\s+(?:die|dice))?\b/i);
  add("type", /\b(?:type|kind|class|category|habitat|zone)\b/i);
  if (requested.length < 2) return null;

  const statements = requested.map((key) => {
    if (key === "cost") return facts.cost === null || facts.cost === undefined
      ? "has no documented RP play cost"
      : `costs ${facts.cost} RP to play`;
    if (key === "victoryPoints") return facts.victoryPoints === null || facts.victoryPoints === undefined
      ? "has no documented printed VP"
      : `is worth ${facts.victoryPoints} VP while in play`;
    if (key === "health") return facts.health === null || facts.health === undefined
      ? "has no documented HP value"
      : `has ${facts.health} HP`;
    if (key === "defense") return facts.defense
      ? `uses ${facts.defense} for defense`
      : "has no documented defense die";
    if (key === "attackDice") return facts.attackDice
      ? `attacks with ${facts.attackDice}`
      : "has no documented attack die";
    return `is a ${cardType(facts)}`;
  });
  return {
    kind: "answer",
    title: rule.title,
    text: `${rule.title} ${statements.join("; it ")}.`,
    entity: rule.entity,
    sources: [sourceFor(rule)],
  };
}

function habitatComparisonAnswer(question, comparisonRule, rules) {
  const habitatNames = {
    deep: "Deep",
    ocean: "Oceanic",
    oceanic: "Oceanic",
    reef: "Reef",
  };
  const classNames = {
    apex: "Apex",
    "apex predator": "Apex",
    fish: "Fish",
    "filter feeder": "Filter Feeder",
    invertebrate: "Invertebrate",
    predator: "Predator",
  };
  const creatures = [...String(question).matchAll(/\b(reef|oceanic|ocean|deep)\s+(filter[ -]?feeder|invertebrate|apex(?:\s+predator)?|predator|fish)\b/gi)]
    .map((match) => {
      const habitat = habitatNames[match[1].toLowerCase()];
      const classKey = match[2].toLowerCase().replace(/[ -]+/g, " ");
      const creatureClass = classNames[classKey];
      return { habitat, creatureClass, label: `${habitat} ${creatureClass}` };
    })
    .filter((entry, index, values) => values.findIndex((candidate) => candidate.label === entry.label) === index);
  if (creatures.length < 2) return null;
  if (!/\b(?:difference|different|compare|comparison|versus|vs\.?|same|explain|slots?|targets?)\b/i.test(question)) return null;

  const slotOptions = {
    Fish: "Fish, Predator, or Apex slot",
    Predator: "Predator or Apex slot",
    Apex: "Apex slot",
    Invertebrate: "Invertebrate slot",
    "Filter Feeder": "Filter Feeder slot",
  };
  const placementRule = rules.find((rule) => /^Habitat and class matching for Reef Fish and Deep slots$/i.test(rule.title));
  const targetRule = rules.find((rule) => rule.id === "glossary:legal-target")
    ?? rules.find((rule) => /^Reading targets on attacks and abilities$/i.test(rule.title));
  const comparisonSource = comparisonRule
    ?? rules.find((rule) => /^Comparing Reef, Oceanic, and Deep creatures$/i.test(rule.title));
  const descriptions = creatures.map(({ habitat, creatureClass, label }) => {
    const acceptedSlot = slotOptions[creatureClass] ?? "matching class slot";
    return `${label} has the ${habitat} habitat and ${creatureClass} class, and normally uses a ${habitat} ${acceptedSlot}`;
  });
  const sameClass = creatures.every((entry) => entry.creatureClass === creatures[0].creatureClass);
  const sameHabitat = creatures.every((entry) => entry.habitat === creatures[0].habitat);
  const relationship = sameClass
    ? `Both are ${creatures[0].creatureClass} creatures, so they share the ${creatures[0].creatureClass} class but have different habitats.`
    : sameHabitat
      ? `They share the ${creatures[0].habitat} habitat but have different creature classes.`
      : "They differ by both habitat and creature class.";

  return {
    kind: "answer",
    title: creatures.length === 2
      ? `${creatures[0].label} vs. ${creatures[1].label}`
      : `Comparing ${joinList(creatures.map((entry) => entry.label))}`,
    text: `Habitat zone and class are separate checks. ${descriptions.join("; ")}. ${relationship} For placement, both habitat and an accepted class must match. For targeting, apply every family, habitat, controller, and card-text restriction; a class target such as Predator does not automatically include Fish or Apex, and a Deep restriction does not include Reef or Oceanic. Individual cards can still have different costs, dice, requirements, and abilities.`,
    sources: uniqueSources([comparisonSource, placementRule, targetRule].filter(Boolean).map(sourceFor)),
  };
}

function cardRuleById(rules, id) {
  return rules.find((rule) => rule.id === `card:${id}`);
}

function firstPrintedRule(rule, pattern = null) {
  const printed = rule?.facts?.printedRules ?? [];
  return printed.find((text) => !pattern || pattern.test(text)) ?? printed[0] ?? "";
}

function stunCoralStrategyAnswer(strategyRule, rules) {
  const stunners = rules.filter((rule) => rule.entity?.type === "card"
    && (rule.facts?.printedRules ?? []).some((text) => /\bopponent(?:'s|’s)?\b[\s\S]{0,80}\bcorals?\b[\s\S]{0,100}\bstunned\b|\bcorals?\b[\s\S]{0,80}\bnow stunned\b/i.test(text)));
  const examples = stunners.slice(0, 5).map((rule) => `${rule.title}: ${firstPrintedRule(rule, /\bstun|stunned\b/i)}`);
  const coralHeal = cardRuleById(rules, "coral-heal");
  const boundary = rules.find((rule) => /^Stunned boundary$/i.test(rule.title));
  const exampleText = examples.length
    ? ` In the current card data: ${examples.join(" ")}`
    : " Check the current card data for an Action or effect that explicitly says a Coral becomes Stunned.";
  const clearingText = coralHeal
    ? ` ${coralHeal.title} clears it because that Support removes all effects from one of your Corals.`
    : " A status-removal effect can clear it only if its printed text applies to that Coral.";

  return {
    kind: "answer",
    title: strategyRule.title,
    text: `A Coral becomes Stunned only when a printed card effect says it does; Stunned is not caused by ordinary attack damage.${exampleText}${clearingText} The current rules do not define an extra universal Stunned penalty or automatic expiration beyond those printed instructions.`,
    sources: uniqueSources([strategyRule, ...stunners.slice(0, 5), coralHeal, boundary].filter(Boolean).map(sourceFor)),
  };
}

function toxicStrategyAnswer(strategyRule, rules) {
  const toxicRule = rules.find((rule) => /^Toxic creatures$/i.test(rule.title));
  const poisonHeal = cardRuleById(rules, "poison-heal");
  const giantTriton = cardRuleById(rules, "giant-triton");
  const options = [
    poisonHeal ? `${poisonHeal.title} makes your next attack ignore Toxic effects.` : null,
    giantTriton ? `${giantTriton.title} has source-specific immunity to Crown of Thorns's Toxic effect.` : null,
    "A non-consuming attack or effect can defeat a Toxic When Eaten creature without triggering its when-eaten consequence.",
  ].filter(Boolean);

  return {
    kind: "answer",
    title: strategyRule.title,
    text: `Toxic does not make the creature immune to being defeated. First read its exact trigger. If it says Toxic When Eaten, it triggers only when the attacker consumes that card; if it says to flip when targeted, resolve that flip before the attack. Your grounded options are: ${options.join(" ")} Then resolve the attack or removal effect normally.`,
    sources: uniqueSources([strategyRule, toxicRule, poisonHeal, giantTriton].filter(Boolean).map(sourceFor)),
  };
}

function coralProtectionStrategyAnswer(strategyRule, rules) {
  const boostCards = [
    cardRuleById(rules, "sea-urchin"),
    cardRuleById(rules, "sargeant-major"),
    cardRuleById(rules, "boulder-star-coral-stage-2"),
  ].filter(Boolean);
  const repairCards = [
    cardRuleById(rules, "coral-cement"),
    cardRuleById(rules, "green-sea-turtle"),
    cardRuleById(rules, "deep_mushroom_stage2"),
  ].filter(Boolean);
  const upgradeRule = rules.find((rule) => /^Coral upgrades$/i.test(rule.title));
  const boostText = boostCards.length
    ? boostCards.map((rule) => `${rule.title}: ${firstPrintedRule(rule, /\b(?:add|gain|corals?).*\+?\d+\s*HP|\+?\d+\s*HP.*coral/i)}`).join(" ")
    : "Use printed effects that add maximum HP to a Coral.";
  const repairText = repairCards.length
    ? repairCards.map((rule) => `${rule.title}: ${firstPrintedRule(rule, /\b(?:heal|restore)\b/i)}`).join(" ")
    : "Use printed healing effects after the Coral takes damage.";

  return {
    kind: "answer",
    title: strategyRule.title,
    text: `Use two layers of protection. Before attacks, increase maximum HP: ${boostText} After damage, repair it: ${repairText} Upgrading may raise maximum HP, but existing damage remains. These effects help Coral survive; they do not prevent an attack from being declared unless a card explicitly says so.`,
    sources: uniqueSources([strategyRule, ...boostCards, ...repairCards, upgradeRule].filter(Boolean).map(sourceFor)),
  };
}

function creatureSchoolProtectionStrategyAnswer(strategyRule, rules) {
  const oceanTriggerfish = cardRuleById(rules, "ocean-triggerfish");
  const schoolRule = rules.find((rule) => /^Creature Schools and bait balls$/i.test(rule.title));
  const targetRule = rules.find((rule) => /^Reading targets on attacks and abilities$/i.test(rule.title));
  const territorial = firstPrintedRule(oceanTriggerfish, /\bTerritorial\b|Creature Schools?.*\+10 HP/i);
  return {
    kind: "answer",
    title: strategyRule.title,
    text: `A Creature School does not roll defense, so protect it by increasing HP and limiting the attacks it faces. In the current card data, Ocean Triggerfish is the direct protection card: ${territorial || "Territorial gives one of your Creature Schools +10 HP while Ocean Triggerfish is in play."} Creature Schools can be targeted by attacks that can target Fish, and each attack deals its roll multiplied by 10 as damage. That makes repeated attacks especially dangerous, so pressure or remove repeat attackers before they can attack again and avoid relying on one fragile School. Coral-only healing and Coral-only HP bonuses do not apply unless their text explicitly includes Foundations or Creature Schools.`,
    sources: uniqueSources([strategyRule, oceanTriggerfish, schoolRule, targetRule].filter(Boolean).map(sourceFor)),
  };
}

function strategyIntentAnswer(intentRule, rules) {
  if (!intentRule) return null;
  if (/^How a Coral becomes Stunned$/i.test(intentRule.title)) return stunCoralStrategyAnswer(intentRule, rules);
  if (/^Playing around Toxic$/i.test(intentRule.title)) return toxicStrategyAnswer(intentRule, rules);
  if (/^Protecting Coral from attacks$/i.test(intentRule.title)) return coralProtectionStrategyAnswer(intentRule, rules);
  if (/^Protecting Creature Schools from attacks$/i.test(intentRule.title)) return creatureSchoolProtectionStrategyAnswer(intentRule, rules);
  return null;
}

function schoolDensityNotationAnswer(question, rules) {
  const match = String(question).match(/\b(\d+)\s*(?:sd|school density)\b/i);
  if (!match || !/\b(?:mean|means|written|number|require|need|card|play|what|why)\b/i.test(question)) return null;
  const amount = Number(match[1]);
  const densityRule = rules.find((rule) => /^School Density requirements$/i.test(rule.title));
  const glossaryRule = rules.find((rule) => rule.id === "glossary:school-density");
  const matchingCards = rules.filter((rule) => rule.entity?.type === "card" && rule.facts?.schoolDensityRequirement === amount);
  const examples = matchingCards.length
    ? ` In the current card data, ${joinList(matchingCards.slice(0, 3).map((rule) => rule.title))} ${matchingCards.length === 1 ? "uses" : "use"} that requirement.`
    : "";
  return {
    kind: "answer",
    title: `${amount} SD requirement`,
    text: `SD means School Density. ${amount} SD on a card's play requirement means your ecosystem must currently have at least ${amount} School Density before you can play that card. School Density is checked, not spent like RP, so it remains after the card is played; you must still pay the card's RP cost and meet its other printed requirements.${examples}`,
    sources: uniqueSources([densityRule, glossaryRule, ...matchingCards.slice(0, 3)].filter(Boolean).map(sourceFor)),
  };
}

function coreQuantityAnswer(question, rules) {
  const mentionsHand = /\bhand\b|\bhold\b[\s\S]{0,30}\bcards?\b|\bcards?\b[\s\S]{0,30}\bhold\b/i.test(question);
  const asksHandLimit = mentionsHand
    && /\b(?:how many|maximum|max|limit|size|allowed|hold|more than|keep)\b/i.test(question);
  const asksRp = /\b(?:rp|resource points?)\b/i.test(question);
  if (mentionsHand && asksRp && /\b(?:same|full|limit|cap|collect|prevent|cannot|can't)\b/i.test(question)) {
    const handRule = rules.find((rule) => /^Hand limits and overflow$/i.test(rule.title));
    const handGlossary = rules.find((rule) => rule.id === "glossary:hand");
    const bankRule = rules.find((rule) => rule.id === "glossary:rp-bank");
    return {
      kind: "answer",
      title: "Hand limits and RP are separate",
      text: "No. An RP bank cap limits RP, while a hand limit controls cards. A full hand never prevents you from collecting RP, and the normal game has no fixed hand limit unless a Condition sets one.",
      sources: uniqueSources([bankRule, handRule, handGlossary].filter(Boolean).map(sourceFor)),
    };
  }
  if (asksHandLimit && !/\bhost(?:ed|ing|s)?\b/i.test(question)) {
    const handRule = rules.find((rule) => /^Hand limits and overflow$/i.test(rule.title));
    const handGlossary = rules.find((rule) => rule.id === "glossary:hand");
    const asksMoreThanSeven = /\bmore than\s+7\b|\bmore than seven\b/i.test(question);
    return {
      kind: "answer",
      title: "Default hand limit",
      text: `${asksMoreThanSeven ? "Yes. " : ""}There is no fixed hand limit by default, so you may normally hold more than 7 cards. If a Condition sets a temporary hand limit, keep only up to that current limit and put overflow into discard.`,
      sources: uniqueSources([handRule, handGlossary].filter(Boolean).map(sourceFor)),
    };
  }

  if (!asksRp) return null;
  const collectingRule = rules.find((rule) => /^Collecting RP$/i.test(rule.title));
  const bankRule = rules.find((rule) => rule.id === "glossary:rp-bank");
  const collectGlossary = rules.find((rule) => rule.id === "glossary:collect");
  const asksCap = /\b(?:max(?:imum)?|cap|limit|hold|at once|over\s+8|beyond)\b/i.test(question);
  if (asksCap) {
    return {
      kind: "answer",
      title: "RP collection and bank cap",
      text: "The default RP bank cap is 8, although a card or Condition can change it. Your Collect amount is 1 RP plus RP from active Foundations and modifiers; any RP above the active cap is lost (discarded).",
      sources: uniqueSources([collectingRule, bankRule, collectGlossary].filter(Boolean).map(sourceFor)),
    };
  }
  const asksCollectionAmount = /\b(?:collect|gain|get|income)\b/i.test(question)
    && /\b(?:how many|how much|amount|same|normal|work out|turn|collect)\b/i.test(question);
  if (!asksCollectionAmount) return null;
  const asksAlwaysSame = /\b(?:always|same amount)\b/i.test(question);
  return {
    kind: "answer",
    title: "RP collected each turn",
    text: `${asksAlwaysSame ? "No. " : ""}There is no single fixed amount. During Collect, add 1 RP plus all RP produced by your active Foundations, apply card and Condition modifiers, then enforce the current RP bank cap (8 by default).`,
    sources: uniqueSources([collectingRule, bankRule, collectGlossary].filter(Boolean).map(sourceFor)),
  };
}

function namedAbilityEconomyAnswer(question, namedAbility, rules) {
  if (!namedAbility || !/^Eco\s*Boost$/i.test(namedAbility.title)) return null;
  if (!/\b(?:rp|resource|bank|cap|max(?:imum)?|room)\b/i.test(question)) return null;
  const amounts = [...new Set((namedAbility.variants ?? [])
    .flatMap((variant) => [...String(variant).matchAll(/\+(\d+)\b/g)].map((match) => Number(match[1])))
    .filter(Number.isFinite))]
    .sort((a, b) => a - b);
  const amountText = amounts.length
    ? `The current printed versions raise it by ${joinList(amounts.map((amount) => `+${amount}`))}, depending on the card.`
    : "Use the amount printed on that card.";
  const bankRule = rules.find((rule) => rule.id === "glossary:rp-bank");
  return {
    kind: "answer",
    title: `${namedAbility.title} and the RP bank cap`,
    text: `Yes. ${namedAbility.title} is a Passive that increases your RP bank cap while its card remains in play. ${amountText} It increases how much RP you may hold; it does not give you RP immediately.`,
    entity: namedAbility.entity,
    sources: uniqueSources([...sourcesFor(namedAbility), bankRule ? sourceFor(bankRule) : null].filter(Boolean)),
  };
}

function isCoralPlacementQuestion(question) {
  if (!/\bcorals?\b/i.test(question)) return false;
  if (/\b(?:foundation|pals|conditions?)\s+deck\b/i.test(question)) return false;
  if (/\b(?:damage|damaged|max(?:imum)?\s+hp|health)\b/i.test(question)) return false;
  return /\b(?:card|creature|fish|predator|apex|invertebrate)\b[\s\S]{0,65}\b(?:play\w*|place\w*|fit\w*|go|attach\w*)\b[\s\S]{0,35}\bcorals?\b/i.test(question)
    || /\b(?:play\w*|place\w*|fit\w*|go|attach\w*)\b[\s\S]{0,35}\b(?:on|onto|into|in|to)\b[\s\S]{0,60}\bcorals?\b/i.test(question)
    || /\b(?:open\s+)?slots?\b[\s\S]{0,35}\bcorals?\b/i.test(question)
    || /\bcoral(?:'s)?\s+(?:creature\s+)?slots?\b/i.test(question)
    || /\bcoral(?:'s)?\b[\s\S]{0,65}\b(?:creature|fish|predator|apex|invertebrate)\b[\s\S]{0,30}\b(?:legal|fit\w*|play\w*|place\w*|go)\b/i.test(question);
}

function acceptedSlotLabelsForClass(creatureClass) {
  return {
    apex: ["Apex"],
    fish: ["Fish", "Predator", "Apex"],
    predator: ["Predator", "Apex"],
    invertebrate: ["Invertebrate"],
    filter_feeder: ["Filter Feeder"],
  }[creatureClass] ?? [titleCase(creatureClass)];
}

function coralSlotSummary(coralRule) {
  const groups = new Map();
  for (const slot of coralRule?.facts?.slots ?? []) {
    const zone = titleCase(slot.zone || "reef");
    const slotClass = titleCase(slot.slotClass ?? slot.slotType ?? "creature");
    const key = `${zone} ${slotClass}`;
    groups.set(key, (groups.get(key) ?? 0) + Number(slot.count ?? 1));
  }
  return [...groups.entries()].map(([label, count]) => ({ label, count }));
}

function coralPlacementAnswer(question, explicitCards, rules) {
  if (!isCoralPlacementQuestion(question)) return null;
  const creature = explicitCards.find((rule) => rule.facts?.kind === "creature");
  const coral = explicitCards.find((rule) => rule.facts?.kind === "coral");
  const placementRule = rules.find((rule) => /^Habitat and class matching for Reef Fish and Deep slots$/i.test(rule.title));
  const slotsRule = rules.find((rule) => rule.id === "glossary:slots");
  const upgradeRule = rules.find((rule) => rule.id === "glossary:upgrade");
  const hostedRule = rules.find((rule) => rule.id === "glossary:hosted-cards");

  if (creature && coral) {
    const slots = coral.facts?.slots ?? [];
    const matches = slots.filter((slot) => {
      const zoneMatches = !slot.zone || slot.zone === creature.facts.zone;
      const acceptsClass = (slot.accepts ?? []).includes(creature.facts.class);
      const acceptsCategory = (slot.acceptsCategories ?? []).includes(creature.facts.category);
      return zoneMatches && (acceptsClass || acceptsCategory);
    });
    const summaries = coralSlotSummary(coral);
    const suppliedSlots = summaries.length
      ? joinList(summaries.map(({ label, count }) => `${count} ${label} slot${count === 1 ? "" : "s"}`))
      : "no documented creature slots";
    const creatureType = `${titleCase(creature.facts.zone)} ${titleCase(creature.facts.class)}`;
    const alternatives = acceptedSlotLabelsForClass(creature.facts.class)
      .map((slotClass) => `${titleCase(creature.facts.zone)} ${slotClass}`);
    return {
      kind: "answer",
      title: `${creature.title} placement on ${coral.title}`,
      text: matches.length
        ? `Yes, if a matching slot is open. ${creature.title} is a ${creatureType} creature, and ${coral.title} provides ${suppliedSlots}. It may use the ${joinList(matches.map((slot) => `${titleCase(slot.zone || creature.facts.zone)} ${titleCase(slot.slotClass ?? slot.slotType)} slot`))} because both its habitat zone and accepted class match.`
        : `No. ${creature.title} is a ${creatureType} creature, while ${coral.title} provides ${suppliedSlots}. Those slots do not accept its class in the required habitat zone. ${creature.title} needs an open ${joinList(alternatives)} slot unless printed card text grants a specific exception.`,
      entity: creature.entity,
      sources: uniqueSources([creature, coral, placementRule, slotsRule].filter(Boolean).map(sourceFor)),
    };
  }

  return {
    kind: "answer",
    title: "Playing a card on or into a Coral",
    text: "Check which kind of placement the card uses. 1. A creature is played into an open creature slot supplied by the Coral only when its habitat zone matches an accepted class shown by that slot. 2. A Coral upgrade is the next stage of that same Coral line; satisfy its requirements, pay its cost, and place it over the preceding stage. 3. An attachment or special placement is legal only when printed text explicitly allows that card and host. Matching the habitat alone is not enough, and other card kinds are not automatically placed on a Coral.",
    sources: uniqueSources([placementRule, slotsRule, upgradeRule, hostedRule].filter(Boolean).map(sourceFor)),
  };
}

function directCoralDamageValue(text) {
  if (!/\bcorals?\b/i.test(text) || !/\bdamage\b/i.test(text)) return null;
  const values = [];
  for (const match of String(text).matchAll(/\b(\d*)\s*D(\d+)\s*(?:[xX*]|Ã—|×)\s*(\d+)\b/gi)) {
    values.push(Number(match[1] || 1) * Number(match[2]) * Number(match[3]));
  }
  for (const match of String(text).matchAll(/\b(\d+)\s*HP(?:\s+of)?\s+damage\b/gi)) values.push(Number(match[1]));
  for (const match of String(text).matchAll(/\b(?:inflict|deal)\s+(\d+)\s*HP\b/gi)) values.push(Number(match[1]));
  return values.length ? Math.max(...values) : null;
}

function coralDamageSuperlativeAnswer(question, rules) {
  const forward = String(question).match(/\b(?:most|highest|maximum|max|biggest|strongest)\b[\s\S]{0,50}\b(?:damag\w*|hit|hurt)/i);
  const reverse = String(question).match(/\b(?:damag\w*|hit|hurt\w*)\b[\s\S]{0,50}\b(?:most|highest|maximum|max|biggest|strongest)\b/i);
  const asksSuperlative = /\bcorals?\b/i.test(question)
    && [forward, reverse].some((match) => match && !/\bHP\b/i.test(match[0]));
  if (!asksSuperlative) return null;
  const candidates = rules
    .filter((rule) => rule.entity?.type === "card")
    .flatMap((rule) => (rule.facts?.printedRules ?? []).map((printedRule) => ({
      rule,
      printedRule,
      damage: directCoralDamageValue(printedRule),
    })))
    .filter((entry) => Number.isFinite(entry.damage));
  if (!candidates.length) return null;
  const maximum = Math.max(...candidates.map((entry) => entry.damage));
  const leaders = candidates.filter((entry) => entry.damage === maximum);
  const names = [...new Set(leaders.map((entry) => entry.rule.title))];
  const first = leaders[0];
  const ability = String(first.printedRule).match(/^([^:]{2,64}):/)?.[1]?.trim();
  return {
    kind: "answer",
    title: "Highest direct Coral damage",
    text: `${joinList(names)} has the highest documented direct Coral damage in the current card data: ${ability ? `${ability} deals` : "it deals"} ${maximum} HP to an opponent's Coral in one printed effect. This comparison counts the direct Coral-damage instruction, not separate follow-up attacks against creatures.`,
    entity: first.rule.entity,
    sources: uniqueSources(leaders.map((entry) => sourceFor(entry.rule))),
  };
}

function compoundDeckRoutingAnswer(question, rules) {
  if (!/\b(?:and|both|each)\b/i.test(question)) return null;
  const deckMatch = String(question).match(/\b(foundations? deck|foundation cards?|pals? deck|conditions? deck)\b/i);
  if (!deckMatch) return null;
  const askedDeck = /foundation/i.test(deckMatch[1])
    ? "Foundation Deck"
    : /condition/i.test(deckMatch[1])
      ? "Conditions Deck"
      : "Pals Deck";
  const subjects = [
    { label: "Corals", pattern: /\bcorals?\b/i, deck: "Foundation Deck", conceptId: "glossary:coral" },
    { label: "Creature Schools", pattern: /\bcreature schools?\b/i, deck: "Foundation Deck", conceptId: "glossary:creature-school" },
    { label: "Support cards", pattern: /\bsupport cards?\b/i, deck: "Pals Deck", conceptId: "glossary:support" },
    { label: "Habitat cards", pattern: /\bhabitat cards?\b/i, deck: "Pals Deck", conceptId: "glossary:habitat" },
    { label: "regular creatures", pattern: /\bregular creatures?\b/i, deck: "Pals Deck", conceptId: "glossary:pals-deck" },
    { label: "Conditions", pattern: /\bconditions?\b(?!\s+deck)/i, deck: "Conditions Deck", conceptId: "glossary:condition" },
  ].filter((subject) => subject.pattern.test(question));
  if (subjects.length < 2) return null;
  const allMatch = subjects.every((subject) => subject.deck === askedDeck);
  const routingRule = rules.find((rule) => /^Foundation and Pals deck routing$/i.test(rule.title));
  const conceptRules = subjects
    .map((subject) => rules.find((rule) => rule.id === subject.conceptId))
    .filter(Boolean);
  return {
    kind: "answer",
    title: `${askedDeck} contents`,
    text: `${allMatch ? "Yes" : "No"}. ${subjects.map((subject) => `${subject.label} go in the ${subject.deck}`).join("; ")}.`,
    sources: uniqueSources([routingRule, ...conceptRules].filter(Boolean).map(sourceFor)),
  };
}

function deckSubjects(question) {
  return [
    { label: "Corals", pattern: /\bcorals?\b/i, deck: "Foundation Deck", conceptId: "glossary:coral" },
    { label: "Creature Schools", pattern: /\bcreature schools?\b/i, deck: "Foundation Deck", conceptId: "glossary:creature-school" },
    { label: "Support cards", pattern: /\bsupport cards?\b/i, deck: "Pals Deck", conceptId: "glossary:support" },
    { label: "Habitat cards", pattern: /\bhabitat cards?\b/i, deck: "Pals Deck", conceptId: "glossary:habitat" },
    { label: "regular creatures", pattern: /\bregular creatures?\b/i, deck: "Pals Deck", conceptId: "glossary:pals-deck" },
    { label: "Conditions", pattern: /\bconditions?\b(?!\s+deck)/i, deck: "Conditions Deck", conceptId: "glossary:condition" },
  ].filter((subject) => subject.pattern.test(question));
}

function contextualDeckRoutingAnswer(question, rules, context = {}) {
  if (!context.lastQuestion || !/\b(?:there|same deck|too|also)\b/i.test(question)) return null;
  const previous = deckSubjects(context.lastQuestion ?? "");
  const current = deckSubjects(question);
  if (previous.length !== 1 || current.length !== 1) return null;
  const sameDeck = previous[0].deck === current[0].deck;
  const routingRule = rules.find((rule) => /^Foundation and Pals deck routing$/i.test(rule.title));
  const concepts = [previous[0], current[0]]
    .map((subject) => rules.find((rule) => rule.id === subject.conceptId))
    .filter(Boolean);
  return {
    kind: "answer",
    title: "Deck routing follow-up",
    text: `${sameDeck ? "Yes" : "No"}. ${previous[0].label} go in the ${previous[0].deck}; ${current[0].label} go in the ${current[0].deck}.`,
    sources: uniqueSources([routingRule, ...concepts].filter(Boolean).map(sourceFor)),
  };
}

function contextualSchoolDensityAnswer(question, rules, context = {}) {
  const densityWasActive = (context.lastRuleIds ?? []).some((id) => id === "glossary:school-density" || /school-density-requirements$/.test(id));
  if (!densityWasActive || !/\b(?:lose|spend|spent|use up|remain|left|after (?:i |you )?play)\b/i.test(question)) return null;
  const amount = String(context.lastQuestion ?? "").match(/\b(\d+)\s*(?:sd|school density)\b/i)?.[1];
  const densityRule = rules.find((rule) => /^School Density requirements$/i.test(rule.title));
  const glossary = rules.find((rule) => rule.id === "glossary:school-density");
  return {
    kind: "answer",
    title: "School Density is not spent",
    text: `No. School Density${amount ? `, including that ${amount} SD threshold,` : ""} is checked when you play the card, not spent. Your School Density remains afterward unless another card or Condition changes it. You still pay the card's RP cost separately.`,
    sources: uniqueSources([glossary, densityRule].filter(Boolean).map(sourceFor)),
  };
}

function contextualDiceResultAnswer(question, context = {}) {
  if (!(context.lastRuleIds ?? []).includes("how-to:dice-reference")
    || !/\b(?:highest|maximum|max|lowest|minimum|min|range|possible result)\b/i.test(question)) return null;
  const match = String(context.lastQuestion ?? "").match(/\b(\d+)?\s*D(\d+)(?:\s*([+-])\s*(\d+))?(?:\s*(?:[xX×*])\s*(\d+))?\b/i);
  if (!match) return null;
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(`${match[3]}${match[4]}`) : 0;
  const multiplier = Number(match[5] || 1);
  const minimum = Math.max(0, count + modifier) * multiplier;
  const maximum = Math.max(0, count * sides + modifier) * multiplier;
  const asksMinimum = /\b(?:lowest|minimum|min)\b/i.test(question);
  const asksRange = /\brange\b/i.test(question);
  const text = asksRange
    ? `The possible final results run from ${minimum} through ${maximum}.`
    : asksMinimum
      ? `The lowest possible final result is ${minimum}.`
      : `The highest possible final result is ${maximum}.`;
  return {
    kind: "answer",
    title: "Dice result range",
    text,
    sources: [{ id: "how-to:dice-reference", label: "How to Play — Dice Reference", href: "/instructions" }],
  };
}

function rollModifierAnswer(question, rules) {
  if (/\b(?:advantage|disadvantage)\b/i.test(question)) return null;
  const statMatch = String(question).match(/\b(defen[cs]e|attack|roll)\b/i);
  const modifierMatch = String(question).match(/([+\-\u2212])\s*(\d+)/);
  if (!statMatch || !modifierMatch || !/\b(?:mean|work|apply|do|calculate|figure)\b/i.test(question)) return null;

  const amount = Number(modifierMatch[2]);
  const subtract = modifierMatch[1] !== "+";
  const stat = /defen/i.test(statMatch[1]) ? "Defense" : /attack/i.test(statMatch[1]) ? "Attack" : "Roll";
  const operation = subtract ? `subtract ${amount} from` : `add ${amount} to`;
  const exampleStart = amount + 5;
  const exampleEnd = subtract ? 5 : exampleStart + amount;
  const diceRule = rules.find((rule) => /^What D4, D6, D8, D10, D12, and D20 mean$/i.test(rule.title));
  const statRule = stat === "Defense"
    ? rules.find((rule) => rule.id === "glossary:defense")
    : rules.find((rule) => /^How normal attacks resolve$/i.test(rule.title));
  return {
    kind: "answer",
    title: `${stat} ${subtract ? `-${amount}` : `+${amount}`} modifier`,
    text: `A ${subtract ? "-" : "+"}${amount} ${stat} modifier means roll the printed die normally, then ${operation} the ${stat.toLowerCase()} roll total. It changes the final total, not the die size. For example, a roll of ${exampleStart} becomes ${exampleEnd}. Modified totals cannot fall below zero.`,
    sources: uniqueSources([diceRule, statRule].filter(Boolean).map(sourceFor)),
  };
}

function attackCountSymbol(question) {
  const match = String(question).match(/(?:\b[xX]\s*(\d+)\b|\u00d7\s*(\d+)\b|\b(\d+)\s*[xX]\b)/);
  return match ? Number(match[1] ?? match[2] ?? match[3]) : null;
}

function printedAttackSequence(cardRule) {
  for (const printedRule of cardRule?.facts?.printedRules ?? []) {
    const match = String(printedRule).match(/\bPerform\s+(\d+)\s+(D\d+(?:\s*[+\-]\s*\d+)?)\s+attacks?\s+targeting\s+([^.]+)\.?/i);
    if (!match) continue;
    const defenseModifier = String(printedRule).match(/Defending\s+([^.]+?)\s+have\s+([+\-]\d+)\s+Defense/i);
    return {
      count: Number(match[1]),
      die: match[2].replace(/\s+/g, ""),
      target: match[3].trim(),
      defenseModifier: defenseModifier
        ? { target: defenseModifier[1].trim(), value: defenseModifier[2] }
        : null,
    };
  }
  return null;
}

function numberWord(value) {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][value] ?? String(value);
}

function attackCountAnswer(question, cardRule, rules) {
  const shownCount = attackCountSymbol(question);
  const sequence = printedAttackSequence(cardRule);
  if (!shownCount || (!sequence && !/\battacks?\b/i.test(question))) return null;
  const count = sequence?.count ?? shownCount;
  const attackCountRule = rules.find((rule) => rule.id === "glossary:attack-count")
    ?? rules.find((rule) => /^Attack-count symbols/i.test(rule.title));
  const attackCountSymbolsRule = rules.find((rule) => /^Attack-count symbols such as x2 and x4$/i.test(rule.title));
  const repeatedRule = rules.find((rule) => /^Repeated attacks$/i.test(rule.title) && rule.source !== "glossary");
  const printedDetails = sequence
    ? ` ${cardRule.title}'s printed attack makes ${numberWord(sequence.count)} ${sequence.die} attacks targeting ${sequence.target}.`
    : "";
  const defenseDetails = sequence?.defenseModifier
    ? ` Defending ${sequence.defenseModifier.target} have ${sequence.defenseModifier.value} Defense against those attacks.`
    : "";
  return {
    kind: "answer",
    title: cardRule ? `${cardRule.title}'s x${shownCount} attack count` : `x${shownCount} attack count`,
    text: `The x${shownCount} is an attack count: resolve ${numberWord(count)} separate attacks (${count} total), not one attack multiplied by ${shownCount}.${printedDetails} Each attack gets its own legal target and its own rolls, and the same physical target cannot be selected twice in that sequence.${defenseDetails}`,
    entity: cardRule?.entity,
    sources: uniqueSources([cardRule, attackCountSymbolsRule, attackCountRule, repeatedRule].filter(Boolean).map(sourceFor)),
  };
}

function placementAnswer(question, rule, rules) {
  const q = normalize(question);
  const facts = rule.facts ?? {};
  const placementQuery = normalize(q.replace(normalize(rule.title), " "));
  const slotMatch = placementQuery.match(/\b(filter feeder|invertebrate|predator|apex|fish)\s+slot\b/);
  const zoneMatches = [...placementQuery.matchAll(/\b(reef|ocean|oceanic|deep)\b/g)];
  const zoneMatch = zoneMatches.at(-1);
  if (!slotMatch) {
    return {
      kind: "answer",
      title: rule.title,
      text: `${rule.title} is a ${cardType(facts)}. Its destination must match both the slot's habitat zone and the classes that slot accepts.`,
      entity: rule.entity,
      sources: placementSources(rule, rules),
    };
  }

  const slotClass = slotMatch[1].replace(" ", "_");
  const accepted = {
    apex: ["fish", "predator", "apex"],
    filter_feeder: ["filter_feeder"],
    fish: ["fish"],
    invertebrate: ["invertebrate"],
    predator: ["fish", "predator"],
  }[slotClass] ?? [slotClass];
  const requestedZone = zoneMatch?.[1] === "oceanic" ? "ocean" : zoneMatch?.[1];
  const classFits = accepted.includes(facts.class);
  const zoneFits = !requestedZone || requestedZone === facts.zone;

  if (classFits && zoneFits) {
    const condition = requestedZone
      ? `because its ${titleCase(facts.zone)} habitat and ${titleCase(facts.class)} class both match`
      : `provided that the slot is also in the ${titleCase(facts.zone)} habitat`;
    return {
      kind: "answer",
      title: `${rule.title} placement`,
      text: `Yes. ${rule.title} can use that ${titleCase(slotClass)} slot ${condition}.`,
      entity: rule.entity,
      sources: placementSources(rule, rules),
    };
  }

  const reason = !zoneFits
    ? `${rule.title} is ${titleCase(facts.zone)}, not ${titleCase(requestedZone)}`
    : `a ${titleCase(slotClass)} slot does not accept the ${titleCase(facts.class)} class`;
  return {
    kind: "answer",
    title: `${rule.title} placement`,
    text: `No. ${reason}. A creature has to match both the slot's habitat and an accepted class.`,
    entity: rule.entity,
    sources: placementSources(rule, rules),
  };
}

function placementSources(cardRule, rules) {
  const placementRule = rules.find((rule) => /Habitat and class matching/i.test(rule.title))
    ?? rules.find((rule) => /Playing Pals into slots/i.test(rule.title));
  return [cardRule, placementRule].filter(Boolean).map(sourceFor);
}

function uniqueRules(rules) {
  const seen = new Set();
  return rules.filter((rule) => {
    if (!rule?.id || seen.has(rule.id)) return false;
    seen.add(rule.id);
    return true;
  });
}

function requestedFactField(question) {
  const q = normalize(question);
  if (/\b(cost|rp)\b/.test(q)) return { key: "cost", label: "RP cost" };
  if (/\b(victory|vp|points?)\b/.test(q)) return { key: "victoryPoints", label: "Victory Points" };
  if (/\b(health|hp)\b/.test(q)) return { key: "health", label: "HP" };
  if (/\bdefen[cs]e\b/.test(q)) return { key: "defense", label: "defense die" };
  if (/\battack(?:\s+(?:die|dice))?\b/.test(q)) return { key: "attackDice", label: "attack die" };
  return null;
}

function missingScenarioFacts(question, cardRules, roles = {}) {
  const requested = requestedFactField(question);
  if (!requested || cardRules.length < 2) return [];
  const requirements = /\battack(?:s|ing)?\b/i.test(question) && roles.attackerId && roles.defenderId
    ? cardRules.flatMap((rule) => {
      if (rule.entity.id === roles.attackerId) return [{ rule, key: "attackDice", label: "attack die" }];
      if (rule.entity.id === roles.defenderId) return [{ rule, key: "defense", label: "defense die" }];
      return [];
    })
    : cardRules.map((rule) => ({ rule, ...requested }));
  return requirements.filter(({ rule, key }) => {
    const value = rule.facts?.[key];
    return value === null || value === undefined || value === "";
  }).map(({ rule, label }) => `${rule.title}'s ${label}`);
}

function conflictingRules(rules) {
  const groups = new Map();
  for (const rule of rules) {
    if (!rule.conflictKey || rule.conflictValue === undefined) continue;
    const group = groups.get(rule.conflictKey) ?? [];
    group.push(rule);
    groups.set(rule.conflictKey, group);
  }
  for (const group of groups.values()) {
    if (new Set(group.map((rule) => JSON.stringify(rule.conflictValue))).size > 1) return group;
  }
  return [];
}

function concise(text, maxLength = 280) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  let result = "";
  for (const sentence of sentences) {
    if (`${result} ${sentence}`.trim().length > maxLength) break;
    result = `${result} ${sentence}`.trim();
  }
  return result || `${clean.slice(0, maxLength - 1).trim()}…`;
}

function cardScenarioText(question, rule) {
  const facts = rule.facts ?? {};
  const requested = requestedFactField(question);
  if (requested && facts[requested.key] !== null && facts[requested.key] !== undefined && facts[requested.key] !== "") {
    const value = facts[requested.key];
    const suffix = {
      attackDice: `attacks with ${value}`,
      cost: `costs ${value} RP`,
      defense: `defends with ${value}`,
      health: `has ${value} HP`,
      victoryPoints: `is worth ${value} VP while in play`,
    }[requested.key];
    return `${rule.title} ${suffix}.`;
  }
  return concise(rule.text, 230);
}

function scenarioAnswer(question, cardRules, rules, context, roles) {
  const missing = missingScenarioFacts(question, cardRules, roles);
  if (missing.length) {
    const result = {
      kind: "clarification",
      title: "The current sources are incomplete",
      text: `I can identify the cards, but the current card data does not document ${joinList(missing)}. I need that printed value or an official ruling before I can resolve this interaction without guessing.`,
      options: [],
      sources: cardRules.map(sourceFor),
    };
    result.context = nextContext(question, result, context, cardRules, roles);
    return result;
  }

  const supporting = scenarioSupportingRules(question, cardRules, rules);
  const conflicts = conflictingRules(supporting);
  if (conflicts.length) {
    const result = {
      kind: "clarification",
      title: "The current sources disagree",
      text: `I found conflicting published values for ${conflicts[0].conflictKey}. I won't choose one silently; please confirm which edition or ruling applies.`,
      options: conflicts.map((rule) => rule.sourceLabel ?? rule.title),
      sources: conflicts.map(sourceFor),
    };
    result.context = nextContext(question, result, context, cardRules, roles);
    return result;
  }

  const pieces = supporting.map((rule) =>
    rule.entity?.type === "card"
      ? `${rule.title}: ${cardScenarioText(question, rule)}`
      : `${rule.title}: ${concise(rule.text)}`,
  );
  const result = {
    kind: "answer",
    title: "How these rules work together",
    text: `Here is the grounded interaction. ${pieces.join(" ")} ${scenarioConclusion(question, cardRules)}`,
    entity: cardRules.at(-1)?.entity,
    sources: supporting.map(sourceFor),
  };
  result.context = nextContext(question, result, context, cardRules, roles);
  return result;
}

function scenarioSupportingRules(question, cardRules, rules) {
  const supporting = [...cardRules];
  const normalizedQuestion = ` ${normalize(question)} `;
  const addTitle = (pattern) => {
    const rule = rules.find((candidate) => pattern.test(candidate.title) && candidate.source !== "glossary")
      ?? rules.find((candidate) => pattern.test(candidate.title));
    if (rule) supporting.push(rule);
  };

  const namedAbility = findNamedAbility(question, rules, cardRules);
  if (namedAbility) supporting.push(namedAbility);
  for (const rule of rules) {
    const conflictKey = normalize(rule.conflictKey);
    if (conflictKey && normalizedQuestion.includes(` ${conflictKey} `)) supporting.push(rule);
  }
  if (/\b(?:placement|slots?|habitat matching|placement rules)\b/i.test(question)) {
    addTitle(/^Habitat and class matching for Reef Fish and Deep slots$/i);
  }
  if (/\b(?:combat|attack rules?|attacker|defender|versus|vs\.?)\b/i.test(question)) {
    addTitle(/^How (?:normal attacks resolve|attacking works)$/i);
  }
  if (/\b(?:condition|this round|during the round)\b/i.test(question)) {
    addTitle(/^What Conditions cards are used for$/i);
  }
  if (/\b(?:upgrades?|upgrading)\b/i.test(question)) addTitle(/^Coral upgrades$/i);
  if (/\bhand limits?\b/i.test(question)) addTitle(/^Hand limits and overflow$/i);
  if (/\bdiscard rules?\b/i.test(question)) addTitle(/^Searching and recovering cards$/i);
  if (/\bsupport resolution\b/i.test(question)) addTitle(/^Support cards$/i);
  if (/\bschool density\b/i.test(question)) addTitle(/^School Density requirements$/i);
  if (/\bmaintenance\b/i.test(question)) addTitle(/^Coral Reef Habitat maintenance$/i);
  if (/\bdeep combat\b/i.test(question)) addTitle(/^Deep creatures and Abyss$/i);

  return uniqueRules(supporting);
}

function scenarioConclusion(question, cardRules) {
  const condition = cardRules.find((rule) => rule.facts?.kind === "condition" || rule.facts?.category === "condition");
  const coral = cardRules.find((rule) => rule.facts?.kind === "coral" || rule.facts?.category === "coral");
  if (condition && coral) {
    const conditionText = normalize(`${condition.title} ${condition.text} ${(condition.facts?.printedRules ?? []).join(" ")}`);
    const matchingWeakness = (coral.facts?.weaknesses ?? []).find((weakness) => conditionText.includes(normalize(weakness)));
    return matchingWeakness
      ? `${condition.title} matches ${coral.title}'s ${matchingWeakness} weakness, so apply the printed weakness consequence for this round.`
      : `${condition.title} does not match ${coral.title}'s listed weaknesses (${joinList(coral.facts?.weaknesses ?? ["none documented"])}). Apply the Condition's printed effect, but do not invent a weakness penalty.`;
  }

  const support = cardRules.find((rule) => rule.facts?.kind === "support" || rule.facts?.category === "support");
  if (support && coral && /\bcoral heal\b/i.test(support.title)) {
    return `${support.title} can choose ${coral.title} because it is one of your Corals; it removes effects as printed, but it does not heal marked damage unless the card text says so.`;
  }

  if (/\b(?:placement|slots?|habitat matching|placement rules)\b/i.test(question)) {
    return "For each creature being placed, match both its habitat zone and class to the destination slot, then apply any more-specific printed exception.";
  }
  return "Apply only these cited card instructions and interaction rules; if a printed card instruction is more specific than a general rule, follow the printed instruction.";
}

function isMultiRuleQuestion(question, cards) {
  const normalizedQuestion = ` ${normalize(question)} `;
  const explicitlyNamed = cards.filter((rule) => normalizedQuestion.includes(` ${normalize(rule.title)} `)).length;
  const contextualPair = cards.length >= 2 && /\b(first|second|third|attacker|defender|target|previous condition)\b/i.test(question);
  if (explicitlyNamed >= 2 || contextualPair) return true;
  return cards.length === 1 && /\b(interact|interaction|together|against|while|during|combined?|both|versus|vs\.?|what happens if)\b/i.test(question);
}

function clarification(question, candidates, context) {
  const names = candidates.slice(0, 6).map((candidate) => candidate.title);
  const quotedQuestion = String(question).trim().replace(/[.!?]+$/, "");
  const result = {
    kind: "clarification",
    title: "Which card do you mean?",
    text: `I found more than one card matching “${quotedQuestion}.” Please include the subtitle or stage: ${joinList(names)}.`,
    options: names,
    sources: [],
  };
  result.context = nextContext(question, result, context);
  return result;
}

function answerRulesQuestionInternal(question, rules, context = {}) {
  const cleanQuestion = String(question ?? "").trim();
  if (!cleanQuestion) return null;

  if (/^(hello|hey|hi|howdy)( there)?[!.?]*$/i.test(cleanQuestion)) {
    const result = {
      kind: "greeting",
      title: "Hi, fellow SeaPal!",
      text: "Ask me about setup, turns, a specific card, attacks, habitats, Conditions, or how two rules interact.",
      sources: [],
    };
    result.context = nextContext(cleanQuestion, result, context);
    return result;
  }

  if (OUT_OF_SCOPE_PATTERN.test(cleanQuestion)) {
    const result = {
      kind: "unknown",
      text: "That isn't covered by the SeaPals gameplay rules or card data I use, so I don't have a supported answer.",
      showRulesLink: false,
      sources: [],
    };
    result.context = nextContext(cleanQuestion, result, context);
    return result;
  }

  if (UNDOCUMENTED_TERM_PATTERN.test(cleanQuestion)) {
    const result = unsupportedDefinition(cleanQuestion, []);
    result.context = nextContext(cleanQuestion, result, context);
    return result;
  }

  const explicitCandidates = uniqueRules(explicitCardMatches(cleanQuestion, rules));
  const contextualReferences = referencedContextCards(cleanQuestion, context, rules);
  const mentionedCards = uniqueRules([...explicitCandidates, ...contextualReferences]);
  const roles = inferRoles(cleanQuestion, mentionedCards, context);

  const versionAnswer = cardVersionExistenceAnswer(cleanQuestion, uniqueRules([...explicitCandidates, ...contextualReferences]), rules);
  if (versionAnswer) {
    versionAnswer.context = nextContext(cleanQuestion, versionAnswer, context, explicitCandidates, roles);
    return versionAnswer;
  }

  if (explicitCandidates.length === 1) {
    const multiFactAnswer = cardMultiFactAnswer(cleanQuestion, explicitCandidates[0]);
    if (multiFactAnswer) {
      multiFactAnswer.context = nextContext(cleanQuestion, multiFactAnswer, context, explicitCandidates, roles);
      return multiFactAnswer;
    }
  }

  const coralPlacement = coralPlacementAnswer(cleanQuestion, explicitCandidates, rules);
  if (coralPlacement) {
    coralPlacement.context = nextContext(cleanQuestion, coralPlacement, context, explicitCandidates, roles);
    return coralPlacement;
  }

  if (isMultiRuleQuestion(cleanQuestion, mentionedCards)) {
    return scenarioAnswer(cleanQuestion, mentionedCards, rules, context, roles);
  }

  const countAnswer = attackCountAnswer(cleanQuestion, explicitCandidates.length === 1 ? explicitCandidates[0] : null, rules);
  if (countAnswer) {
    countAnswer.context = nextContext(cleanQuestion, countAnswer, context, explicitCandidates, roles);
    return countAnswer;
  }

  const modifierAnswer = rollModifierAnswer(cleanQuestion, rules);
  if (modifierAnswer) {
    modifierAnswer.context = nextContext(cleanQuestion, modifierAnswer, context, mentionedCards, roles);
    return modifierAnswer;
  }

  const densityAnswer = schoolDensityNotationAnswer(cleanQuestion, rules);
  if (densityAnswer) {
    densityAnswer.context = nextContext(cleanQuestion, densityAnswer, context, mentionedCards, roles);
    return densityAnswer;
  }

  const deckRoutingAnswer = compoundDeckRoutingAnswer(cleanQuestion, rules);
  if (deckRoutingAnswer) {
    deckRoutingAnswer.context = nextContext(cleanQuestion, deckRoutingAnswer, context, mentionedCards, roles);
    return deckRoutingAnswer;
  }

  const deckFollowUpAnswer = contextualDeckRoutingAnswer(cleanQuestion, rules, context);
  if (deckFollowUpAnswer) {
    deckFollowUpAnswer.context = nextContext(cleanQuestion, deckFollowUpAnswer, context, mentionedCards, roles);
    return deckFollowUpAnswer;
  }

  const densityFollowUpAnswer = contextualSchoolDensityAnswer(cleanQuestion, rules, context);
  if (densityFollowUpAnswer) {
    densityFollowUpAnswer.context = nextContext(cleanQuestion, densityFollowUpAnswer, context, mentionedCards, roles);
    return densityFollowUpAnswer;
  }

  const diceFollowUpAnswer = contextualDiceResultAnswer(cleanQuestion, context);
  if (diceFollowUpAnswer) {
    diceFollowUpAnswer.context = nextContext(cleanQuestion, diceFollowUpAnswer, context, mentionedCards, roles);
    return diceFollowUpAnswer;
  }

  const economyAbility = findNamedAbility(cleanQuestion, rules, explicitCandidates);
  const economyAbilityAnswer = namedAbilityEconomyAnswer(cleanQuestion, economyAbility, rules);
  if (economyAbilityAnswer) {
    economyAbilityAnswer.context = nextContext(cleanQuestion, economyAbilityAnswer, context, mentionedCards, roles);
    return economyAbilityAnswer;
  }

  const quantityAnswer = coreQuantityAnswer(cleanQuestion, rules);
  if (quantityAnswer) {
    quantityAnswer.context = nextContext(cleanQuestion, quantityAnswer, context, mentionedCards, roles);
    return quantityAnswer;
  }

  const superlativeAnswer = coralDamageSuperlativeAnswer(cleanQuestion, rules);
  if (superlativeAnswer) {
    superlativeAnswer.context = nextContext(cleanQuestion, superlativeAnswer, context, mentionedCards, roles);
    return superlativeAnswer;
  }

  const habitatComparison = habitatComparisonAnswer(cleanQuestion, null, rules);
  if (habitatComparison) {
    habitatComparison.context = nextContext(cleanQuestion, habitatComparison, context, mentionedCards, roles);
    return habitatComparison;
  }

  const intentRule = findExplicitReferenceRule(cleanQuestion, rules) ?? findIntentRule(cleanQuestion, rules);
  const strategyAnswer = strategyIntentAnswer(intentRule, rules);
  if (strategyAnswer) {
    strategyAnswer.context = nextContext(cleanQuestion, strategyAnswer, context, mentionedCards, roles);
    return strategyAnswer;
  }

  const comparisonAnswer = intentRule ? null : conceptComparisonAnswer(cleanQuestion, rules, context);
  if (comparisonAnswer) {
    comparisonAnswer.context = nextContext(cleanQuestion, comparisonAnswer, context, mentionedCards, roles);
    return comparisonAnswer;
  }
  let namedAbility = findNamedAbility(cleanQuestion, rules, explicitCandidates);
  if (namedAbility && explicitCandidates.length === 1
    && normalize(explicitCandidates[0].title) === normalize(namedAbility.title)
    && /\b(?:printed|support card|card itself|the card rather than|card version)\b/i.test(cleanQuestion)) {
    namedAbility = null;
  }
  const contextAbility = !namedAbility && isFollowUp(cleanQuestion)
    && /\b(?:that|those|these|each)\b/i.test(cleanQuestion)
    ? findContextAbility(context, rules)
    : null;
  const intentMatchesNamedAbility = intentRule && namedAbility
    && normalize(intentRule.title) === normalize(namedAbility.title);
  const explicitlyRequestsNamedAbility = /\b(?:abilit(?:y|ies)|named|passive|printed versions?)\b/i.test(cleanQuestion)
    || Boolean(namedAbility && isDefinitionQuestion(cleanQuestion) && questionNamesRule(cleanQuestion, namedAbility));
  const interactionIntent = intentRule && /^(?:Toxic creatures|Regenerate|Cloak and Transparency|Massive, advantage, and disadvantage|Deep creatures and Abyss)$/i.test(intentRule.title);
  const forceInteractionIntent = intentRule && (
    (/^Toxic creatures$/i.test(intentRule.title) && /\b(?:toxic when eaten|ate|eaten|immunity|immune|consum)\w*\b/i.test(cleanQuestion))
    || (/^Cloak and Transparency$/i.test(intentRule.title) && /\b(?:transparency|printed die|die size|modifiers?|total after)\b/i.test(cleanQuestion))
  );
  const exactIntentReference = intentRule && normalize(cleanQuestion).replace(/^(?:can you |could you )?(?:define|explain|tell me about)\s+/, "") === normalize(intentRule.title);
  if (intentRule && /^Comparing Reef, Oceanic, and Deep creatures$/i.test(intentRule.title)) {
    const result = habitatComparisonAnswer(cleanQuestion, intentRule, rules);
    if (result) {
      result.context = nextContext(cleanQuestion, result, context, mentionedCards, roles);
      return result;
    }
  }
  if (intentRule && (exactIntentReference || forceInteractionIntent || !namedAbility || (interactionIntent && !explicitlyRequestsNamedAbility) || intentMatchesNamedAbility)) {
    const result = {
      kind: "answer",
      title: intentRule.title,
      text: intentRule.text,
      sources: sourcesForIntentRule(intentRule, rules),
    };
    result.context = nextContext(cleanQuestion, result, context, mentionedCards, roles);
    return result;
  }

  if (contextAbility && !intentRule) {
    const result = {
      kind: "answer",
      title: contextAbility.title,
      text: contextAbility.text,
      entity: contextAbility.entity,
      sources: sourcesFor(contextAbility),
    };
    result.context = nextContext(cleanQuestion, result, context);
    return result;
  }

  if (namedAbility) {
    const result = {
      kind: "answer",
      title: namedAbility.title,
      text: namedAbility.text,
      entity: namedAbility.entity,
      sources: sourcesFor(namedAbility),
    };
    result.context = nextContext(cleanQuestion, result, context);
    return result;
  }

  if (explicitCandidates.length > 1 && isCardFocusedQuestion(cleanQuestion, explicitCandidates[0])) {
    return clarification(cleanQuestion, explicitCandidates, context);
  }

  const contextualCard = contextualReferences.length === 1 ? contextualReferences[0] : findContextCard(context, rules);
  const explicitCard = explicitCandidates.length === 1 && isCardFocusedQuestion(cleanQuestion, explicitCandidates[0])
    ? explicitCandidates[0]
    : null;
  const activeCard = explicitCard ?? contextualReferences[0] ?? (isFollowUp(cleanQuestion) ? contextualCard : null);
  const followUp = isFollowUp(cleanQuestion);
  const expandedQuestion = followUp && context.lastQuestion && normalize(cleanQuestion).split(" ").length <= 3
    ? `${context.lastQuestion} ${cleanQuestion}`
    : cleanQuestion;

  if (activeCard && !/^what if\b/i.test(cleanQuestion)) {
    const multiFactAnswer = cardMultiFactAnswer(cleanQuestion, activeCard);
    if (multiFactAnswer) {
      multiFactAnswer.context = nextContext(cleanQuestion, multiFactAnswer, context, [activeCard], roles);
      return multiFactAnswer;
    }
  }

  if (activeCard && (explicitCard || CARD_FACT_PATTERN.test(cleanQuestion)) && !/^what if\b/i.test(cleanQuestion)) {
    const result = cardAnswer(cleanQuestion, activeCard, rules);
    result.context = nextContext(cleanQuestion, result, context, [activeCard], roles);
    return result;
  }

  const exactConcept = findExactConcept(cleanQuestion, rules);
  if (exactConcept) {
    const result = {
      kind: "answer",
      title: exactConcept.title,
      text: exactConcept.text,
      entity: exactConcept.entity,
      sources: sourcesFor(exactConcept),
    };
    result.context = nextContext(cleanQuestion, result, context);
    return result;
  }

  const dieAnswer = explainDieNotation(cleanQuestion);
  if (dieAnswer) {
    const result = {
      kind: "answer",
      ...dieAnswer,
      sources: [{ id: "how-to:dice-reference", label: "How to Play — Dice Reference", href: "/instructions" }],
      entity: activeCard?.entity,
    };
    result.context = nextContext(cleanQuestion, result, context, activeCard ? [activeCard] : mentionedCards, roles);
    return result;
  }

  const relevant = findRelevantRules(expandedQuestion, rules, { limit: 4, minScore: 6 });
  const best = relevant[0];
  if (!best) {
    const result = unsupportedDefinition(cleanQuestion, relevant);
    result.context = nextContext(cleanQuestion, result, context, activeCard ? [activeCard] : mentionedCards, roles);
    return result;
  }

  if (isDefinitionQuestion(cleanQuestion) && !relevant.some((rule) => questionNamesRule(cleanQuestion, rule))) {
    const result = unsupportedDefinition(cleanQuestion, relevant);
    result.context = nextContext(cleanQuestion, result, context, activeCard ? [activeCard] : mentionedCards, roles);
    return result;
  }

  const result = {
    kind: "answer",
    title: best.title,
    text: best.text,
    sources: sourcesFor(best),
    entity: activeCard?.entity ?? best.entity,
  };
  result.context = nextContext(cleanQuestion, result, context, activeCard ? [activeCard] : mentionedCards, roles);
  return result;
}

export function answerRulesQuestion(question, rules, context = {}) {
  const result = answerRulesQuestionInternal(question, rules, context);
  if (!result) return result;
  const sufficiency = validateAnswerSufficiency(question, result);
  const cleanQuestion = String(question ?? "").trim();
  const explicitCards = uniqueRules(explicitCardMatches(cleanQuestion, rules));
  const cardFocused = explicitCards.length > 0 && isCardFocusedQuestion(cleanQuestion, explicitCards[0]);
  const contextualCardFocused = Boolean(findContextCard(context, rules) && isFollowUp(cleanQuestion) && CARD_FACT_PATTERN.test(cleanQuestion));
  const namedAbility = findNamedAbility(cleanQuestion, rules, explicitCards);
  const structuredMatch = cardFocused || contextualCardFocused || namedAbility ? null : findStructuredFact(cleanQuestion, rules);
  const structuredNumbers = numericFactValues(structuredMatch?.fact?.values);
  const resultContainsStructuredNumbers = structuredNumbers.length > 0
    && [...new Set(structuredNumbers)].every((value) => new RegExp(`\\b${value}\\b`).test(String(result.text)));
  const shouldUseStructuredQuantity = sufficiency.type === "quantity"
    && structuredMatch
    && (structuredMatch.intentMatches.length > 0 || structuredMatch.typeMatches.includes("quantity"))
    && (!sufficiency.valid || !resultContainsStructuredNumbers);
  if (shouldUseStructuredQuantity) {
    const structuredResult = {
      kind: "answer",
      title: structuredMatch.rule.title,
      text: structuredMatch.fact.text,
      sources: sourcesForStructuredFact(structuredMatch, rules),
      structuredFactId: structuredMatch.fact.id,
    };
    structuredResult.context = nextContext(cleanQuestion, structuredResult, context, explicitCards);
    if (validateAnswerSufficiency(question, structuredResult).valid) return structuredResult;
  }

  const shouldAddStructuredDetail = result.kind === "answer"
    && structuredMatch
    && structuredMatch.fact.augmentExisting === true
    && sufficiency.type !== "quantity"
    && structuredMatch.intentMatches.length > 0
    && structuredMatch.score >= 28;
  if (shouldAddStructuredDetail) {
    const detailAlreadyPresent = normalize(result.text).includes(normalize(structuredMatch.fact.text));
    const enhanced = {
      ...result,
      text: detailAlreadyPresent ? result.text : `${result.text} ${structuredMatch.fact.text}`,
      sources: uniqueSources([...sourcesForStructuredFact(structuredMatch, rules), ...(result.sources ?? [])]),
      structuredFactId: structuredMatch.fact.id,
    };
    if (validateAnswerSufficiency(question, enhanced).valid) return enhanced;
  }

  if (sufficiency.valid || sufficiency.type !== "quantity" || cardFocused || namedAbility) return result;

  return {
    kind: "clarification",
    title: "I need a more specific rule",
    text: `I found a related rule, but it does not contain ${sufficiency.reason}. I don't want to substitute an incomplete answer. Could you name the card, ability, icon, or phase you are looking at?`,
    options: [],
    sources: [],
    context: result.context,
  };
}
