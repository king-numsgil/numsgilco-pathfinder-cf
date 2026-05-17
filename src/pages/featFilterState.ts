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

export function activeFeatFilterCount(f: FeatFilterState): number {
    return (f.types.length > 0 ? 1 : 0) +
        (f.maxBab !== "" ? 1 : 0) +
        (f.maxCl !== "" ? 1 : 0);
}
