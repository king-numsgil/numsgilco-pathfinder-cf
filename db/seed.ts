/**
 * Pathfinder 1E database seed script.
 * Run with: bun db/seed.ts [--dry-run]
 *
 * Reads data/codex.json (scraped from Archive of Nethys) and populates the
 * Postgres database using the Drizzle schema in worker/db/schema.ts.
 * DESTRUCTIVE: truncates every table first. --dry-run builds all rows and
 * reports counts and warnings without connecting to the database.
 *
 * Records in the codex reference each other by key ("spell:abeyance",
 * "deity:abadar", …); keys are resolved to freshly generated ULIDs here.
 *
 * Uses the same connection string as the local Hyperdrive simulation so
 * no separate DATABASE_URL env var is needed.
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ulid } from "ulidx";
import * as schema from "../worker/db/schema";
import type { ExtraSection, FeatMythic, PrereqGroup, SourceRef } from "../worker/db/schema";

// ─── codex.json shapes ───────────────────────────────────────────────────────

interface Ref {
    name: string;
    key: string | null;
}

// One entry of a domain / bloodline / patron / mystery spell list. `text` is
// the entry as printed, e.g. "elemental body IV (air only)"
interface SpellGroup {
    level: number;
    spells: { name: string; key: string }[];
    text: string;
}

interface CodexSpell {
    key: string;
    name: string;
    url: string;
    pfsLegal: boolean;
    sources: SourceRef[];
    school: string;
    subschools: string[];
    descriptors: string[];
    levels: { class: string; level: number }[];
    deity: Ref | null;
    castingTime: string;
    components: {
        verbal: boolean;
        somatic: boolean;
        material: boolean;
        focus: boolean;
        divineFocus: boolean;
        raw: string;
        materialCostGp: number | null;
    };
    range: string | null;
    area: string | null;
    effect: string | null;
    target: string | null;
    duration: string;
    savingThrow: string | null;
    spellResistance: string | null;
    otherFields: ExtraSection[];
    description: string;
    mythic: { name: string; sources: SourceRef[]; description: string } | null;
    restriction: string | null;
}

interface CodexDeity {
    key: string;
    name: string;
    pfsLegal: boolean;
    pantheon: string;
    alignment: string;
    areasOfConcern: string[];
    favoredWeapon: string | null;
}

interface CodexDomain {
    key: string;
    name: string;
    deities: Ref[];
    subdomains: Ref[];
    spells: SpellGroup[];
}

interface CodexSubdomain {
    key: string;
    name: string;
    deities: Ref[];
    replacementSpells: SpellGroup[];
}

interface CodexBloodline {
    key: string;
    name: string;
    bonusSpells: SpellGroup[];
}

interface CodexMystery {
    key: string;
    name: string;
    deities: Ref[];
    bonusSpells: SpellGroup[];
}

interface CodexPatron {
    key: string;
    name: string;
    spells: SpellGroup[];
}

interface CodexFeatBody {
    flavor: string;
    prerequisitesText: string | null;
    prerequisites: PrereqGroup[] | null;
    benefit: string;
    normal: string | null;
    special: string | null;
    otherFields: ExtraSection[];
    sources: SourceRef[];
}

interface CodexFeat extends CodexFeatBody {
    key: string;
    name: string;
    url: string;
    pfsLegal: boolean;
    types: string[];
    goal: string | null;
    completionBenefit: string | null;
    combatTrick: { sources: SourceRef[]; text: string } | null;
    mythic: (CodexFeatBody & { name: string }) | null;
    mythicOnly: boolean;
}

interface Codex {
    generatedAt: string;
    spells: CodexSpell[];
    deities: CodexDeity[];
    domains: CodexDomain[];
    subdomains: CodexSubdomain[];
    bloodlines: CodexBloodline[];
    bloodragerBloodlines: CodexBloodline[];
    mysteries: CodexMystery[];
    patrons: CodexPatron[];
    feats: CodexFeat[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const warnings: string[] = [];

function warn(message: string): void {
    warnings.push(message);
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(s: string): string {
    return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// Resolves codex keys to the ULIDs generated for this seed
class KeyMap {
    private readonly ids = new Map<string, string>();
    private readonly label: string;

    constructor(label: string) {
        this.label = label;
    }

    add(key: string): string {
        if (this.ids.has(key)) {
            throw new Error(`Duplicate ${this.label} key: ${key}`);
        }
        const id = ulid();
        this.ids.set(key, id);
        return id;
    }

    // Looks up a reference, warning (and returning null) when it doesn't resolve
    resolve(ref: { name: string; key: string | null }, context: string): string | null {
        const id = ref.key ? this.ids.get(ref.key) : undefined;
        if (!id) {
            warn(`${context}: ${this.label} "${ref.name}" (${ref.key ?? "no key"}) not found`);
            return null;
        }
        return id;
    }
}

// Spell class keys whose display name isn't just the key title-cased
const CLASS_NAMES: Record<string, string> = {
    "summoner (unchained)": "Summoner (Unchained)",
    redmantisassassin: "Red Mantis Assassin",
    sahirafiyun: "Sahir-Afiyun",
};

const className = (key: string): string => CLASS_NAMES[key] ?? titleCase(key);

// School "multiple" is Lissalan Snake Sigil (one variant per Thassilonian school)
const IGNORED_SCHOOLS = new Set(["multiple"]);
// "curse" is a descriptor scraped into the subschool list
const SUBSCHOOL_TO_DESCRIPTOR = new Set(["curse"]);
const IGNORED_SUBSCHOOLS = new Set(["see text"]);

function normalizeDescriptor(d: string): string {
    if (d === "mindaffecting") {
        return "mind-affecting";
    }
    // "see text for lesser planar ally" and the like
    if (d.startsWith("see text")) {
        return "see text";
    }
    return d;
}

function spellDescriptors(spell: CodexSpell): string[] {
    const fromSubschools = spell.subschools.filter((s) => SUBSCHOOL_TO_DESCRIPTOR.has(s));
    return [...new Set([...spell.descriptors, ...fromSubschools].map(normalizeDescriptor))];
}

function spellSubschoolNames(spell: CodexSpell): string[] {
    return spell.subschools.filter((s) => !SUBSCHOOL_TO_DESCRIPTOR.has(s) && !IGNORED_SUBSCHOOLS.has(s));
}

// Codex text uses curly apostrophes inconsistently ("nature’s ally")
const normalizeName = (s: string): string => s.toLowerCase().replace(/[‘’]/g, "'");

// Strips leftover punctuation, footnote asterisks and wrapping parentheses
function cleanNote(raw: string): string | null {
    const note = raw.replace(/\s+/g, " ").replace(/^[\s*().,;:/]+|[\s*().,;:/]+$/g, "");
    // Empty, or a source superscript glued to the name ("delayed consumptionAPG")
    if (!note || /^[A-Z0-9]{2,4}$/.test(note)) {
        return null;
    }
    return note;
}

/**
 * Expands a spell list entry into the spells it grants, with the entry's
 * qualifier as a note. Only spells named before the first sentence break
 * count: "overwhelming presence. If you are evil, replace … holy aura with
 * unholy aura" grants overwhelming presence, and the rest becomes the note.
 */
