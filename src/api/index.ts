// ─── Response types ───────────────────────────────────────────────────────────

export type LookupItem = { id: string; name: string };

export type SpellListItem = {
    id: string;
    name: string;
    school: string | null;
    subschool: string | null;
    descriptors: string[];
    sourcebook: string;
    rating: number | null;
};

export type SpellListResponse = {
    data: SpellListItem[];
    total: number;
    limit: number;
    offset: number;
};

export type SpellDetail = {
    id: string;
    name: string;
    link: string | null;
    description: string;
    mythicText: string | null;
    augmented: string | null;
    rating: number | null;
    school: LookupItem | null;
    subschool: LookupItem | null;
    deity: LookupItem | null;
    descriptors: string[];
    castingTime: string;
    range: string;
    area: string | null;
    effect: string | null;
    targets: string | null;
    duration: string;
    savingThrow: string | null;
    spellResistance: string | null;
    sourcebook: string;
    components: {
        verbal: boolean;
        somatic: boolean;
        material: boolean;
        focus: boolean;
        divineFocus: boolean;
        cost: number | null;
    };
    dismissible: boolean;
    shapeable: boolean;
    permanency: { cl: number | null; cost: number | null } | null;
    slaLevel: number | null;
    race: string | null;
    classes: Array<LookupItem & { level: number }>;
    domains: Array<LookupItem & { level: number }>;
    subdomains: Array<LookupItem & { level: number }>;
    bloodlines: Array<LookupItem & { classLevel: number }>;
    patrons: Array<LookupItem & { classLevel: number }>;
    mysteries: Array<LookupItem & { classLevel: number; note: string | null }>;
};

export type SpellSearchParams = {
    q?: string;
    level?: string;
    class?: string;
    domain?: string;
    subdomain?: string;
    school?: string;
    subschool?: string;
    bloodline?: string;
    patron?: string;
    mystery?: string;
    limit?: number;
    offset?: number;
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

function buildUrl(path: string, params: Record<string, string | number | undefined>): string {
    const url = new URL(path, window.location.origin);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    return url.toString();
}

export async function fetchSchools(): Promise<LookupItem[]> {
    const res = await fetch("/api/schools");
    if (!res.ok) throw new Error("Failed to fetch schools");
    return res.json() as Promise<LookupItem[]>;
}

export async function fetchSpells(params: SpellSearchParams): Promise<SpellListResponse> {
    const res = await fetch(
        buildUrl("/api/spells", {
            ...(params as Record<string, string | number | undefined>),
            limit: params.limit ?? 50,
            offset: params.offset ?? 0,
        }),
    );
    if (!res.ok) throw new Error("Failed to fetch spells");
    return res.json() as Promise<SpellListResponse>;
}

export async function fetchSpell(id: string): Promise<SpellDetail> {
    const res = await fetch(`/api/spells/${encodeURIComponent(id)}`);
    if (res.status === 404) throw new Error("Spell not found");
    if (!res.ok) throw new Error("Failed to fetch spell");
    return res.json() as Promise<SpellDetail>;
}
