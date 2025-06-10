export type SizeRow = {
    brand: string;   // “EU37-38 (24 cm)”
    us: string;
    heelToeCm: number; // en cm
    eu: string;
    uk: string;
};

export const sizeGuide: SizeRow[] = [
    { brand: 'EU37-38', us: '5', heelToeCm: 24, eu: '37-38', uk: '4.5-5' },
    { brand: 'EU38-39', us: '6', heelToeCm: 25, eu: '38-39', uk: '5.5-6' },
    { brand: 'EU40-41', us: '7', heelToeCm: 26, eu: '40-41', uk: '6.5-7' },
    // …añade las que necesites
];
