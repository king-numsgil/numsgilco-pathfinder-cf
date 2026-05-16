/**
 * Pathfinder 1E database seed script.
 * Run with: bun db/seed.ts
 *
 * Reads data/ JSON files and populates the Supabase Postgres database
 * using the Drizzle schema in worker/db/schema.ts.
 *
 * Uses the same connection string as the local Hyperdrive simulation so
 * no separate DATABASE_URL env var is needed.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ulid } from "ulidx";
import * as schema from "../worker/db/schema";
import { sql } from "drizzle-orm";

// ─── Types mirrored from refresh.ts ──────────────────────────────────────────

type SpellEntry = {
    name: string;
    link: string | null;
    description: string;
    rating: number | null;
    school: string;
    subschool: string | null;
    casting_time: string;
    range: string;
    area: string | null;
    effect: string | null;
    targets: string | null;
    duration: string;
    saving_throw: string | null;
    spell_resistance: string | null;
    sourcebook: string;
    dismissible: boolean;
    shapeable: boolean;
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    focus: boolean;
    divine_focus: boolean;
    component_costs: number | null;
    permanency: boolean;
    permanency_cl: number | null;
    permanency_cost: number | null;
    sla_level: number | null;
    race: string | null;
    mythic_text: string | null;
    augmented: string | null;
    // class levels
    arcanist: number | null; wizard: number | null; sorcerer: number | null;
    witch: number | null; magus: number | null; bard: number | null;
    skald: number | null; summoner: number | null; unsummoner: number | null;
    bloodrager: number | null; shaman: number | null; druid: number | null;
    hunter: number | null; ranger: number | null; cleric: number | null;
    oracle: number | null; warpriest: number | null; inquisitor: number | null;
    antipaladin: number | null; paladin: number | null; alchemist: number | null;
    investigator: number | null; psychic: number | null; mesmerist: number | null;
    occultist: number | null; spiritualist: number | null; medium: number | null;
    // descriptors (booleans)
    acid: boolean; air: boolean; chaotic: boolean; cold: boolean;
    curse: boolean; darkness: boolean; death: boolean; disease: boolean;
    draconic: boolean; earth: boolean; electricity: boolean; emotion: boolean;
    evil: boolean; fear: boolean; fire: boolean; force: boolean;
    good: boolean; language_dependent: boolean; lawful: boolean; light: boolean;
    meditative: boolean; mind_affecting: boolean; pain: boolean; poison: boolean;
    ruse: boolean; shadow: boolean; sonic: boolean; water: boolean;
    // relation strings
    deity: string | null;
    domain: string | null;
    bloodline: string | null;
    patron: string | null;
};

type DomainList = {
    [name: string]: { Subdomains: string[]; Deities: string[] };
};

type MysteryEntry = {
    Name: string;
    Deities: string[];
    Spells: {
        "Level 2": string | [string, string];
        "Level 4": string | [string, string];
        "Level 6": string | [string, string];
        "Level 8": string | [string, string];
        "Level 10": string | [string, string];
        "Level 12": string | [string, string];
        "Level 14": string | [string, string];
        "Level 16": string | [string, string];
        "Level 18": string | [string, string];
    };
};

type FeatEntry = {
    name: string;
    type: string[];
    description: string;
    prerequisites: string | null;
    prerequisite_data: unknown;
    benefit: string;
    normal: string | null;
    special: string | null;
    race_name: string | null;
    note: string | null;
    goal: string | null;
    completion_benefit: string | null;
    source: string;
    multiples: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseEntry(entry: string): [string, number] {
    const match = entry.trim().match(/^(.+?)\s\((\d+)\)$/);
    if (!match) throw new Error(`Cannot parse entry: "${entry}"`);
    return [match[1].trim(), parseInt(match[2], 10)];
}

function normalizeSchool(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const FEAT_TYPE_MAP: Record<string, string> = {
    "combat feat": "Combat",
    combat: "Combat",
    general: "General",
    teamwork: "Teamwork",
    metamagic: "Metamagic",
    style: "Style",
    grit: "Grit",
    "item creation": "Item Creation",
    "item mastery": "Item Mastery",
    "armor mastery": "Armor Mastery",
    "shield mastery": "Shield Mastery",
    "weapon mastery": "Weapon Mastery",
    "blood hex": "Blood Hex",
    "companion/familiar": "Companion/Familiar",
};

function normalizeFeatType(t: string): string {
    const key = t.trim().toLowerCase();
    return (
        FEAT_TYPE_MAP[key] ??
        t.trim().charAt(0).toUpperCase() + t.trim().slice(1)
    );
}

function collectDescriptors(spell: SpellEntry): string[] {
    const descriptors: string[] = [];
    if (spell.acid) descriptors.push("acid");
    if (spell.air) descriptors.push("air");
    if (spell.chaotic) descriptors.push("chaotic");
    if (spell.cold) descriptors.push("cold");
    if (spell.curse) descriptors.push("curse");
    if (spell.darkness) descriptors.push("darkness");
    if (spell.death) descriptors.push("death");
    if (spell.disease) descriptors.push("disease");
    if (spell.draconic) descriptors.push("draconic");
    if (spell.earth) descriptors.push("earth");
    if (spell.electricity) descriptors.push("electricity");
    if (spell.emotion) descriptors.push("emotion");
    if (spell.evil) descriptors.push("evil");
    if (spell.fear) descriptors.push("fear");
    if (spell.fire) descriptors.push("fire");
    if (spell.force) descriptors.push("force");
    if (spell.good) descriptors.push("good");
    if (spell.language_dependent) descriptors.push("language-dependent");
    if (spell.lawful) descriptors.push("lawful");
    if (spell.light) descriptors.push("light");
    if (spell.meditative) descriptors.push("meditative");
    if (spell.mind_affecting) descriptors.push("mind-affecting");
    if (spell.pain) descriptors.push("pain");
    if (spell.poison) descriptors.push("poison");
    if (spell.ruse) descriptors.push("ruse");
    if (spell.shadow) descriptors.push("shadow");
    if (spell.sonic) descriptors.push("sonic");
    if (spell.water) descriptors.push("water");
    return descriptors;
}

// Map spell field name → class name (from the full class list)
const CLASS_FIELD_MAP: [keyof SpellEntry, string][] = [
    ["arcanist", "Arcanist"],
    ["wizard", "Wizard"],
    ["sorcerer", "Sorcerer"],
    ["witch", "Witch"],
    ["magus", "Magus"],
    ["bard", "Bard"],
    ["skald", "Skald"],
    ["summoner", "Summoner"],
    ["unsummoner", "Summoner (Unchained)"],
    ["bloodrager", "Bloodrager"],
    ["shaman", "Shaman"],
    ["druid", "Druid"],
    ["hunter", "Hunter"],
    ["ranger", "Ranger"],
    ["cleric", "Cleric"],
    ["oracle", "Oracle"],
    ["warpriest", "Warpriest"],
    ["inquisitor", "Inquisitor"],
    ["antipaladin", "Antipaladin"],
    ["paladin", "Paladin"],
    ["alchemist", "Alchemist"],
    ["investigator", "Investigator"],
    ["psychic", "Psychic"],
    ["mesmerist", "Mesmerist"],
    ["occultist", "Occultist"],
    ["spiritualist", "Spiritualist"],
    ["medium", "Medium"],
];

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

// ─── Main ─────────────────────────────────────────────────────────────────────

const url =
    process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;
if (!url) throw new Error("CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE not set");

const client = postgres(url, { max: 3, ssl: "require" });
const db = drizzle(client, { schema });

// Load JSON data
console.log("Loading JSON data files...");
const spellData: SpellEntry[] = await Bun.file("./data/spell_codex.json").json();
const featData: FeatEntry[] = await Bun.file("./data/feats.json").json();
const domainData: DomainList = await Bun.file("./data/domains.json").json();
const mysteryData: MysteryEntry[] = await Bun.file("./data/OracleMysteries.json").json();
console.log(
    `  Loaded: ${spellData.length} spells, ${featData.length} feats, ` +
    `${Object.keys(domainData).length} domains, ${mysteryData.length} mysteries`,
);

// ─── Truncate all tables (clean slate) ───────────────────────────────────────

console.log("\nTruncating existing data...");
await db.execute(sql`
    TRUNCATE TABLE
        mystery_spells, mystery_deities, mysteries,
        patron_spells, patrons,
        bloodline_spells, bloodlines,
        subdomain_spells, domain_spells,
        subdomain_deities, domain_deities,
        domain_subdomains, subdomains, domains,
        spell_classes, spells,
        deities, subschools, schools, classes,
        feats
    RESTART IDENTITY CASCADE
`);
console.log("  Done.");

// ─── Phase 1: Lookup tables ───────────────────────────────────────────────────

console.log("\nPhase 1: Lookup tables...");

const CLASS_NAMES = [
    "Alchemist", "Antipaladin", "Arcanist", "Barbarian", "Barbarian (Unchained)",
    "Bard", "Bloodrager", "Brawler", "Cavalier", "Cleric", "Druid", "Fighter",
    "Gunslinger", "Hunter", "Inquisitor", "Investigator", "Kineticist", "Magus",
    "Medium", "Mesmerist", "Monk", "Monk (Unchained)", "Ninja", "Occultist",
    "Oracle", "Paladin", "Psychic", "Ranger", "Rogue", "Rogue (Unchained)",
    "Samurai", "Shaman", "Shifter", "Skald", "Slayer", "Sorcerer", "Spiritualist",
    "Summoner", "Summoner (Unchained)", "Swashbuckler", "Vigilante", "Warpriest",
    "Witch", "Wizard",
];

const SCHOOL_NAMES = [
    "Abjuration", "Conjuration", "Divination", "Enchantment",
    "Evocation", "Illusion", "Necromancy", "Transmutation", "Universal",
];

const SUBSCHOOL_NAMES = [
    "Calling", "Charm", "Compulsion", "Creation", "Figment", "Glamer",
    "Haunted", "Healing", "Pattern", "Phantasm", "Polymorph",
    "Scrying", "Shadow", "Summoning", "Teleportation",
];

// Collect all unique deity names across all sources
const allDeityNames = new Set<string>();
for (const domain of Object.values(domainData)) {
    for (const d of domain.Deities) allDeityNames.add(d);
}
for (const spell of spellData) {
    if (spell.deity) allDeityNames.add(spell.deity);
}
for (const mystery of mysteryData) {
    for (const d of mystery.Deities) allDeityNames.add(d);
}

// Generate IDs upfront so lookup maps are built without a DB round-trip
const classRows = CLASS_NAMES.map((name) => ({ id: ulid(), name }));
const schoolRows = SCHOOL_NAMES.map((name) => ({ id: ulid(), name }));
const subschoolRows = SUBSCHOOL_NAMES.map((name) => ({ id: ulid(), name }));
const deityRows = [...allDeityNames].map((name) => ({ id: ulid(), name }));

await db.insert(schema.classes).values(classRows);
console.log(`  Classes: ${classRows.length}`);

await db.insert(schema.schools).values(schoolRows);
console.log(`  Schools: ${schoolRows.length}`);

await db.insert(schema.subschools).values(subschoolRows);
console.log(`  Subschools: ${subschoolRows.length}`);

await db.insert(schema.deities).values(deityRows);
console.log(`  Deities: ${deityRows.length}`);

// Build lookup maps (name → id) from the pre-generated rows
const classMap = new Map(classRows.map((r) => [r.name, r.id]));
const schoolMap = new Map(schoolRows.map((r) => [r.name.toLowerCase(), r.id]));
const subschoolMap = new Map(subschoolRows.map((r) => [r.name.toLowerCase(), r.id]));
const deityMap = new Map(deityRows.map((r) => [r.name.toLowerCase(), r.id]));

// ─── Phase 2: Domains & Subdomains ───────────────────────────────────────────

console.log("\nPhase 2: Domains & Subdomains...");

const domainRows = Object.keys(domainData).map((name) => ({ id: ulid(), name }));
await db.insert(schema.domains).values(domainRows);
const domainMap = new Map(domainRows.map((r) => [r.name.toLowerCase(), r.id]));

// Collect unique subdomain names (a subdomain like "Shadow" belongs to multiple domains)
const uniqueSubdomainNames = new Set<string>();
for (const { Subdomains } of Object.values(domainData)) {
    for (const name of Subdomains) uniqueSubdomainNames.add(name);
}

const subdomainRows = [...uniqueSubdomainNames].map((name) => ({ id: ulid(), name }));
if (subdomainRows.length) {
    await db.insert(schema.subdomains).values(subdomainRows);
}
const subdomainMap = new Map(subdomainRows.map((r) => [r.name.toLowerCase(), r.id]));

const domainSubdomainRows: { domainId: string; subdomainId: string }[] = [];
const domainDeityRows: { domainId: string; deityId: string }[] = [];
const subdomainDeityRows: { subdomainId: string; deityId: string }[] = [];

for (const [domainName, { Subdomains, Deities }] of Object.entries(domainData)) {
    const domainId = domainMap.get(domainName.toLowerCase())!;

    for (const deityName of Deities) {
        const deityId = deityMap.get(deityName.toLowerCase());
        if (deityId) domainDeityRows.push({ domainId, deityId });
    }

    for (const subName of Subdomains) {
        const subdomainId = subdomainMap.get(subName.toLowerCase());
        if (!subdomainId) continue;
        domainSubdomainRows.push({ domainId, subdomainId });

        // Subdomains inherit their parent domain's deities
        for (const deityName of Deities) {
            const deityId = deityMap.get(deityName.toLowerCase());
            if (deityId) subdomainDeityRows.push({ subdomainId, deityId });
        }
    }
}

if (domainSubdomainRows.length) {
    await batchInsert("domain_subdomains", domainSubdomainRows, (batch) =>
        db.insert(schema.domainSubdomains).values(batch).onConflictDoNothing());
}
if (domainDeityRows.length) {
    await batchInsert("domain_deities", domainDeityRows, (batch) =>
        db.insert(schema.domainDeities).values(batch).onConflictDoNothing());
}
if (subdomainDeityRows.length) {
    await batchInsert("subdomain_deities", subdomainDeityRows, (batch) =>
        db.insert(schema.subdomainDeities).values(batch).onConflictDoNothing());
}

console.log(
    `  Domains: ${domainRows.length}, ` +
    `Subdomains: ${subdomainRows.length}, ` +
    `Domain-Subdomain links: ${domainSubdomainRows.length}, ` +
    `Domain-Deity links: ${domainDeityRows.length}`,
);

// ─── Phase 3: Spells ─────────────────────────────────────────────────────────

console.log("\nPhase 3: Spells...");

// Apply known data fixes from original refresh.ts
for (const spell of spellData) {
    if (spell.name === "Gate") spell.subschool = "calling";
    if (spell.name === "Mislead") spell.subschool = "glamer";
    if (spell.name === "Vomit Twin") spell.subschool = "creation";
}

// First pass: collect all bloodline + patron names so we can insert them upfront
const bloodlineNames = new Set<string>();
const patronNames = new Set<string>();
for (const spell of spellData) {
    if (spell.bloodline) {
        for (const entry of spell.bloodline.split(",")) {
            try { bloodlineNames.add(parseEntry(entry)[0]); } catch { /* skip */ }
        }
    }
    if (spell.patron) {
        for (const entry of spell.patron.split(",")) {
            try { patronNames.add(parseEntry(entry)[0]); } catch { /* skip */ }
        }
    }
}

