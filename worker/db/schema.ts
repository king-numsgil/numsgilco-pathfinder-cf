import { relations } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, primaryKey, smallint, text } from "drizzle-orm/pg-core";

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
});

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

export const bloodlines = pgTable("bloodlines", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
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

export const spells = pgTable("spells", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    link: text("link"),
    description: text("description").notNull(),
    mythicText: text("mythic_text"),
    augmented: text("augmented"),
    rating: smallint("rating"),

    schoolId: text("school_id").references(() => schools.id),
    subschoolId: text("subschool_id").references(() => subschools.id),
    deityId: text("deity_id").references(() => deities.id),

    castingTime: text("casting_time").notNull().default(""),
    range: text("range").notNull().default(""),
    area: text("area"),
    effect: text("effect"),
    targets: text("targets"),
    duration: text("duration").notNull().default(""),
    savingThrow: text("saving_throw"),
    spellResistance: text("spell_resistance"),
    sourcebook: text("sourcebook").notNull(),

    dismissible: boolean("dismissible").notNull().default(false),
    shapeable: boolean("shapeable").notNull().default(false),
    verbal: boolean("verbal").notNull().default(false),
    somatic: boolean("somatic").notNull().default(false),
    material: boolean("material").notNull().default(false),
    focus: boolean("focus").notNull().default(false),
    divineFocus: boolean("divine_focus").notNull().default(false),
    componentCost: integer("component_cost"),

    permanency: boolean("permanency").notNull().default(false),
    permanencyCl: smallint("permanency_cl"),
    permanencyCost: integer("permanency_cost"),

    slaLevel: smallint("sla_level"),
    race: text("race"),

    // 26 descriptors stored as a text array for efficient filtering
    descriptors: text("descriptors").array().notNull().default([]),
});

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
    },
    (t) => [primaryKey({columns: [t.spellId, t.domainId]})],
);

// Spell ↔ Subdomain (with spell level)
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

export const feats = pgTable("feats", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    // Stored as a normalized text array; feats can have multiple types
    types: text("types").array().notNull().default([]),
    description: text("description").notNull(),
    prerequisites: text("prerequisites"),
    // Structured prerequisite data — normalized at seed time (see db/seed.ts)
    prerequisiteData: jsonb("prerequisite_data"),
    benefit: text("benefit").notNull(),
    normal: text("normal"),
    special: text("special"),
    raceName: text("race_name"),
    note: text("note"),
    goal: text("goal"),
    completionBenefit: text("completion_benefit"),
    source: text("source").notNull(),
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
        // Parameterization note, e.g. "conjuration" for "Spell Focus: conjuration"
        note: text("note"),
    },
    (t) => [primaryKey({columns: [t.featId, t.requiredFeatId]})],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const spellsRelations = relations(spells, ({one, many}) => ({
    school: one(schools, {fields: [spells.schoolId], references: [schools.id]}),
    subschool: one(subschools, {fields: [spells.subschoolId], references: [subschools.id]}),
    deity: one(deities, {fields: [spells.deityId], references: [deities.id]}),
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
    spells: many(spells),
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
