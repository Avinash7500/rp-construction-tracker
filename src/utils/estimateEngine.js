const CONSTRUCTION_TYPE_RATES = {
  BASIC: 1400,
  STANDARD: 1800,
  PREMIUM: 2300,
};

const FLOOR_MULTIPLIERS = [1.0, 1.08, 1.15, 1.22, 1.3];

const PREDEFINED_EXTRAS = [
  { key: "compoundWall", label: "Compound wall", defaultCost: 180000 },
  { key: "borewell", label: "Borewell", defaultCost: 120000 },
  { key: "terraceWaterproofing", label: "Terrace waterproofing", defaultCost: 95000 },
  { key: "modularKitchen", label: "Modular kitchen", defaultCost: 250000 },
  { key: "parkingShed", label: "Parking shed", defaultCost: 90000 },
  { key: "solarProvision", label: "Solar provision", defaultCost: 80000 },
];

const DEFAULT_CATEGORY_SPLIT = [
  { key: "material", label: "Material", mode: "PERCENT", value: 50 },
  { key: "labour", label: "Labour", mode: "PERCENT", value: 25 },
  { key: "plumbing", label: "Plumbing", mode: "PERCENT", value: 6 },
  { key: "electrical", label: "Electrical", mode: "PERCENT", value: 6 },
  { key: "finishing", label: "Finishing", mode: "PERCENT", value: 10 },
  { key: "misc", label: "Miscellaneous", mode: "PERCENT", value: 3 },
];

const DEFAULT_PAYMENT_STAGES = [
  { id: "booking", stage: "Booking", trigger: "Before work starts", percent: 10 },
  { id: "foundation", stage: "Foundation", trigger: "After foundation", percent: 20 },
  { id: "firstSlab", stage: "1st Floor Slab", trigger: "Slab completion", percent: 25 },
  { id: "secondSlab", stage: "2nd Floor Slab", trigger: "Slab completion", percent: 20 },
  { id: "finishing", stage: "Finishing", trigger: "Interior start", percent: 15 },
  { id: "handover", stage: "Handover", trigger: "Final payment", percent: 10 },
];

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundMoney(value) {
  return Math.round(asNumber(value));
}

function ordinalFloorLabel(index) {
  if (index === 0) return "Ground Floor";
  if (index === 1) return "1st Floor";
  if (index === 2) return "2nd Floor";
  if (index === 3) return "3rd Floor";
  return `${index}th Floor`;
}

function getDefaultFloorMultiplier(index) {
  return FLOOR_MULTIPLIERS[index] || FLOOR_MULTIPLIERS[FLOOR_MULTIPLIERS.length - 1];
}

export function getTimelineByArea(totalArea) {
  const area = asNumber(totalArea);
  if (area <= 1000) return "6-8 months";
  if (area <= 2000) return "8-10 months";
  if (area <= 3000) return "10-12 months";
  return "12-15 months";
}

export function getDefaultRateByType(type) {
  return CONSTRUCTION_TYPE_RATES[type] || CONSTRUCTION_TYPE_RATES.STANDARD;
}

export function createDefaultFloors(totalArea = 0, count = 1, baseRate = 1800) {
  const floorCount = Math.max(1, asNumber(count, 1));
  const areaPerFloor = floorCount > 0 ? asNumber(totalArea) / floorCount : 0;

  return Array.from({ length: floorCount }, (_, index) => ({
    id: `floor_${Date.now()}_${index}`,
    name: ordinalFloorLabel(index),
    area: roundMoney(areaPerFloor),
    rate: asNumber(baseRate),
    labourMultiplier: getDefaultFloorMultiplier(index),
    multiplierReason:
      index === 0
        ? "Base labour effort at ground access."
        : "Higher elevation increases labour and lifting effort.",
  }));
}

export function createEmptyEstimate() {
  const constructionType = "STANDARD";
  const ratePerSqFt = getDefaultRateByType(constructionType);
  const totalBuiltUpArea = 1200;
  const numberOfFloors = 2;

  return {
    clientName: "",
    projectName: "",
    location: "",
    totalBuiltUpArea,
    numberOfFloors,
    constructionType,
    ratePerSqFt,
    estimatedTimeline: getTimelineByArea(totalBuiltUpArea),
    timelineManual: false,
    floorRows: createDefaultFloors(totalBuiltUpArea, numberOfFloors, ratePerSqFt),
    predefinedExtras: PREDEFINED_EXTRAS.map((x) => ({
      ...x,
      enabled: false,
      cost: x.defaultCost,
    })),
    customAddons: [],
    categorySplit: DEFAULT_CATEGORY_SPLIT.map((x) => ({ ...x })),
    paymentStages: DEFAULT_PAYMENT_STAGES.map((x) => ({ ...x })),
    status: "DRAFT",
  };
}