const bloodlineRows = [...bloodlineNames].map((name) => ({ id: ulid(), name }));
const patronRows = [...patronNames].map((name) => ({ id: ulid(), name }));

if (bloodlineRows.length) await db.insert(schema.bloodlines).values(bloodlineRows);
if (patronRows.length) await db.insert(schema.patrons).values(patronRows);

const bloodlineMap = new Map(bloodlineRows.map((r) => [r.name.toLowerCase(), r.id]));
const patronMap = new Map(patronRows.map((r) => [r.name.toLowerCase(), r.id]));
console.log(`  Bloodlines: ${bloodlineRows.length}, Patrons: ${patronRows.length}`);

// Generate spell IDs upfront — no need for .returning()
const spellIds = spellData.map(() => ulid());

// Build spell insert rows and junction rows in a single pass
const spellInsertRows: typeof schema.spells.$inferInsert[] = [];
const spellClassRows: { spellId: string; classId: string; level: number }[] = [];
const domainSpellRows: { spellId: string; domainId: string; level: number }[] = [];
const subdomainSpellRows: { spellId: string; subdomainId: string; level: number }[] = [];
const bloodlineSpellRows: { spellId: string; bloodlineId: string; classLevel: number }[] = [];
const patronSpellRows: { spellId: string; patronId: string; classLevel: number }[] = [];