function expandGroup(group: SpellGroup): { key: string; note: string | null }[] {
    const unique = [...new Map(group.spells.map((s) => [s.key, s])).values()];
    const [head, ...rest] = group.text.split(/\.(?=\s|\*)/);
    const headNorm = normalizeName(head);

    let granted = unique.filter((s) => headNorm.includes(normalizeName(s.name)));
    if (granted.length === 0) {
        granted = unique;
    }

    // Remove the granted spells' names from the entry; what's left is the note
    let remainder = head;
    for (const name of new Set(granted.map((s) => normalizeName(s.name)))) {
        const at = normalizeName(remainder).indexOf(name);
        if (at >= 0) {
            remainder = remainder.slice(0, at) + remainder.slice(at + name.length);
        }
    }
    const note = cleanNote([remainder, ...rest].join(" "));

    return granted.map((s) => ({key: s.key, note}));
}

// "You can gain this feat multiple times", "You can take Extra Ki more than
// once", "This feat can be chosen multiple times"
const MULTIPLES_RE = /\b(?:can|may)\s+(?:gain|take|select|choose|be\s+(?:taken|selected|gained|chosen))\b[^.]{0,60}?\b(?:more than once|multiple times)/i;

function featTypes(feat: CodexFeat): string[] {
    const types = new Set(feat.types);
    if (feat.mythicOnly) {
        types.add("Mythic");
    }
    if (types.size === 0) {
        types.add("General");
    }
    return [...types];
}

