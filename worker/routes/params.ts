import { z } from "zod";

export function parseIds(p: string | undefined): string[] {
    return p ? p.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

export function parseLevels(p: string | undefined): number[] {
    return p
        ? p.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n))
        : [];
}

// Escape LIKE wildcards so user input like "_" or "%" is matched literally
export function escapeLike(q: string): string {
    return q.replace(/[\\%_]/g, "\\$&");
}

// Query params arrive as strings; coerce and clamp so bad input can't reach SQL
export const paginationSchema = {
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
};