// Build spell name → id map for mystery lookups
const spellNameMap = new Map<string, string>();

for (let i = 0; i < spellData.length; i++) {
    const spell = spellData[i];
    const spellId = spellIds[i];

    spellNameMap.set(spell.name.toLowerCase(), spellId);

    spellInsertRows.push({
        id: spellId,
        name: spell.name,
        link: spell.link,
        description: spell.description,
        mythicText: spell.mythic_text,
        augmented: spell.augmented,
        rating: spell.rating,
        schoolId: spell.school !== "see text"
            ? schoolMap.get(normalizeSchool(spell.school).toLowerCase()) ?? null
            : null,
        subschoolId: spell.subschool
            ? subschoolMap.get(spell.subschool.toLowerCase()) ?? null
            : null,
        deityId: spell.deity
            ? deityMap.get(spell.deity.toLowerCase()) ?? null
            : null,
        castingTime: spell.casting_time ?? "",
        range: spell.range ?? "",
        area: spell.area,
        effect: spell.effect,
        targets: spell.targets,
        duration: spell.duration ?? "",
        savingThrow: spell.saving_throw,
        spellResistance: spell.spell_resistance,
        sourcebook: spell.sourcebook,
        dismissible: spell.dismissible,
        shapeable: spell.shapeable,
        verbal: spell.verbal,
        somatic: spell.somatic,
        material: spell.material,
        focus: spell.focus,
        divineFocus: spell.divine_focus,
        componentCost: spell.component_costs,
        permanency: spell.permanency,
        permanencyCl: spell.permanency_cl,
        permanencyCost: spell.permanency_cost,
        slaLevel: spell.sla_level,
        race: spell.race,
        descriptors: collectDescriptors(spell),
    });

    // Class levels
    for (const [field, className] of CLASS_FIELD_MAP) {
        const level = spell[field] as number | null;
        const classId = classMap.get(className);
        if (level !== null && classId) spellClassRows.push({ spellId, classId, level });
    }

    // Domains & subdomains
    if (spell.domain) {
        for (const entry of spell.domain.split(",")) {
            try {
                const [name, level] = parseEntry(entry);
                const domainId = domainMap.get(name.toLowerCase());
                const subdomainId = subdomainMap.get(name.toLowerCase());
                if (domainId) {
                    domainSpellRows.push({ spellId, domainId, level });
                } else if (subdomainId) {
                    subdomainSpellRows.push({ spellId, subdomainId, level });
                } else {
                    console.warn(`  WARN: "${name}" not found in domains or subdomains (spell: ${spell.name})`);
                }
            } catch {
                console.warn(`  WARN: Could not parse domain entry "${entry}" for spell "${spell.name}"`);
            }
        }
    }

    // Bloodlines
    if (spell.bloodline) {
        for (const entry of spell.bloodline.split(",")) {
            try {
                const [name, classLevel] = parseEntry(entry);
                const bloodlineId = bloodlineMap.get(name.toLowerCase());
                if (bloodlineId) bloodlineSpellRows.push({ spellId, bloodlineId, classLevel });
            } catch { /* skip */ }
        }
    }

    // Patrons
    if (spell.patron) {
        for (const entry of spell.patron.split(",")) {
            try {
                const [name, classLevel] = parseEntry(entry);
                const patronId = patronMap.get(name.toLowerCase());
                if (patronId) patronSpellRows.push({ spellId, patronId, classLevel });
            } catch { /* skip */ }
        }
    }
}