// Options of prerequisites that must be met (not one of several alternatives)
function requiredOptions(groups: PrereqGroup[] | null) {
    return (groups ?? []).filter((g) => g.anyOf.length === 1).map((g) => g.anyOf[0]);
}

function minValue(groups: PrereqGroup[] | null, type: string): number | null {
    const values = requiredOptions(groups)
        .filter((o) => o.type === type && o.value !== null)
        .map((o) => o.value!);
    return values.length ? Math.max(...values) : null;
}

// "(Acrobatics)" → "Acrobatics"; source citations like "(Ranged Tactics Toolbox 8)" → null
function featLinkNote(detail: string | null): string | null {
    const note = detail?.replace(/^\(|\)$/g, "").trim();
    if (!note || /\d$/.test(note)) {
        return null;
    }
    return note;
}

function extraSections(fields: ExtraSection[]): ExtraSection[] {
    return fields
        .filter((f) => f.value.trim())
        .map((f) => ({label: f.label.trim() || "Note", value: f.value}));
}

async function batchInsert<T>(
    label: string,
    items: T[],
    insertFn: (batch: T[]) => Promise<unknown>,
    batchSize = 200,
): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await insertFn(batch);
        process.stdout.write(
            `\r  ${label}: ${Math.min(i + batchSize, items.length)}/${items.length}`,
        );
    }
    console.log();
}

// ─── Load ────────────────────────────────────────────────────────────────────

const dryRun = process.argv.includes("--dry-run");

console.log("Loading data/codex.json...");
const codex: Codex = await Bun.file("./data/codex.json").json();
console.log(
    `  Generated ${codex.generatedAt}: ${codex.spells.length} spells, ${codex.feats.length} feats, ` +
    `${codex.deities.length} deities, ${codex.domains.length} domains, ${codex.subdomains.length} subdomains, ` +
    `${codex.bloodlines.length}+${codex.bloodragerBloodlines.length} bloodlines, ` +
    `${codex.patrons.length} patrons, ${codex.mysteries.length} mysteries`,
);

// ─── Build rows ──────────────────────────────────────────────────────────────
// Every row is built up front (IDs included) so --dry-run can validate the
// whole data set, and inserts need no round-trips to resolve references.

type Row<T extends { $inferInsert: unknown }> = T["$inferInsert"];

const spellIds = new KeyMap("spell");
const deityIds = new KeyMap("deity");
const domainIds = new KeyMap("domain");
const subdomainIds = new KeyMap("subdomain");
const bloodlineIds = new KeyMap("bloodline");
const patronIds = new KeyMap("patron");
const mysteryIds = new KeyMap("mystery");
const featIds = new KeyMap("feat");

// Spell IDs first: every spell list refers to them
for (const spell of codex.spells) {
    spellIds.add(spell.key);
}

// Junction rows keyed by their primary key, so duplicates are dropped (and reported)
class JunctionRows<T> {
    private readonly rows = new Map<string, T>();
    private readonly label: string;

    constructor(label: string) {
        this.label = label;
    }

