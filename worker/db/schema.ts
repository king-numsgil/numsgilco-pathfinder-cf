import { relations } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, primaryKey, real, smallint, text, timestamp } from "drizzle-orm/pg-core";

// ─── Lookup tables ────────────────────────────────────────────────────────────

export const classes = pgTable("classes", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
});

export const schools = pgTable("schools", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
});

export const subschools = pgTable("subschools", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
});

export const deities = pgTable("deities", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    pantheon: text("pantheon"),
    alignment: text("alignment"),
    areasOfConcern: text("areas_of_concern").array().notNull().default([]),
    favoredWeapon: text("favored_weapon"),
    pfsLegal: boolean("pfs_legal").notNull().default(false),
});

// A book reference, as scraped from Archive of Nethys
export interface SourceRef {
    book: string;
    page: number | null;
    url: string;
}

// Extra labeled sections (tables, notes, haunt statistics…), Markdown values
export interface ExtraSection {
    label: string;
    value: string;
}

// ─── Domains & Subdomains ─────────────────────────────────────────────────────

export const domains = pgTable("domains", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
});

export const subdomains = pgTable("subdomains", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
});

export const domainSubdomains = pgTable(
    "domain_subdomains",
    {
        domainId: text("domain_id")
            .notNull()
            .references(() => domains.id),
        subdomainId: text("subdomain_id")
            .notNull()
            .references(() => subdomains.id),
    },
    (t) => [primaryKey({columns: [t.domainId, t.subdomainId]})],
);

export const domainDeities = pgTable(
    "domain_deities",
    {
        domainId: text("domain_id")
            .notNull()
            .references(() => domains.id),
        deityId: text("deity_id")
            .notNull()
            .references(() => deities.id),
    },
    (t) => [primaryKey({columns: [t.domainId, t.deityId]})],
);

export const subdomainDeities = pgTable(
    "subdomain_deities",
    {
        subdomainId: text("subdomain_id")
            .notNull()
            .references(() => subdomains.id),
        deityId: text("deity_id")
            .notNull()
            .references(() => deities.id),
    },
    (t) => [primaryKey({columns: [t.subdomainId, t.deityId]})],
);

// ─── Bloodlines & Patrons ─────────────────────────────────────────────────────

// Sorcerer and bloodrager bloodlines share names, so bloodrager ones are stored
// as "Aberrant (Bloodrager)" and flagged — they grant spells at different levels
export const bloodlines = pgTable("bloodlines", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    bloodrager: boolean("bloodrager").notNull().default(false),
});

export const patrons = pgTable("patrons", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
});

// ─── Oracle Mysteries ─────────────────────────────────────────────────────────

export const mysteries = pgTable("mysteries", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
});

export const mysteryDeities = pgTable(
    "mystery_deities",
    {
        mysteryId: text("mystery_id")
            .notNull()
            .references(() => mysteries.id),
        deityId: text("deity_id")
            .notNull()
            .references(() => deities.id),
    },
    (t) => [primaryKey({columns: [t.mysteryId, t.deityId]})],
);

// ─── Spells ───────────────────────────────────────────────────────────────────

// Text columns (description, mythic text, extra sections) hold Markdown
export const spells = pgTable("spells", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    link: text("link"),
    description: text("description").notNull(),
    // Mythic version of the spell, including any "Augmented" paragraphs
    mythicText: text("mythic_text"),
    pfsLegal: boolean("pfs_legal").notNull().default(false),

    schoolId: text("school_id").references(() => schools.id),
    deityId: text("deity_id").references(() => deities.id),

    castingTime: text("casting_time").notNull().default(""),
    range: text("range").notNull().default(""),
    area: text("area"),
    effect: text("effect"),
    targets: text("targets"),
    duration: text("duration").notNull().default(""),
    savingThrow: text("saving_throw"),
    spellResistance: text("spell_resistance"),
    // First source's book, for lists; every source is in `sources`
    sourcebook: text("sourcebook").notNull(),
    sources: jsonb("sources").$type<SourceRef[]>().notNull().default([]),

    dismissible: boolean("dismissible").notNull().default(false),
    shapeable: boolean("shapeable").notNull().default(false),
    verbal: boolean("verbal").notNull().default(false),
    somatic: boolean("somatic").notNull().default(false),
    material: boolean("material").notNull().default(false),
    focus: boolean("focus").notNull().default(false),
    divineFocus: boolean("divine_focus").notNull().default(false),
    // In gp; can be fractional (2 sp = 0.2)
    componentCost: real("component_cost"),
    // Components line as printed, e.g. "V, S, M (a flask of holy water worth 25 gp), DF"
    componentsText: text("components_text").notNull().default(""),

    // Race (or other) restriction, e.g. "sylph"
    race: text("race"),

    descriptors: text("descriptors").array().notNull().default([]),
    extra: jsonb("extra").$type<ExtraSection[]>().notNull().default([]),
});