await batchInsert("spells", spellInsertRows, (batch) =>
    db.insert(schema.spells).values(batch));

await batchInsert("spell_classes", spellClassRows, (batch) =>
    db.insert(schema.spellClasses).values(batch).onConflictDoNothing());

await batchInsert("domain_spells", domainSpellRows, (batch) =>
    db.insert(schema.domainSpells).values(batch).onConflictDoNothing());

await batchInsert("subdomain_spells", subdomainSpellRows, (batch) =>
    db.insert(schema.subdomainSpells).values(batch).onConflictDoNothing());

await batchInsert("bloodline_spells", bloodlineSpellRows, (batch) =>
    db.insert(schema.bloodlineSpells).values(batch).onConflictDoNothing());

await batchInsert("patron_spells", patronSpellRows, (batch) =>
    db.insert(schema.patronSpells).values(batch).onConflictDoNothing());

// ─── Phase 4: Oracle Mysteries ────────────────────────────────────────────────

console.log("\nPhase 4: Oracle Mysteries...");

const mysteryRows = mysteryData.map(({ Name }) => ({ id: ulid(), name: Name }));
await db.insert(schema.mysteries).values(mysteryRows);
const mysteryMap = new Map(mysteryRows.map((r) => [r.name, r.id]));

const mysteryDeityRows: { mysteryId: string; deityId: string }[] = [];
const mysterySpellRows: {
    mysteryId: string; spellId: string; classLevel: number; note: string | null;
}[] = [];

