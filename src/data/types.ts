export interface Spell {
    id: number;
    name: string;
    school: string;
    subschool?: string;
    descriptor?: string;
    levels: string;
    castingTime: string;
    components: string;
    range: string;
    duration: string;
    savingThrow: string;
    sr: string;
    description: string;
}

export interface Feat {
    id: number;
    name: string;
    type: string;
    prerequisites: string;
    benefit: string;
}