// Spell ↔ Subschool (a few spells have two, e.g. Gate: creation and calling)
export const spellSubschools = pgTable(
    "spell_subschools",
    {
        spellId: text("spell_id")
            .notNull()
            .references(() => spells.id),
        subschoolId: text("subschool_id")
            .notNull()
            .references(() => subschools.id),
    },
    (t) => [primaryKey({columns: [t.spellId, t.subschoolId]})],
);

// Spell ↔ Class (with spell level per class)
export const spellClasses = pgTable(
    "spell_classes",
    {
        spellId: text("spell_id")
            .notNull()
            .references(() => spells.id),
        classId: text("class_id")
            .notNull()
            .references(() => classes.id),
        level: smallint("level").notNull(),
    },
    (t) => [primaryKey({columns: [t.spellId, t.classId]})],
);

// The `note` on domain, subdomain, bloodline, patron and mystery spells is the
// list entry's qualifier, e.g. "air only" for "elemental body IV (air only)"

// Spell ↔ Domain (with spell level)
export const domainSpells = pgTable(
    "domain_spells",
    {
        spellId: text("spell_id")
            .notNull()
            .references(() => spells.id),
        domainId: text("domain_id")
            .notNull()
            .references(() => domains.id),
        level: smallint("level").notNull(),
        note: text("note"),
    },
    (t) => [primaryKey({columns: [t.spellId, t.domainId]})],
);

// Spell ↔ Subdomain (with spell level). Only the subdomain's replacement
// spells — the rest of its list is its parent domain's.
export const subdomainSpells = pgTable(
    "subdomain_spells",
    {
        spellId: text("spell_id")
            .notNull()
            .references(() => spells.id),
        subdomainId: text("subdomain_id")
            .notNull()
            .references(() => subdomains.id),
        level: smallint("level").notNull(),
        note: text("note"),
    },
    (t) => [primaryKey({columns: [t.spellId, t.subdomainId]})],
);

// Spell ↔ Bloodline (with class level)
export const bloodlineSpells = pgTable(
    "bloodline_spells",
    {
        spellId: text("spell_id")
            .notNull()
            .references(() => spells.id),
        bloodlineId: text("bloodline_id")
            .notNull()
            .references(() => bloodlines.id),
        classLevel: smallint("class_level").notNull(),
        note: text("note"),
    },
    (t) => [primaryKey({columns: [t.spellId, t.bloodlineId]})],
);

// Spell ↔ Patron (with class level)
export const patronSpells = pgTable(
    "patron_spells",
    {
        spellId: text("spell_id")
            .notNull()
            .references(() => spells.id),
        patronId: text("patron_id")
            .notNull()
            .references(() => patrons.id),
        classLevel: smallint("class_level").notNull(),
        note: text("note"),
    },
    (t) => [primaryKey({columns: [t.spellId, t.patronId]})],
);

// Spell ↔ Mystery (with class level and optional note)
export const mysterySpells = pgTable(
    "mystery_spells",
    {
        mysteryId: text("mystery_id")
            .notNull()
            .references(() => mysteries.id),
        spellId: text("spell_id")
            .notNull()
            .references(() => spells.id),
        classLevel: smallint("class_level").notNull(),
        note: text("note"),
    },
    (t) => [primaryKey({columns: [t.mysteryId, t.spellId, t.classLevel]})],
);

// ─── Feats ────────────────────────────────────────────────────────────────────

// One prerequisite: met by any one of its options ("Endurance or armor training")
export interface PrereqGroup {
    text: string;
    anyOf: PrereqOption[];
}