const MYSTERY_LEVELS = [2, 4, 6, 8, 10, 12, 14, 16, 18] as const;

for (const entry of mysteryData) {
    const mysteryId = mysteryMap.get(entry.Name)!;

    for (const deityName of entry.Deities) {
        const deityId = deityMap.get(deityName.toLowerCase());
        if (deityId) mysteryDeityRows.push({ mysteryId, deityId });
    }

    for (const level of MYSTERY_LEVELS) {
        const raw = entry.Spells[`Level ${level}`];
        const [spellName, note] = Array.isArray(raw) ? raw : [raw, null];
        const spellId = spellNameMap.get(spellName.toLowerCase());
        if (spellId === undefined) {
            console.warn(`  WARN: Mystery spell "${spellName}" not found (${entry.Name})`);
            continue;
        }
        mysterySpellRows.push({ mysteryId, spellId, classLevel: level, note });
    }
}

if (mysteryDeityRows.length) {
    await batchInsert("mystery_deities", mysteryDeityRows, (batch) =>
        db.insert(schema.mysteryDeities).values(batch).onConflictDoNothing());
}
if (mysterySpellRows.length) {
    await batchInsert("mystery_spells", mysterySpellRows, (batch) =>
        db.insert(schema.mysterySpells).values(batch).onConflictDoNothing());
}

