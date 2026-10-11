import type { FeatSearchParams } from "../api";

export type FeatFilterState = {
    types: string[];
    // String inputs so controlled number fields work cleanly; "" means no filter
    maxBab: string;
    maxCl: string;
};

export const EMPTY_FEAT_FILTERS: FeatFilterState = {
    types: [],
    maxBab: "",
    maxCl: "",
};

export const FEAT_TYPE_COLORS: Record<string, string> = {
    Combat: "orange",
    General: "gray",
    Teamwork: "blue",
    Metamagic: "violet",
    Style: "yellow",
    Grit: "red",
    "Item Creation": "teal",
    "Item Mastery": "cyan",
    "Armor Mastery": "indigo",
    "Shield Mastery": "indigo",
    "Weapon Mastery": "indigo",
    "Blood Hex": "grape",
    "Companion/Familiar": "green",
    Mythic: "pink",
    Achievement: "lime",
};

// URL query params mirror the /api/feats param names
export function featFiltersFromParams(params: URLSearchParams): FeatFilterState {
    return {
        types: (params.get("type") ?? "").split(",").filter(Boolean),
        maxBab: params.get("maxBab") ?? "",
        maxCl: params.get("maxCl") ?? "",
    };
}

// Returns a copy of `params` with the filter values replaced (other params kept)
export function withFeatFilters(params: URLSearchParams, filters: FeatFilterState): URLSearchParams {
    const next = new URLSearchParams(params);
    const values: [string, string][] = [
        ["type", filters.types.join(",")],
        ["maxBab", filters.maxBab],
        ["maxCl", filters.maxCl],
    ];
    for (const [name, value] of values) {
        if (value) {
            next.set(name, value);
        } else {
            next.delete(name);
        }
    }
    return next;
}

// API query (minus pagination) for the current URL
export function featQueryFromParams(params: URLSearchParams): FeatSearchParams {
    const query: Record<string, string> = {};
    for (const name of ["q", "type", "maxBab", "maxCl"]) {
        const value = params.get(name);
        if (value) {
            query[name] = value;
        }
    }
    return query;
}

export function activeFeatFilterCount(f: FeatFilterState): number {
    return (f.types.length > 0 ? 1 : 0) +
        (f.maxBab !== "" ? 1 : 0) +
        (f.maxCl !== "" ? 1 : 0);
}
