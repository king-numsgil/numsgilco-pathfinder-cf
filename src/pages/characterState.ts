import type { CharacterDetail, CharacterSource, SourceInput, SpellDetail } from "../api";

export type SourceType = SourceInput["type"];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
    domain: "Domain",
    subdomain: "Subdomain",
    bloodline: "Bloodline",
    patron: "Patron",
    mystery: "Mystery",
    discipline: "Discipline",
};

// "Fire domain", "Shadow subdomain (Darkness)"
export const sourceLabel = (name: string, type: SourceType, domainName?: string | null): string =>
    `${name} ${type}${domainName ? ` (${domainName})` : ""}`;

/** A source being edited in the character form, with its display label. */
export interface SourceEntry extends SourceInput {
    label: string;
}

export const toSourceEntry = (src: CharacterSource): SourceEntry => ({
    type: src.type,
    sourceId: src.sourceId,
    domainId: src.domainId,
    label: sourceLabel(src.name, src.type, src.domainName),
});

export const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// Classes that cast spontaneously from spells known; everything else prepares
const SPONTANEOUS = new Set([
    "Bard", "Bloodrager", "Hunter", "Inquisitor", "Medium", "Mesmerist", "Occultist",
    "Oracle", "Psychic", "Skald", "Sorcerer", "Spiritualist", "Summoner", "Summoner (Unchained)",
]);

export const isSpontaneousClass = (className: string): boolean => SPONTANEOUS.has(className);

export const levelLabel = (level: number): string => level === 0 ? "Cantrips" : `Level ${level}`;

/** Levels worth showing: the character has slots there, or spells. */
export const levelsInUse = (character: CharacterDetail): number[] =>
    SPELL_LEVELS.filter((level) =>
        character.slots[level] > 0
        || character.spells.some((s) => s.level === level)
        || character.preparedSpells.some((p) => p.level === level),
    );

/**
 * The level a character casts a spell at: its level on the character's class
 * list, else the lowest level it has anywhere (domain, bloodline…).
 */
export const spellLevelFor = (spell: SpellDetail, classId: string): number => {
    const own = spell.classes.find((c) => c.id === classId);
    if (own) {
        return own.level;
    }
    const levels = [
        ...spell.classes, ...spell.domains, ...spell.subdomains,
        ...spell.bloodlines, ...spell.patrons, ...spell.mysteries, ...spell.disciplines,
    ].map((s) => s.level);
    return levels.length ? Math.min(...levels) : 0;
};