    add(pk: string[], row: T, context: string): void {
        const id = pk.join("|");
        if (this.rows.has(id)) {
            warn(`${context}: duplicate ${this.label} row ignored`);
            return;
        }
        this.rows.set(id, row);
    }

    get values(): T[] {
        return [...this.rows.values()];
    }
}

// Lookups: classes, schools and subschools are whatever the spells use

// Codex name (e.g. "redmantisassassin") → generated ID
const lookupIds = (names: string[]) => new Map([...new Set(names)].map((name) => [name, ulid()]));
const lookupRows = (ids: Map<string, string>, display: (name: string) => string) =>
    [...ids].map(([name, id]) => ({id, name: display(name)}));

const classIds = lookupIds(codex.spells.flatMap((s) => s.levels.map((l) => l.class)));
const classRows = lookupRows(classIds, className);

const schoolIds = lookupIds(codex.spells.map((s) => s.school).filter((name) => !IGNORED_SCHOOLS.has(name)));
const schoolRows = lookupRows(schoolIds, capitalize);

const subschoolIds = lookupIds(codex.spells.flatMap(spellSubschoolNames));
const subschoolRows = lookupRows(subschoolIds, capitalize);

const deityRows: Row<typeof schema.deities>[] = codex.deities.map((d) => ({
    id: deityIds.add(d.key),
    name: d.name,
    pantheon: d.pantheon,
    alignment: d.alignment,
    areasOfConcern: d.areasOfConcern,
    favoredWeapon: d.favoredWeapon,
    pfsLegal: d.pfsLegal,
}));

// Domains & subdomains

const domainRows = codex.domains.map((d) => ({id: domainIds.add(d.key), name: d.name}));
const subdomainRows = codex.subdomains.map((d) => ({id: subdomainIds.add(d.key), name: d.name}));

const domainSubdomains = new JunctionRows<Row<typeof schema.domainSubdomains>>("domain_subdomains");
const domainDeities = new JunctionRows<Row<typeof schema.domainDeities>>("domain_deities");
const subdomainDeities = new JunctionRows<Row<typeof schema.subdomainDeities>>("subdomain_deities");
const domainSpells = new JunctionRows<Row<typeof schema.domainSpells>>("domain_spells");
const subdomainSpells = new JunctionRows<Row<typeof schema.subdomainSpells>>("subdomain_spells");

for (const domain of codex.domains) {
    const context = `Domain ${domain.name}`;
    const domainId = domainIds.resolve(domain, context)!;

    for (const ref of domain.subdomains) {
        const subdomainId = subdomainIds.resolve(ref, context);
        if (subdomainId) {
            domainSubdomains.add([domainId, subdomainId], {domainId, subdomainId}, context);
        }
    }
    for (const ref of domain.deities) {
        const deityId = deityIds.resolve(ref, context);
        if (deityId) {
            domainDeities.add([domainId, deityId], {domainId, deityId}, context);
        }
    }
    for (const group of domain.spells) {
        for (const {key, note} of expandGroup(group)) {
            const spellId = spellIds.resolve({name: key, key}, context);
            if (spellId) {
                domainSpells.add([spellId, domainId], {spellId, domainId, level: group.level, note}, context);
            }
        }
    }
}

for (const subdomain of codex.subdomains) {
    const context = `Subdomain ${subdomain.name}`;
    const subdomainId = subdomainIds.resolve(subdomain, context)!;

    for (const ref of subdomain.deities) {
        const deityId = deityIds.resolve(ref, context);
        if (deityId) {
            subdomainDeities.add([subdomainId, deityId], {subdomainId, deityId}, context);
        }
    }
    for (const group of subdomain.replacementSpells) {
        for (const {key, note} of expandGroup(group)) {
            const spellId = spellIds.resolve({name: key, key}, context);
            if (spellId) {
                subdomainSpells.add(
                    [spellId, subdomainId],
                    {spellId, subdomainId, level: group.level, note},
                    context,
                );
            }
        }
    }
}

