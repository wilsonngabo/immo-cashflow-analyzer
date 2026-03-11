export const REGIONS: Record<string, string[]> = {
    'Auvergne-Rhône-Alpes': ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
    'Bourgogne-Franche-Comté': ['21', '25', '39', '58', '70', '71', '89', '90'],
    'Bretagne': ['22', '29', '35', '56'],
    'Centre-Val de Loire': ['18', '28', '36', '37', '41', '45'],
    'Corse': ['2A', '2B'],
    'Grand Est': ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
    'Hauts-de-France': ['02', '59', '60', '62', '80'],
    'Île-de-France': ['75', '77', '78', '91', '92', '93', '94', '95'],
    'Normandie': ['14', '27', '50', '61', '76'],
    'Nouvelle-Aquitaine': ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
    'Occitanie': ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '81', '82'],
    'Pays de la Loire': ['44', '49', '53', '72', '85'],
    'Provence-Alpes-Côte d\'Azur': ['04', '05', '06', '13', '83', '84'],
    'Guadeloupe': ['971'],
    'Martinique': ['972'],
    'Guyane': ['973'],
    'La Réunion': ['974'],
    'Mayotte': ['976']
};

export const DEPARTMENTS: Record<string, string> = {
    '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes',
    '06': 'Alpes-Maritimes', '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', '10': 'Aube',
    '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône', '14': 'Calvados', '15': 'Cantal',
    '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze', '2A': 'Corse-du-Sud',
    '2B': 'Haute-Corse', '21': 'Côte-d\'Or', '22': 'Côtes-d\'Armor', '23': 'Creuse', '24': 'Dordogne',
    '25': 'Doubs', '26': 'Drôme', '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère',
    '30': 'Gard', '31': 'Haute-Garonne', '32': 'Gers', '33': 'Gironde', '34': 'Hérault',
    '35': 'Ille-et-Vilaine', '36': 'Indre', '37': 'Indre-et-Loire', '38': 'Isère', '39': 'Jura',
    '40': 'Landes', '41': 'Loir-et-Cher', '42': 'Loire', '43': 'Haute-Loire', '44': 'Loire-Atlantique',
    '45': 'Loiret', '46': 'Lot', '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire',
    '50': 'Manche', '51': 'Marne', '52': 'Haute-Marne', '53': 'Mayenne', '54': 'Meurthe-et-Moselle',
    '55': 'Meuse', '56': 'Morbihan', '57': 'Moselle', '58': 'Nièvre', '59': 'Nord',
    '60': 'Oise', '61': 'Orne', '62': 'Pas-de-Calais', '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques',
    '65': 'Hautes-Pyrénées', '66': 'Pyrénées-Orientales', '67': 'Bas-Rhin', '68': 'Haut-Rhin', '69': 'Rhône',
    '70': 'Haute-Saône', '71': 'Saône-et-Loire', '72': 'Sarthe', '73': 'Savoie', '74': 'Haute-Savoie',
    '75': 'Paris', '76': 'Seine-Maritime', '77': 'Seine-et-Marne', '78': 'Yvelines', '79': 'Deux-Sèvres',
    '80': 'Somme', '81': 'Tarn', '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse',
    '85': 'Vendée', '86': 'Vienne', '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne',
    '90': 'Territoire de Belfort', '91': 'Essonne', '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis', '94': 'Val-de-Marne',
    '95': 'Val-d\'Oise', '971': 'Guadeloupe', '972': 'Martinique', '973': 'Guyane', '974': 'La Réunion', '976': 'Mayotte'
};

export function getDepartmentCode(postalCode?: string): string | undefined {
    if (!postalCode) return undefined;
    if (postalCode.startsWith('97')) return postalCode.substring(0, 3);
    if (postalCode.startsWith('20')) {
        return parseInt(postalCode) < 20200 ? '2A' : '2B';
    }
    return postalCode.substring(0, 2);
}

export function getRegionForDepartment(deptCode: string): string | undefined {
    for (const [region, depts] of Object.entries(REGIONS)) {
        if (depts.includes(deptCode)) return region;
    }
    return undefined;
}

/**
 * Returns PTZ zone (A, B1, B2, C) from a French postal code.
 * Based on simplified department-level mapping (arrêté du 1er août 2014 et mises à jour).
 * Zone A = Grand Paris | B1 = grandes agglomérations | B2 = agglomérations moyennes | C = reste
 */
export function getZoneFromPostalCode(postalCode?: string): 'A' | 'B1' | 'B2' | 'C' {
    if (!postalCode) return 'B2';
    const dept = getDepartmentCode(postalCode);
    if (!dept) return 'B2';

    // Zone A — Grand Paris (Île-de-France central)
    const zoneA = ['75', '92', '93', '94'];

    // Zone B1 — Grandes agglomérations + DOM-TOM
    const zoneB1 = [
        '06',  // Alpes-Maritimes (Nice, Cannes, Antibes)
        '13',  // Bouches-du-Rhône (Marseille, Aix-en-Provence)
        '31',  // Haute-Garonne (Toulouse)
        '33',  // Gironde (Bordeaux)
        '34',  // Hérault (Montpellier)
        '35',  // Ille-et-Vilaine (Rennes)
        '38',  // Isère (Grenoble)
        '44',  // Loire-Atlantique (Nantes)
        '57',  // Moselle (Metz)
        '59',  // Nord (Lille)
        '67',  // Bas-Rhin (Strasbourg)
        '69',  // Rhône (Lyon)
        '74',  // Haute-Savoie (Annecy, Thonon-les-Bains)
        '76',  // Seine-Maritime (Rouen)
        '77',  // Seine-et-Marne (couronne IDF)
        '78',  // Yvelines (couronne IDF)
        '83',  // Var (Toulon, Fréjus)
        '84',  // Vaucluse (Avignon)
        '91',  // Essonne (couronne IDF)
        '95',  // Val-d'Oise (couronne IDF)
        '971', // Guadeloupe
        '972', // Martinique
        '973', // Guyane
        '974', // La Réunion
        '976', // Mayotte
    ];

    // Zone B2 — Agglomérations moyennes (50k–250k hab.)
    const zoneB2 = [
        '01', '02', '03', '04', '05', '07', '08', '09',
        '10', '11', '12', '14', '15', '16', '17', '18', '19',
        '21', '22', '23', '24', '25', '26', '27', '28', '29',
        '30', '32', '36', '37', '39',
        '40', '41', '42', '43', '45', '46', '47', '48', '49',
        '50', '51', '52', '53', '54', '55', '56', '58',
        '60', '61', '62', '63', '64', '65', '66', '68',
        '70', '71', '72', '73', '79',
        '80', '81', '82', '85', '86', '87', '88', '89',
        '90',
    ];

    if (zoneA.includes(dept)) return 'A';
    if (zoneB1.includes(dept)) return 'B1';
    if (zoneB2.includes(dept)) return 'B2';
    return 'C'; // Corse (2A, 2B) et zones très rurales
}