export interface PrereqOption {
    // feat, ability, skillRanks, classFeature, baseAttackBonus, race, classLevel,
    // spellcasting, deity, proficiency, characterLevel, casterLevel, alignment,
    // size, baseSave, mythicTier or special
    type: string;
    text: string;
    name: string | null;
    value: number | null;
    detail: string | null;
    // Codex key of the referenced record, e.g. "feat:iron-will", "spell:bestow-curse"
    key: string | null;
}

// The mythic version of a feat (Mythic Adventures), shown on the base feat
export interface FeatMythic {
    name: string;
    flavor: string;
    prerequisites: string | null;
    benefit: string;
    special: string | null;
    sources: SourceRef[];
}

// Text columns (benefit, normal, special, …) hold Markdown
export const feats = pgTable("feats", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    link: text("link"),
    pfsLegal: boolean("pfs_legal").notNull().default(false),
    // Feats can have multiple types; untyped feats are "General"
    types: text("types").array().notNull().default([]),
    // Flavor text
    description: text("description").notNull(),
    prerequisites: text("prerequisites"),
    prerequisiteData: jsonb("prerequisite_data").$type<PrereqGroup[]>(),
    benefit: text("benefit").notNull(),
    normal: text("normal"),
    special: text("special"),
    goal: text("goal"),
    completionBenefit: text("completion_benefit"),
    // Stamina combat trick (Pathfinder Unchained)
    combatTrick: text("combat_trick"),
    mythic: jsonb("mythic").$type<FeatMythic>(),
    extra: jsonb("extra").$type<ExtraSection[]>().notNull().default([]),
    // First source's book, for lists; every source is in `sources`
    source: text("source").notNull(),
    sources: jsonb("sources").$type<SourceRef[]>().notNull().default([]),
    // Derived from the Special text ("You can gain this feat multiple times")
    multiples: boolean("multiples").notNull().default(false),
    // Denormalized from prerequisite_data for efficient numeric filtering
    minBab: smallint("min_bab"),
    minCasterLevel: smallint("min_caster_level"),
});

// Feat → Feat prerequisite graph (flat; one row per required-feat edge)
export const featPrerequisites = pgTable(
    "feat_prerequisites",
    {
        featId: text("feat_id").notNull().references(() => feats.id),
        requiredFeatId: text("required_feat_id").notNull().references(() => feats.id),
        // Parameterization note, e.g. "Acrobatics" for "Skill Focus (Acrobatics)"
        note: text("note"),
    },
    (t) => [primaryKey({columns: [t.featId, t.requiredFeatId]})],
);

// ─── Auth (Better Auth) ───────────────────────────────────────────────────────
// Column set required by Better Auth's Drizzle adapter (see worker/auth.ts)