// Bloodlines (sorcerer and bloodrager), patrons and mysteries. Their spell
// lists are keyed by the CLASS level at which each spell is granted.

const bloodlineRows: Row<typeof schema.bloodlines>[] = [
    ...codex.bloodlines.map((b) => ({id: bloodlineIds.add(b.key), name: b.name, bloodrager: false})),
    ...codex.bloodragerBloodlines.map((b) => ({
        id: bloodlineIds.add(b.key),
        name: `${b.name} (Bloodrager)`,
        bloodrager: true,
    })),
];
const patronRows = codex.patrons.map((p) => ({id: patronIds.add(p.key), name: p.name}));
const mysteryRows = codex.mysteries.map((m) => ({id: mysteryIds.add(m.key), name: m.name}));

const bloodlineSpells = new JunctionRows<Row<typeof schema.bloodlineSpells>>("bloodline_spells");
const patronSpells = new JunctionRows<Row<typeof schema.patronSpells>>("patron_spells");
const mysterySpells = new JunctionRows<Row<typeof schema.mysterySpells>>("mystery_spells");
const mysteryDeities = new JunctionRows<Row<typeof schema.mysteryDeities>>("mystery_deities");

for (const bloodline of [...codex.bloodlines, ...codex.bloodragerBloodlines]) {
    const context = `Bloodline ${bloodline.key}`;
    const bloodlineId = bloodlineIds.resolve(bloodline, context)!;
    for (const group of bloodline.bonusSpells) {
        for (const {key, note} of expandGroup(group)) {
            const spellId = spellIds.resolve({name: key, key}, context);
            if (spellId) {
                bloodlineSpells.add(
                    [spellId, bloodlineId],
                    {spellId, bloodlineId, classLevel: group.level, note},
                    context,
                );
            }
        }
    }
}

for (const patron of codex.patrons) {
    const context = `Patron ${patron.name}`;
    const patronId = patronIds.resolve(patron, context)!;
    for (const group of patron.spells) {
        for (const {key, note} of expandGroup(group)) {
            const spellId = spellIds.resolve({name: key, key}, context);
            if (spellId) {
                patronSpells.add([spellId, patronId], {spellId, patronId, classLevel: group.level, note}, context);
            }
        }
    }
}

for (const mystery of codex.mysteries) {
    const context = `Mystery ${mystery.name}`;
    const mysteryId = mysteryIds.resolve(mystery, context)!;
    for (const ref of mystery.deities) {
        const deityId = deityIds.resolve(ref, context);
        if (deityId) {
            mysteryDeities.add([mysteryId, deityId], {mysteryId, deityId}, context);
        }
    }
    for (const group of mystery.bonusSpells) {
        for (const {key, note} of expandGroup(group)) {
            const spellId = spellIds.resolve({name: key, key}, context);
            if (spellId) {
                mysterySpells.add(
                    [mysteryId, spellId, String(group.level)],
                    {mysteryId, spellId, classLevel: group.level, note},
                    context,
                );
            }
        }
    }
}

// Spells

const spellRows: Row<typeof schema.spells>[] = [];
const spellSubschools = new JunctionRows<Row<typeof schema.spellSubschools>>("spell_subschools");
const spellClasses = new JunctionRows<Row<typeof schema.spellClasses>>("spell_classes");