export function syncFloorCount(estimate) {
  const count = Math.max(1, asNumber(estimate.numberOfFloors, 1));
  const rate = asNumber(estimate.ratePerSqFt, getDefaultRateByType(estimate.constructionType));
  const existing = Array.isArray(estimate.floorRows) ? estimate.floorRows : [];
  const next = [];

  for (let i = 0; i < count; i += 1) {
    const row = existing[i];
    if (row) {
      next.push({
        ...row,
        name: row.name || ordinalFloorLabel(i),
        labourMultiplier: asNumber(row.labourMultiplier, getDefaultFloorMultiplier(i)),
        rate: asNumber(row.rate, rate),
      });
    } else {
      next.push({
        id: `floor_${Date.now()}_${i}`,
        name: ordinalFloorLabel(i),
        area: 0,
        rate,
        labourMultiplier: getDefaultFloorMultiplier(i),
        multiplierReason: "Higher elevation increases labour and lifting effort.",
      });
    }
  }
  return next;
}

export function computeEstimate(rawEstimate) {
  const estimate = rawEstimate || createEmptyEstimate();
  const floorRows = (estimate.floorRows || []).map((row, index) => {
    const area = asNumber(row.area);
    const rate = asNumber(row.rate, asNumber(estimate.ratePerSqFt));
    const labourMultiplier = asNumber(row.labourMultiplier, getDefaultFloorMultiplier(index));
    const floorCost = roundMoney(area * rate * labourMultiplier);

    return {
      ...row,
      area,
      rate,
      labourMultiplier,
      floorCost,
      formula: `${area} × ${rate} × ${labourMultiplier.toFixed(2)}`,
      multiplierReason:
        row.multiplierReason ||
        (index === 0
          ? "Base labour effort at ground access."
          : "Higher floors need additional labour and lifting effort."),
    };
  });

  const floorsTotal = floorRows.reduce((sum, row) => sum + row.floorCost, 0);

  const predefinedExtras = (estimate.predefinedExtras || []).map((item) => ({
    ...item,
    cost: roundMoney(item.cost),
  }));
  const selectedPredefinedTotal = predefinedExtras
    .filter((item) => item.enabled)
    .reduce((sum, item) => sum + roundMoney(item.cost), 0);

  const customAddons = (estimate.customAddons || []).map((item) => {
    const quantity = asNumber(item.quantity);
    const unitCost = asNumber(item.unitCost);
    const total = roundMoney(quantity * unitCost);
    return {
      ...item,
      quantity,
      unitCost,
      total,
    };
  });
  const customAddonTotal = customAddons.reduce((sum, item) => sum + item.total, 0);
  const extrasTotal = selectedPredefinedTotal + customAddonTotal;
  const totalEstimate = roundMoney(floorsTotal + extrasTotal);

  // Supports percent override OR direct amount override while keeping
  // all values normalized for a predictable presentation breakdown.
  const categorySplit = (estimate.categorySplit || []).map((row) => {
    const mode = row.mode === "AMOUNT" ? "AMOUNT" : "PERCENT";
    const value = asNumber(row.value);
    const amount = mode === "AMOUNT" ? roundMoney(value) : roundMoney((totalEstimate * value) / 100);
    const percent = totalEstimate > 0 ? Number(((amount / totalEstimate) * 100).toFixed(2)) : 0;
    return {
      ...row,
      mode,
      value,
      amount,
      percent,
    };
  });

  const paymentStages = (estimate.paymentStages || []).map((stage) => {
    const percent = asNumber(stage.percent);
    return {
      ...stage,
      percent,
      amount: roundMoney((totalEstimate * percent) / 100),
    };
  });
  const paymentPercentTotal = Number(
    paymentStages.reduce((sum, stage) => sum + asNumber(stage.percent), 0).toFixed(2),
  );

  const totalArea = floorRows.reduce((sum, row) => sum + asNumber(row.area), 0);
  const costPerSqFt = totalArea > 0 ? Math.round(totalEstimate / totalArea) : 0;

  return {
    ...estimate,
    floorRows,
    predefinedExtras,
    customAddons,
    categorySplit,
    paymentStages,
    floorsTotal,
    selectedPredefinedTotal,
    customAddonTotal,
    extrasTotal,
    totalEstimate,
    totalArea,
    costPerSqFt,
    paymentPercentTotal,
  };
}

export const ESTIMATE_CONSTANTS = {
  CONSTRUCTION_TYPE_RATES,
  PREDEFINED_EXTRAS,
  DEFAULT_PAYMENT_STAGES,
  DEFAULT_CATEGORY_SPLIT,
};
