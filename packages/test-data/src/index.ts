import type { FoodVersion, NutritionPlan, Profile } from '@form/contracts';

export const SYNTHETIC_NOW = '2026-11-25T08:00:00+02:00';

export const syntheticProfile: Profile = {
  id: '11111111-1111-4111-8111-111111111111',
  locale: 'he-IL',
  timezone: 'Asia/Jerusalem',
  unitPreference: 'metric',
  heightCm: null,
  createdAt: SYNTHETIC_NOW,
  updatedAt: SYNTHETIC_NOW
};

export const syntheticPlan: NutritionPlan = {
  id: '22222222-2222-4222-8222-222222222222',
  effectiveFrom: '2026-11-01',
  kcal: 2300,
  proteinG: 170,
  fatG: 75,
  carbG: 236.25,
  fiberG: 35,
  steps: 8000,
  waterMl: 2500,
  sleepMinutesMin: 420,
  sleepMinutesMax: 540,
  strengthSessionsPerWeek: 4,
  reason: 'synthetic-test-fixture',
  policyVersion: 'form-plan-v1',
  createdAt: SYNTHETIC_NOW
};

function fixtureUuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

type LegacyFoodRow = [string, string, number, number, number, number, number];

const legacyCatalogRows: LegacyFoodRow[] = [
  ['chicken', 'חזה עוף מבושל', 165, 31, 0, 3.6, 0],
  ['turkey', 'חזה הודו מבושל', 147, 30, 0, 2, 0],
  ['beef', 'בקר טחון 5% מבושל', 180, 26, 0, 8, 0],
  ['thigh', 'פרגית מבושלת ללא עור', 209, 26, 0, 11, 0],
  ['salmon', 'סלמון מבושל', 208, 22, 0, 13, 0],
  ['tuna', 'טונה במים מסוננת', 116, 25.5, 0, 1, 0],
  ['eggs', 'ביצים ללא קליפה', 145, 13, 1, 10, 0],
  ['cottage', 'קוטג׳ 5%', 96, 11, 3, 5, 0],
  ['yogurt', 'יוגורט עשיר בחלבון', 66, 10, 5, 0.7, 0],
  ['whey', 'אבקת חלבון Whey', 400, 80, 8, 6, 0],
  ['rice', 'אורז מבושל', 130, 2.7, 28, 0.3, 0.4],
  ['potato', 'תפוח אדמה מבושל', 87, 1.9, 20, 0.1, 1.8],
  ['sweetpotato', 'בטטה אפויה', 90, 2, 21, 0.2, 3.3],
  ['pasta', 'פסטה מבושלת', 155, 5.8, 31, 0.9, 1.8],
  ['bulgur', 'בורגול מבושל', 83, 3.1, 19, 0.2, 4.5],
  ['bread', 'לחם מלא', 250, 10, 43, 4, 6],
  ['pita', 'פיתה', 275, 9, 55, 1.5, 2.2],
  ['oats', 'שיבולת שועל יבשה', 380, 13, 65, 7, 10],
  ['lentils', 'עדשים מבושלות', 116, 9, 20, 0.4, 7.9],
  ['banana', 'בננה ללא קליפה', 89, 1.1, 23, 0.3, 2.6],
  ['apple', 'תפוח', 52, 0.3, 14, 0.2, 2.4],
  ['veg', 'סלט ירקות ללא רוטב', 24, 1.2, 4.5, 0.2, 1.5],
  ['oil', 'שמן זית', 900, 0, 0, 100, 0],
  ['tahini', 'טחינה גולמית', 595, 17, 21, 54, 9.3],
  ['almonds', 'שקדים', 579, 21, 22, 50, 12.5],
  ['walnuts', 'אגוזי מלך', 654, 15, 14, 65, 6.7],
  ['avocado', 'אבוקדו', 160, 2, 8.5, 14.7, 6.7],
  ['pb', 'חמאת בוטנים', 590, 25, 20, 50, 6],
  ['chocolate', 'שוקולד מריר', 580, 8, 46, 42, 10],
  ['milk', 'חלב 3%', 60, 3.3, 4.8, 3, 0],
  ['hummus', 'חומוס מוכן', 220, 7, 16, 15, 5],
  ['chickpeas', 'גרגרי חומוס מבושלים', 164, 8.9, 27.4, 2.6, 7.6]
];

function catalogFood(row: LegacyFoodRow, index: number): FoodVersion {
  const [externalId, name, kcal, proteinG, carbG, fatG, fiberG] = row;
  return {
    id: fixtureUuid(0x1000 + index),
    foodId: fixtureUuid(0x2000 + index),
    source: {
      id: fixtureUuid(0x3000 + index),
      provider: 'builtin-generic',
      license: null,
      attribution: 'Generic legacy catalog estimate; verify against package label when available',
      externalId
    },
    name,
    brand: null,
    aliases: [],
    preparationState: name.includes('מבושל') || name.includes('אפויה') ? 'cooked' : name.includes('יבשה') ? 'raw' : 'unknown',
    basis: 'per-100g',
    nutrients: { kcal, proteinG, carbG, fatG, fiberG },
    servingGrams: null,
    version: 1,
    createdAt: SYNTHETIC_NOW,
    updatedAt: SYNTHETIC_NOW
  };
}

export const builtinFoods: FoodVersion[] = legacyCatalogRows.map(catalogFood);
const firstBuiltinFood = builtinFoods[0];
if (!firstBuiltinFood) throw new Error('builtin catalog is empty');
export const cookedChicken100g = firstBuiltinFood;