for (const spell of codex.spells) {
    const context = `Spell ${spell.name}`;
    const spellId = spellIds.resolve(spell, context)!;
    const c = spell.components;

    spellRows.push({
        id: spellId,
        name: spell.name,
        link: spell.url,
        description: spell.description,
        mythicText: spell.mythic?.description ?? null,
        pfsLegal: spell.pfsLegal,
        schoolId: schoolIds.get(spell.school) ?? null,
        deityId: spell.deity ? deityIds.resolve(spell.deity, context) : null,
        castingTime: spell.castingTime,
        range: spell.range ?? "",
        area: spell.area,
        effect: spell.effect,
        targets: spell.target,
        duration: spell.duration,
        savingThrow: spell.savingThrow,
        spellResistance: spell.spellResistance,
        sourcebook: spell.sources[0]?.book ?? "",
        sources: spell.sources,
        dismissible: spell.duration.includes("(D)"),
        shapeable: `${spell.area ?? ""} ${spell.effect ?? ""}`.includes("(S)"),
        verbal: c.verbal,
        somatic: c.somatic,
        material: c.material,
        focus: c.focus,
        divineFocus: c.divineFocus,
        componentCost: c.materialCostGp,
        componentsText: c.raw,
        race: spell.restriction ? capitalize(spell.restriction) : null,
        descriptors: spellDescriptors(spell),
        extra: extraSections(spell.otherFields),
    });

    for (const name of spellSubschoolNames(spell)) {
        const subschoolId = subschoolIds.get(name)!;
        spellSubschools.add([spellId, subschoolId], {spellId, subschoolId}, context);
    }
    for (const {class: key, level} of spell.levels) {
        const classId = classIds.get(key)!;
        spellClasses.add([spellId, classId], {spellId, classId, level}, context);
    }
}

// Feats

for (const feat of codex.feats) {
    featIds.add(feat.key);
}

const featRows: Row<typeof schema.feats>[] = [];
const featPrerequisites = new JunctionRows<Row<typeof schema.featPrerequisites>>("feat_prerequisites");

for (const feat of codex.feats) {
    const context = `Feat ${feat.name}`;
    const featId = featIds.resolve(feat, context)!;

    const mythic: FeatMythic | null = feat.mythic && {
        name: feat.mythic.name,
        flavor: feat.mythic.flavor,
        prerequisites: feat.mythic.prerequisitesText,
        benefit: feat.mythic.benefit,
        special: feat.mythic.special,
        sources: feat.mythic.sources,
    };

    featRows.push({
        id: featId,
        name: feat.name,
        link: feat.url,
        pfsLegal: feat.pfsLegal,
        types: featTypes(feat),
        description: feat.flavor,
        prerequisites: feat.prerequisitesText,
        prerequisiteData: feat.prerequisites,
        benefit: feat.benefit,
        normal: feat.normal,
        special: feat.special,
        goal: feat.goal,
        completionBenefit: feat.completionBenefit,
        combatTrick: feat.combatTrick?.text ?? null,
        mythic,
        extra: extraSections(feat.otherFields),
        source: feat.sources[0]?.book ?? "",
        sources: feat.sources,
        multiples: MULTIPLES_RE.test(feat.special ?? ""),
        minBab: minValue(feat.prerequisites, "baseAttackBonus"),
        minCasterLevel: minValue(feat.prerequisites, "casterLevel"),
    });

    // Feat graph: only hard requirements, not one-of-several alternatives
    for (const option of requiredOptions(feat.prerequisites)) {
        if (option.type !== "feat" || !option.key) {
            continue;
        }
        const requiredFeatId = featIds.resolve({name: option.text, key: option.key}, context);
        if (requiredFeatId && requiredFeatId !== featId) {
            featPrerequisites.add(
                [featId, requiredFeatId],
                {featId, requiredFeatId, note: featLinkNote(option.detail)},
                context,
            );
        }
    }
}

// ─── Report ──────────────────────────────────────────────────────────────────

const tables: [string, unknown[]][] = [
    ["classes", classRows],
    ["schools", schoolRows],
    ["subschools", subschoolRows],
    ["deities", deityRows],
    ["domains", domainRows],
    ["subdomains", subdomainRows],
    ["domain_subdomains", domainSubdomains.values],
    ["domain_deities", domainDeities.values],
    ["subdomain_deities", subdomainDeities.values],
    ["bloodlines", bloodlineRows],
    ["patrons", patronRows],
    ["mysteries", mysteryRows],
    ["mystery_deities", mysteryDeities.values],
    ["spells", spellRows],
    ["spell_subschools", spellSubschools.values],
    ["spell_classes", spellClasses.values],
    ["domain_spells", domainSpells.values],
    ["subdomain_spells", subdomainSpells.values],
    ["bloodline_spells", bloodlineSpells.values],
    ["patron_spells", patronSpells.values],
    ["mystery_spells", mysterySpells.values],
    ["feats", featRows],
    ["feat_prerequisites", featPrerequisites.values],
];

