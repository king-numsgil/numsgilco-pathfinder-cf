import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { AppDb } from "../db";
import * as s from "../db/schema";
import { bloodlineLevel, disciplineLevel, evenClassLevel } from "./spells";

// ─── Input ────────────────────────────────────────────────────────────────────

export const sourceSchema = z.object({
    type: z.enum(s.SOURCE_TYPES),
    sourceId: z.string().min(1),
    // Required for a subdomain: the domain it was taken from
    domainId: z.string().min(1).nullish(),
});

export type SourceInput = z.infer<typeof sourceSchema>;

const LOOKUP = {
    domain: s.domains,
    subdomain: s.subdomains,
    bloodline: s.bloodlines,
    patron: s.patrons,
    mystery: s.mysteries,
    discipline: s.psychicDisciplines,
} as const;

/** Null when every source exists (and every subdomain belongs to its domain), else the problem. */
export async function validateSources(db: AppDb, sources: SourceInput[]): Promise<string | null> {
    for (const type of s.SOURCE_TYPES) {
        const ids = [...new Set(sources.filter((src) => src.type === type).map((src) => src.sourceId))];
        if (ids.length === 0) {
            continue;
        }
        const table = LOOKUP[type];
        const found = await db.select({id: table.id}).from(table).where(inArray(table.id, ids));
        if (found.length !== ids.length) {
            return `Unknown ${type}`;
        }
    }
    for (const src of sources.filter((x) => x.type === "subdomain")) {
        if (!src.domainId) {
            return "A subdomain needs its domain";
        }
        const [pair] = await db
            .select({id: s.domainSubdomains.subdomainId})
            .from(s.domainSubdomains)
            .where(and(eq(s.domainSubdomains.domainId, src.domainId), eq(s.domainSubdomains.subdomainId, src.sourceId)));
        if (!pair) {
            return "That subdomain doesn't belong to that domain";
        }
    }
    return null;
}

// Same source twice is a no-op; only subdomains keep a domain
export function normalizeSources(sources: SourceInput[]): SourceInput[] {
    const seen = new Set<string>();
    return sources
        .map((src) => ({...src, domainId: src.type === "subdomain" ? src.domainId ?? null : null}))
        .filter((src) => {
            const key = `${src.type}:${src.sourceId}:${src.domainId ?? ""}`;
            return seen.has(key) ? false : (seen.add(key), true);
        });
}

// ─── Reading ──────────────────────────────────────────────────────────────────

const parentDomain = alias(s.domains, "parent_domain");
const cs = s.characterSources;

/** A character's sources with their names, by type then name. */
export async function loadSources(db: AppDb, characterId: string) {
    const name = sql<string>`coalesce(
        ${s.domains.name}, ${s.subdomains.name}, ${s.bloodlines.name}, ${s.patrons.name}, ${s.mysteries.name},
        ${s.psychicDisciplines.name}, '?'
    )`;
    return db
        .select({
            id: cs.id,
            type: cs.type,
            sourceId: cs.sourceId,
            name,
            domainId: cs.domainId,
            domainName: parentDomain.name,
        })
        .from(cs)
        .leftJoin(s.domains, and(eq(cs.type, "domain"), eq(s.domains.id, cs.sourceId)))
        .leftJoin(s.subdomains, and(eq(cs.type, "subdomain"), eq(s.subdomains.id, cs.sourceId)))
        .leftJoin(s.bloodlines, and(eq(cs.type, "bloodline"), eq(s.bloodlines.id, cs.sourceId)))
        .leftJoin(s.patrons, and(eq(cs.type, "patron"), eq(s.patrons.id, cs.sourceId)))
        .leftJoin(s.mysteries, and(eq(cs.type, "mystery"), eq(s.mysteries.id, cs.sourceId)))
        .leftJoin(s.psychicDisciplines, and(eq(cs.type, "discipline"), eq(s.psychicDisciplines.id, cs.sourceId)))
        .leftJoin(parentDomain, eq(parentDomain.id, cs.domainId))
        .where(eq(cs.characterId, characterId))
        .orderBy(asc(cs.type), asc(name));
}