export const users = pgTable("users", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const sessions = pgTable(
    "sessions",
    {
        id: text("id").primaryKey(),
        expiresAt: timestamp("expires_at").notNull(),
        token: text("token").notNull().unique(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, {onDelete: "cascade"}),
    },
    (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
    "accounts",
    {
        id: text("id").primaryKey(),
        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, {onDelete: "cascade"}),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: timestamp("access_token_expires_at"),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
        scope: text("scope"),
        password: text("password"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
    "verifications",
    {
        id: text("id").primaryKey(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// ─── Spellbooks ───────────────────────────────────────────────────────────────
// A character is one spellcasting class (a multiclass caster is two characters).
// Spells per day depend on class, level and ability score, so the player enters
// them: `slots[n]` is the number of level-n slots, `slotsUsed[n]` how many a
// spontaneous caster has spent today.
// NOTE: classes and spells are re-created with new IDs by `db:seed`, whose
// TRUNCATE … CASCADE also empties these tables.

export const characters = pgTable(
    "characters",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, {onDelete: "cascade"}),
        name: text("name").notNull(),
        classId: text("class_id")
            .notNull()
            .references(() => classes.id),
        level: smallint("level").notNull().default(1),
        // Prepared caster (wizard, cleric…) or spontaneous (sorcerer, oracle…)
        prepared: boolean("prepared").notNull().default(true),
        slots: jsonb("slots").$type<number[]>().notNull(),
        slotsUsed: jsonb("slots_used").$type<number[]>().notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (t) => [index("characters_user_id_idx").on(t.userId)],
);

export const SOURCE_TYPES = ["domain", "subdomain", "bloodline", "patron", "mystery"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

// Class features that grant spells: domains, bloodlines… Any number of any type
// (archetypes mix them freely). `sourceId` points into the table named by
// `type`; a subdomain also records the domain it was taken from, whose list it
// modifies (subdomains are shared between domains).
export const characterSources = pgTable(
    "character_sources",
    {
        id: text("id").primaryKey(),
        characterId: text("character_id")
            .notNull()
            .references(() => characters.id, {onDelete: "cascade"}),
        type: text("type").$type<SourceType>().notNull(),
        sourceId: text("source_id").notNull(),
        domainId: text("domain_id").references(() => domains.id),
    },
    (t) => [index("character_sources_character_id_idx").on(t.characterId)],
);

// Spells known, or a wizard's spellbook, at the level the character casts them
export const characterSpells = pgTable(
    "character_spells",
    {
        characterId: text("character_id")
            .notNull()
            .references(() => characters.id, {onDelete: "cascade"}),
        spellId: text("spell_id")
            .notNull()
            .references(() => spells.id),
        level: smallint("level").notNull(),
    },
    (t) => [primaryKey({columns: [t.characterId, t.spellId]})],
);

// Today's prepared slots: one row per slot, so a spell can be prepared twice
export const preparedSpells = pgTable(
    "prepared_spells",
    {
        id: text("id").primaryKey(),
        characterId: text("character_id")
            .notNull()
            .references(() => characters.id, {onDelete: "cascade"}),
        spellId: text("spell_id")
            .notNull()
            .references(() => spells.id),
        level: smallint("level").notNull(),
        cast: boolean("cast").notNull().default(false),
    },
    (t) => [index("prepared_spells_character_id_idx").on(t.characterId)],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const spellsRelations = relations(spells, ({one, many}) => ({
    school: one(schools, {fields: [spells.schoolId], references: [schools.id]}),
    deity: one(deities, {fields: [spells.deityId], references: [deities.id]}),
    spellSubschools: many(spellSubschools),
    spellClasses: many(spellClasses),
    domainSpells: many(domainSpells),
    subdomainSpells: many(subdomainSpells),
    bloodlineSpells: many(bloodlineSpells),
    patronSpells: many(patronSpells),
    mysterySpells: many(mysterySpells),
}));

export const spellClassesRelations = relations(spellClasses, ({one}) => ({
    spell: one(spells, {fields: [spellClasses.spellId], references: [spells.id]}),
    class: one(classes, {fields: [spellClasses.classId], references: [classes.id]}),
}));

export const classesRelations = relations(classes, ({many}) => ({
    spellClasses: many(spellClasses),
}));

export const schoolsRelations = relations(schools, ({many}) => ({
    spells: many(spells),
}));

export const subschoolsRelations = relations(subschools, ({many}) => ({
    spellSubschools: many(spellSubschools),
}));

export const spellSubschoolsRelations = relations(spellSubschools, ({one}) => ({
    spell: one(spells, {fields: [spellSubschools.spellId], references: [spells.id]}),
    subschool: one(subschools, {fields: [spellSubschools.subschoolId], references: [subschools.id]}),
}));

export const deitiesRelations = relations(deities, ({many}) => ({
    spells: many(spells),
    domainDeities: many(domainDeities),
    subdomainDeities: many(subdomainDeities),
    mysteryDeities: many(mysteryDeities),
}));

export const domainsRelations = relations(domains, ({many}) => ({
    domainSubdomains: many(domainSubdomains),
    domainDeities: many(domainDeities),
    domainSpells: many(domainSpells),
}));

export const subdomainsRelations = relations(subdomains, ({many}) => ({
    domainSubdomains: many(domainSubdomains),
    subdomainDeities: many(subdomainDeities),
    subdomainSpells: many(subdomainSpells),
}));

export const domainSubdomainsRelations = relations(domainSubdomains, ({one}) => ({
    domain: one(domains, {fields: [domainSubdomains.domainId], references: [domains.id]}),
    subdomain: one(subdomains, {fields: [domainSubdomains.subdomainId], references: [subdomains.id]}),
}));

export const domainDeitiesRelations = relations(domainDeities, ({one}) => ({
    domain: one(domains, {fields: [domainDeities.domainId], references: [domains.id]}),
    deity: one(deities, {fields: [domainDeities.deityId], references: [deities.id]}),
}));

export const subdomainDeitiesRelations = relations(subdomainDeities, ({one}) => ({
    subdomain: one(subdomains, {fields: [subdomainDeities.subdomainId], references: [subdomains.id]}),
    deity: one(deities, {fields: [subdomainDeities.deityId], references: [deities.id]}),
}));

export const bloodlinesRelations = relations(bloodlines, ({many}) => ({
    bloodlineSpells: many(bloodlineSpells),
}));

export const bloodlineSpellsRelations = relations(bloodlineSpells, ({one}) => ({
    spell: one(spells, {fields: [bloodlineSpells.spellId], references: [spells.id]}),
    bloodline: one(bloodlines, {fields: [bloodlineSpells.bloodlineId], references: [bloodlines.id]}),
}));

export const patronsRelations = relations(patrons, ({many}) => ({
    patronSpells: many(patronSpells),
}));

export const patronSpellsRelations = relations(patronSpells, ({one}) => ({
    spell: one(spells, {fields: [patronSpells.spellId], references: [spells.id]}),
    patron: one(patrons, {fields: [patronSpells.patronId], references: [patrons.id]}),
}));

export const mysteriesRelations = relations(mysteries, ({many}) => ({
    mysteryDeities: many(mysteryDeities),
    mysterySpells: many(mysterySpells),
}));

export const mysteryDeitiesRelations = relations(mysteryDeities, ({one}) => ({
    mystery: one(mysteries, {fields: [mysteryDeities.mysteryId], references: [mysteries.id]}),
    deity: one(deities, {fields: [mysteryDeities.deityId], references: [deities.id]}),
}));

export const mysterySpellsRelations = relations(mysterySpells, ({one}) => ({
    mystery: one(mysteries, {fields: [mysterySpells.mysteryId], references: [mysteries.id]}),
    spell: one(spells, {fields: [mysterySpells.spellId], references: [spells.id]}),
}));

export const domainSpellsRelations = relations(domainSpells, ({one}) => ({
    domain: one(domains, {fields: [domainSpells.domainId], references: [domains.id]}),
    spell: one(spells, {fields: [domainSpells.spellId], references: [spells.id]}),
}));

export const subdomainSpellsRelations = relations(subdomainSpells, ({one}) => ({
    subdomain: one(subdomains, {fields: [subdomainSpells.subdomainId], references: [subdomains.id]}),
    spell: one(spells, {fields: [subdomainSpells.spellId], references: [spells.id]}),
}));

export const featsRelations = relations(feats, ({many}) => ({
    // Edges where this feat IS the dependent (it requires others)
    prerequisiteLinks: many(featPrerequisites, {relationName: "feat_requires"}),
    // Edges where this feat IS the requirement (others need it)
    dependentLinks: many(featPrerequisites, {relationName: "feat_required_by"}),
}));

export const featPrerequisitesRelations = relations(featPrerequisites, ({one}) => ({
    feat: one(feats, {
        fields: [featPrerequisites.featId],
        references: [feats.id],
        relationName: "feat_requires",
    }),
    requiredFeat: one(feats, {
        fields: [featPrerequisites.requiredFeatId],
        references: [feats.id],
        relationName: "feat_required_by",
    }),
}));

// ─── Inferred types ──────────────────────────────────────────────────────────

export type Spell = typeof spells.$inferSelect;
export type NewSpell = typeof spells.$inferInsert;
export type Feat = typeof feats.$inferSelect;
export type NewFeat = typeof feats.$inferInsert;
export type FeatPrerequisite = typeof featPrerequisites.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type School = typeof schools.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type Subdomain = typeof subdomains.$inferSelect;
export type Deity = typeof deities.$inferSelect;
export type Mystery = typeof mysteries.$inferSelect;
export type Bloodline = typeof bloodlines.$inferSelect;
export type Patron = typeof patrons.$inferSelect;