console.log("\nRows:");
for (const [name, rows] of tables) {
    console.log(`  ${name.padEnd(20)} ${rows.length}`);
}

if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) {
        console.log(`  ${w}`);
    }
}

if (dryRun) {
    console.log("\nDry run: database not touched.");
    process.exit(0);
}

// ─── Insert ──────────────────────────────────────────────────────────────────

const url = process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;
if (!url) {
    throw new Error("CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE not set");
}

// The real database requires TLS; a local throwaway Postgres doesn't offer it
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = postgres(url, {max: 3, ssl: isLocal ? false : "require", onnotice: () => {}});
const db = drizzle(client, {schema});

console.log("\nTruncating existing data...");
await db.execute(sql`
    TRUNCATE TABLE
        mystery_spells, mystery_deities, mysteries,
        patron_spells, patrons,
        bloodline_spells, bloodlines,
        subdomain_spells, domain_spells,
        subdomain_deities, domain_deities,
        domain_subdomains, subdomains, domains,
        spell_classes, spell_subschools, spells,
        deities, subschools, schools, classes,
        feat_prerequisites, feats
    RESTART IDENTITY CASCADE
`);

console.log("Inserting...");

// In foreign-key order
await db.insert(schema.classes).values(classRows);
await db.insert(schema.schools).values(schoolRows);
await db.insert(schema.subschools).values(subschoolRows);
await batchInsert("deities", deityRows, (b) => db.insert(schema.deities).values(b));
await db.insert(schema.domains).values(domainRows);
await db.insert(schema.subdomains).values(subdomainRows);
await batchInsert("domain_subdomains", domainSubdomains.values, (b) => db.insert(schema.domainSubdomains).values(b));
await batchInsert("domain_deities", domainDeities.values, (b) => db.insert(schema.domainDeities).values(b));
await batchInsert("subdomain_deities", subdomainDeities.values, (b) => db.insert(schema.subdomainDeities).values(b));
await db.insert(schema.bloodlines).values(bloodlineRows);
await db.insert(schema.patrons).values(patronRows);
await db.insert(schema.mysteries).values(mysteryRows);
await batchInsert("mystery_deities", mysteryDeities.values, (b) => db.insert(schema.mysteryDeities).values(b));

await batchInsert("spells", spellRows, (b) => db.insert(schema.spells).values(b));
await batchInsert("spell_subschools", spellSubschools.values, (b) => db.insert(schema.spellSubschools).values(b));
await batchInsert("spell_classes", spellClasses.values, (b) => db.insert(schema.spellClasses).values(b), 1000);
await batchInsert("domain_spells", domainSpells.values, (b) => db.insert(schema.domainSpells).values(b));
await batchInsert("subdomain_spells", subdomainSpells.values, (b) => db.insert(schema.subdomainSpells).values(b));
await batchInsert("bloodline_spells", bloodlineSpells.values, (b) => db.insert(schema.bloodlineSpells).values(b));
await batchInsert("patron_spells", patronSpells.values, (b) => db.insert(schema.patronSpells).values(b));
await batchInsert("mystery_spells", mysterySpells.values, (b) => db.insert(schema.mysterySpells).values(b));

await batchInsert("feats", featRows, (b) => db.insert(schema.feats).values(b));
await batchInsert("feat_prerequisites", featPrerequisites.values, (b) => db.insert(schema.featPrerequisites).values(b));

console.log("\n✓ Seed complete!");
await client.end();
