import type { SpellSearchParams } from "../api";

export type FilterState = {
    levels: string[];
    schoolIds: string[];
    subschoolIds: string[];
    descriptors: string[];
    classIds: string[];
    domainIds: string[];
    subdomainIds: string[];
    bloodlineIds: string[];
    patronIds: string[];
    mysteryIds: string[];
};

export const EMPTY_FILTERS: FilterState = {
    levels: [],
    schoolIds: [],
    subschoolIds: [],
    descriptors: [],
    classIds: [],
    domainIds: [],
    subdomainIds: [],
    bloodlineIds: [],
    patronIds: [],
    mysteryIds: [],
};

export type SpellSort = "name" | "level";

// URL query param for each filter — identical to the API's param names, so the
// page URL maps straight onto the /api/spells request.
const PARAM_NAMES = {
    levels: "level",
    schoolIds: "school",
    subschoolIds: "subschool",
    descriptors: "descriptor",
    classIds: "class",
    domainIds: "domain",
    subdomainIds: "subdomain",
    bloodlineIds: "bloodline",
    patronIds: "patron",
    mysteryIds: "mystery",
} as const satisfies Record<keyof FilterState, string>;

const FILTER_KEYS = Object.keys(PARAM_NAMES) as (keyof FilterState)[];

export const SCHOOL_COLORS: Record<string, string> = {
    Abjuration: "blue",
    Conjuration: "teal",
    Divination: "violet",
    Enchantment: "pink",
    Evocation: "red",
    Illusion: "grape",
    Necromancy: "dark",
    Transmutation: "green",
    Universal: "gray",
};

const splitParam = (value: string | null): string[] =>
    value ? value.split(",").filter(Boolean) : [];

export function filtersFromParams(params: URLSearchParams): FilterState {
    const entries = FILTER_KEYS.map((key) => [key, splitParam(params.get(PARAM_NAMES[key]))]);
    return Object.fromEntries(entries) as FilterState;
}

// Returns a copy of `params` with the filter values replaced (other params kept)
export function withFilters(params: URLSearchParams, filters: FilterState): URLSearchParams {
    const next = new URLSearchParams(params);
    for (const key of FILTER_KEYS) {
        const values = filters[key];
        if (values.length) {
            next.set(PARAM_NAMES[key], values.join(","));
        } else {
            next.delete(PARAM_NAMES[key]);
        }
    }
    return next;
}

export function sortFromParams(params: URLSearchParams): SpellSort {
    return params.get("sort") === "level" ? "level" : "name";
}

// API query (minus pagination) for the current URL
export function spellQueryFromParams(params: URLSearchParams): SpellSearchParams {
    const query: Record<string, string> = {};
    for (const name of [...Object.values(PARAM_NAMES), "q"]) {
        const value = params.get(name);
        if (value) {
            query[name] = value;
        }
    }
    if (sortFromParams(params) === "level") {
        query.sort = "level";
    }
    return query;
}

export function activeFilterCount(f: FilterState): number {
    return Object.values(f).filter((arr) => arr.length > 0).length;
}