type LoadedSource = Awaited<ReturnType<typeof loadSources>>[number];

// ─── Granted spells ───────────────────────────────────────────────────────────

interface GrantedSpell {
    spellId: string;
    name: string;
    level: number;
    school: string | null;
    // List-entry qualifiers, e.g. "air only"
    notes: string[];
    // "Fire domain", "Arcane bloodline"…
    sources: string[];
}

const spellColumns = {
    spellId: s.spells.id,
    name: s.spells.name,
    school: s.schools.name,
};

const SOURCE_LABEL: Record<s.SourceType, string> = {
    domain: "domain",
    subdomain: "subdomain",
    bloodline: "bloodline",
    patron: "patron",
    mystery: "mystery",
    discipline: "discipline",
};

/**
 * Spells the character's sources grant at this point: domain and subdomain
 * spells up to the highest spell level the character has slots for (all of
 * them if no slots are set yet); bloodline, patron, mystery and discipline
 * spells whose class level the character has reached. A subdomain's list is its domain's
 * with the replacement spells swapped in at their levels.
 */
export async function grantedSpells(
    db: AppDb,
    character: { level: number; slots: number[] },
    sources: LoadedSource[],
): Promise<GrantedSpell[]> {
    const topSlot = character.slots.findLastIndex((n) => n > 0);
    const maxLevel = topSlot >= 0 ? topSlot : 9;

    const idsOf = (type: s.SourceType) => sources.filter((src) => src.type === type).map((src) => src.sourceId);
    const subdomains = sources.filter((src) => src.type === "subdomain");
    const domainIds = [...new Set([...idsOf("domain"), ...subdomains.flatMap((src) => src.domainId ?? [])])];
    const subdomainIds = idsOf("subdomain");
    const bloodlineIds = idsOf("bloodline");
    const patronIds = idsOf("patron");
    const mysteryIds = idsOf("mystery");
    const disciplineIds = idsOf("discipline");

    const [domainRows, subdomainRows, bloodlineRows, patronRows, mysteryRows, disciplineRows] = await Promise.all([
        domainIds.length === 0 ? [] : db
            .select({...spellColumns, level: s.domainSpells.level, note: s.domainSpells.note, ownerId: s.domainSpells.domainId})
            .from(s.domainSpells)
            .innerJoin(s.spells, eq(s.spells.id, s.domainSpells.spellId))
            .leftJoin(s.schools, eq(s.schools.id, s.spells.schoolId))
            .where(and(inArray(s.domainSpells.domainId, domainIds), lte(s.domainSpells.level, maxLevel))),
        subdomainIds.length === 0 ? [] : db
            .select({...spellColumns, level: s.subdomainSpells.level, note: s.subdomainSpells.note, ownerId: s.subdomainSpells.subdomainId})
            .from(s.subdomainSpells)
            .innerJoin(s.spells, eq(s.spells.id, s.subdomainSpells.spellId))
            .leftJoin(s.schools, eq(s.schools.id, s.spells.schoolId))
            .where(and(inArray(s.subdomainSpells.subdomainId, subdomainIds), lte(s.subdomainSpells.level, maxLevel))),
        bloodlineIds.length === 0 ? [] : db
            .select({
                ...spellColumns,
                classLevel: s.bloodlineSpells.classLevel,
                bloodrager: s.bloodlines.bloodrager,
                note: s.bloodlineSpells.note,
                ownerId: s.bloodlineSpells.bloodlineId,
            })
            .from(s.bloodlineSpells)
            .innerJoin(s.bloodlines, eq(s.bloodlines.id, s.bloodlineSpells.bloodlineId))
            .innerJoin(s.spells, eq(s.spells.id, s.bloodlineSpells.spellId))
            .leftJoin(s.schools, eq(s.schools.id, s.spells.schoolId))
            .where(and(inArray(s.bloodlineSpells.bloodlineId, bloodlineIds), lte(s.bloodlineSpells.classLevel, character.level))),
        patronIds.length === 0 ? [] : db
            .select({...spellColumns, classLevel: s.patronSpells.classLevel, note: s.patronSpells.note, ownerId: s.patronSpells.patronId})
            .from(s.patronSpells)
            .innerJoin(s.spells, eq(s.spells.id, s.patronSpells.spellId))
            .leftJoin(s.schools, eq(s.schools.id, s.spells.schoolId))
            .where(and(inArray(s.patronSpells.patronId, patronIds), lte(s.patronSpells.classLevel, character.level))),
        mysteryIds.length === 0 ? [] : db
            .select({...spellColumns, classLevel: s.mysterySpells.classLevel, note: s.mysterySpells.note, ownerId: s.mysterySpells.mysteryId})
            .from(s.mysterySpells)
            .innerJoin(s.spells, eq(s.spells.id, s.mysterySpells.spellId))
            .leftJoin(s.schools, eq(s.schools.id, s.spells.schoolId))
            .where(and(inArray(s.mysterySpells.mysteryId, mysteryIds), lte(s.mysterySpells.classLevel, character.level))),
        disciplineIds.length === 0 ? [] : db
            .select({
                ...spellColumns,
                classLevel: s.disciplineSpells.classLevel,
                note: s.disciplineSpells.note,
                ownerId: s.disciplineSpells.disciplineId,
            })
            .from(s.disciplineSpells)
            .innerJoin(s.spells, eq(s.spells.id, s.disciplineSpells.spellId))
            .leftJoin(s.schools, eq(s.schools.id, s.spells.schoolId))
            .where(and(inArray(s.disciplineSpells.disciplineId, disciplineIds), lte(s.disciplineSpells.classLevel, character.level))),
    ]);

    // One entry per spell and level; a spell granted twice lists both sources
    const granted = new Map<string, GrantedSpell>();
    const grant = (
        row: { spellId: string; name: string; school: string | null; note: string | null },
        level: number,
        source: LoadedSource,
    ) => {
        const key = `${row.spellId}:${level}`;
        const entry = granted.get(key) ?? {spellId: row.spellId, name: row.name, level, school: row.school, notes: [], sources: []};
        const label = `${source.name} ${SOURCE_LABEL[source.type]}`;
        if (!entry.sources.includes(label)) {
            entry.sources.push(label);
        }
        if (row.note && !entry.notes.includes(row.note)) {
            entry.notes.push(row.note);
        }
        granted.set(key, entry);
    };

    for (const src of sources) {
        switch (src.type) {
            case "domain":
                for (const row of domainRows.filter((r) => r.ownerId === src.sourceId)) {
                    grant(row, row.level, src);
                }
                break;
            case "subdomain": {
                const replacements = subdomainRows.filter((r) => r.ownerId === src.sourceId);
                const replaced = new Set(replacements.map((r) => r.level));
                const kept = domainRows.filter((r) => r.ownerId === src.domainId && !replaced.has(r.level));
                for (const row of [...kept, ...replacements]) {
                    grant(row, row.level, src);
                }
                break;
            }
            case "bloodline":
                for (const row of bloodlineRows.filter((r) => r.ownerId === src.sourceId)) {
                    grant(row, bloodlineLevel(row.bloodrager, row.classLevel), src);
                }
                break;
            case "patron":
                for (const row of patronRows.filter((r) => r.ownerId === src.sourceId)) {
                    grant(row, evenClassLevel(row.classLevel), src);
                }
                break;
            case "mystery":
                for (const row of mysteryRows.filter((r) => r.ownerId === src.sourceId)) {
                    grant(row, evenClassLevel(row.classLevel), src);
                }
                break;
            case "discipline":
                for (const row of disciplineRows.filter((r) => r.ownerId === src.sourceId)) {
                    grant(row, disciplineLevel(row.classLevel), src);
                }
                break;
        }
    }

    return [...granted.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}