console.log(`  Mysteries: ${mysteryData.length}`);

// ─── Phase 5: Feats ───────────────────────────────────────────────────────────

console.log("\nPhase 5: Feats...");

const featInsertRows: typeof schema.feats.$inferInsert[] = featData.map((feat) => ({
    id: ulid(),
    name: feat.name,
    types: [...new Set(feat.type.map(normalizeFeatType))],
    description: feat.description,
    prerequisites: feat.prerequisites,
    prerequisiteData: feat.prerequisite_data ?? null,
    benefit: feat.benefit,
    normal: feat.normal,
    special: feat.special,
    raceName: feat.race_name,
    note: feat.note,
    goal: feat.goal,
    completionBenefit: feat.completion_benefit,
    source: feat.source,
    multiples: feat.multiples,
}));

await batchInsert("feats", featInsertRows, (batch) =>
    db.insert(schema.feats).values(batch));

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("\n✓ Seed complete!");
const counts = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(schema.spells),
    db.select({ count: sql<number>`count(*)` }).from(schema.feats),
    db.select({ count: sql<number>`count(*)` }).from(schema.spellClasses),
    db.select({ count: sql<number>`count(*)` }).from(schema.domains),
    db.select({ count: sql<number>`count(*)` }).from(schema.mysteries),
]);
console.log(`  Spells:        ${counts[0][0].count}`);
console.log(`  Feats:         ${counts[1][0].count}`);
console.log(`  Spell-classes: ${counts[2][0].count}`);
console.log(`  Domains:       ${counts[3][0].count}`);
console.log(`  Mysteries:     ${counts[4][0].count}`);

await client.end();
