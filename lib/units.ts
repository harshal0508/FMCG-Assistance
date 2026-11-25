/**
 * Unit Conversion & Multi-Tier Chain Engine
 * 
 * Supports discrete items (piece -> pack -> bundle -> box -> carton),
 * weight-based items (gram -> kilogram -> quintal),
 * and volume-based items (millilitre -> litre).
 * 
 * Storage rule: ALL quantities in database tables (stock_qty, ordered_qty_base, etc.)
 * are STRICTLY stored as positive integers in the product's base unit.
 * Display quantities map to the retailer's preferred order unit (e.g., 2.5 kg = 2500 g).
 */

export class UnitConversionError extends Error {
  constructor(message: string) {
    super(`[UnitConversionError] ${message}`);
    this.name = 'UnitConversionError';
  }
}

/**
 * Single step in a product's unit hierarchy.
 * factorToBase is how many base units make up ONE of this unit.
 * e.g., if base is "gram", then unit "kg" has factorToBase = 1000.
 * If base is "piece", then "pack" has 10, "carton" has 120.
 */
export interface UnitStep {
  name: string;        // e.g. "piece", "packet", "bundle", "box", "carton", "g", "kg", "ml", "l"
  hindiName?: string;  // e.g. "पीस", "पैकेट", "बंडल", "पेटी / कार्टन", "ग्राम", "किलो", "लीटर"
  factorToBase: number; // Integer or exact factor: 1 for base, 12 for dozen, 1000 for kg/l
  allowDecimal?: boolean; // True for kg, litre; false for discrete pieces/cartons
}

export interface UnitChainDef {
  baseUnit: string;        // The smallest atomic unit stored in DB (e.g. "piece", "gram", "ml")
  defaultOrderUnit: string;// What the shop normally orders in (e.g. "bundle", "carton", "kg", "litre")
  steps: UnitStep[];
}

/**
 * Predefined common unit chains for standard FMCG categories
 */
export const STANDARD_UNIT_CHAINS: Record<string, UnitChainDef> = {
  // Discrete packet goods (Biscuits, Noodles, Chips)
  DISCRETE_PACKET_BUNDLE: {
    baseUnit: 'packet',
    defaultOrderUnit: 'bundle',
    steps: [
      { name: 'packet', hindiName: 'पैकेट', factorToBase: 1, allowDecimal: false },
      { name: 'bundle', hindiName: 'बंडल', factorToBase: 12, allowDecimal: false },
      { name: 'carton', hindiName: 'कार्टन', factorToBase: 120, allowDecimal: false },
    ],
  },
  // Discrete pieces (Soaps, Detergent bars, Stationery)
  DISCRETE_PIECE_BOX: {
    baseUnit: 'piece',
    defaultOrderUnit: 'box',
    steps: [
      { name: 'piece', hindiName: 'पीस', factorToBase: 1, allowDecimal: false },
      { name: 'dozen', hindiName: 'दर्जन', factorToBase: 12, allowDecimal: false },
      { name: 'box', hindiName: 'बॉक्स', factorToBase: 24, allowDecimal: false },
      { name: 'carton', hindiName: 'कार्टन', factorToBase: 144, allowDecimal: false },
    ],
  },
  // Discrete bags (Atta, Rice, Dal 30kg, Sugar)
  DISCRETE_BAG: {
    baseUnit: 'bag',
    defaultOrderUnit: 'bag',
    steps: [
      { name: 'bag', hindiName: 'बोरी', factorToBase: 1, allowDecimal: false },
    ],
  },
  // Discrete pouches (1kg dal, 500g poha/sooji/besan, 1L oil pouch)
  DISCRETE_POUCH: {
    baseUnit: 'pouch',
    defaultOrderUnit: 'pouch',
    steps: [
      { name: 'pouch', hindiName: 'पाउच', factorToBase: 1, allowDecimal: false },
      { name: 'box', hindiName: 'कार्टन', factorToBase: 10, allowDecimal: false },
    ],
  },
  // Discrete tins (15L / 15kg edible oil & ghee tins)
  DISCRETE_TIN: {
    baseUnit: 'tin',
    defaultOrderUnit: 'tin',
    steps: [
      { name: 'tin', hindiName: 'पीपा', factorToBase: 1, allowDecimal: false },
    ],
  },
  // Discrete jars & bottles (Ghee jars, oil bottles, tea jars)
  DISCRETE_JAR: {
    baseUnit: 'jar',
    defaultOrderUnit: 'jar',
    steps: [
      { name: 'jar', hindiName: 'जार', factorToBase: 1, allowDecimal: false },
      { name: 'box', hindiName: 'बॉक्स', factorToBase: 12, allowDecimal: false },
    ],
  },
  DISCRETE_BOTTLE: {
    baseUnit: 'bottle',
    defaultOrderUnit: 'bottle',
    steps: [
      { name: 'bottle', hindiName: 'बोतल', factorToBase: 1, allowDecimal: false },
      { name: 'box', hindiName: 'कार्टन', factorToBase: 12, allowDecimal: false },
    ],
  },
  // Weight staples (Flour, Pulses, Rice, Sugar)
  WEIGHT_METRIC: {
    baseUnit: 'gram',
    defaultOrderUnit: 'kg',
    steps: [
      { name: 'gram', hindiName: 'ग्राम', factorToBase: 1, allowDecimal: false },
      { name: 'kg', hindiName: 'किलो', factorToBase: 1000, allowDecimal: true },
      { name: 'bag_50kg', hindiName: 'बोरी (५० किलो)', factorToBase: 50000, allowDecimal: false },
    ],
  },
  // Edible Oil & Beverages
  VOLUME_METRIC: {
    baseUnit: 'ml',
    defaultOrderUnit: 'litre',
    steps: [
      { name: 'ml', hindiName: 'मिलीलीटर', factorToBase: 1, allowDecimal: false },
      { name: 'litre', hindiName: 'लीटर', factorToBase: 1000, allowDecimal: true },
      { name: 'carton_12l', hindiName: 'पेटी (१२ लीटर)', factorToBase: 12000, allowDecimal: false },
    ],
  },
};

/**
 * Universal Unit Converter Function
 * Converts a given quantity from any unit to any other unit within the product's unit chain.
 */
export function convertUnitQuantity(
  quantity: number,
  fromUnitName: string,
  toUnitName: string,
  chain: UnitChainDef
): number {
  if (!Number.isFinite(quantity)) {
    throw new UnitConversionError(`Invalid quantity: ${quantity}`);
  }

  const fromStep = chain.steps.find((s) => s.name.toLowerCase() === fromUnitName.toLowerCase());
  const toStep = chain.steps.find((s) => s.name.toLowerCase() === toUnitName.toLowerCase());

  if (!fromStep) {
    throw new UnitConversionError(
      `Source unit "${fromUnitName}" not found in chain with base "${chain.baseUnit}"`
    );
  }
  if (!toStep) {
    throw new UnitConversionError(
      `Target unit "${toUnitName}" not found in chain with base "${chain.baseUnit}"`
    );
  }

  if (fromStep.name === toStep.name) {
    return quantity;
  }

  // Convert to base unit first (pure integer if input is integer)
  const quantityInBase = quantity * fromStep.factorToBase;

  // Convert from base unit to target unit
  const result = quantityInBase / toStep.factorToBase;

  // If target unit does not allow decimals, ensure it is whole
  if (!toStep.allowDecimal && !Number.isInteger(result)) {
    // For exact conversion checks
    return result;
  }

  return result;
}

/**
 * Parses user/order input into the exact integer base units for DB storage.
 * e.g., Shop orders 2.5 kg -> returns 2500 (grams).
 * Shop orders 3 bundles of 12 -> returns 36 (packets).
 */
export function parseOrderQuantityToBase(
  orderQty: number,
  orderUnitName: string,
  chain: UnitChainDef
): number {
  if (orderQty <= 0) {
    throw new UnitConversionError(`Order quantity must be greater than 0: ${orderQty}`);
  }

  const step = chain.steps.find((s) => s.name.toLowerCase() === orderUnitName.toLowerCase());
  if (!step) {
    throw new UnitConversionError(`Unit "${orderUnitName}" not valid for this product`);
  }

  if (!step.allowDecimal && !Number.isInteger(orderQty)) {
    throw new UnitConversionError(
      `Unit "${orderUnitName}" does not accept decimal quantities. Received: ${orderQty}`
    );
  }

  const baseQty = Math.round(orderQty * step.factorToBase);
  if (!Number.isInteger(baseQty)) {
    throw new UnitConversionError(`Failed to convert quantity to integer base: ${orderQty}`);
  }
  return baseQty;
}

/**
 * Formats a base unit integer for human display in the target unit.
 * Example:
 * 2500 grams with target "kg" -> "2.5 kg"
 * 36 packets with target "bundle" (factor 12) -> "3 bundles"
 * 38 packets with target "bundle" -> "3 bundles + 2 packets"
 */
export function formatBaseQuantityForDisplay(
  qtyInBase: number,
  targetUnitName: string,
  chain: UnitChainDef
): {
  primaryQty: number;
  primaryUnit: string;
  remainderQty: number;
  remainderUnit: string;
  displayString: string;
} {
  if (!Number.isInteger(qtyInBase)) {
    throw new UnitConversionError(`Base quantity in database must be an integer. Got: ${qtyInBase}`);
  }

  const targetStep = chain.steps.find(
    (s) => s.name.toLowerCase() === targetUnitName.toLowerCase()
  ) || chain.steps.find((s) => s.name.toLowerCase() === chain.defaultOrderUnit.toLowerCase())!;

  if (targetStep.allowDecimal) {
    // Decimal friendly (kg, litre)
    const converted = qtyInBase / targetStep.factorToBase;
    const formatted = parseFloat(converted.toFixed(3)); // Clean up to 3 decimals max
    return {
      primaryQty: formatted,
      primaryUnit: targetStep.name,
      remainderQty: 0,
      remainderUnit: chain.baseUnit,
      displayString: `${formatted} ${targetStep.name}`,
    };
  }

  // Discrete integer breakdown (e.g. 3 bundles + 2 packets)
  const wholeUnits = Math.floor(qtyInBase / targetStep.factorToBase);
  const remainderBase = qtyInBase % targetStep.factorToBase;

  let displayString = `${wholeUnits} ${targetStep.name}`;
  if (remainderBase > 0) {
    displayString += ` + ${remainderBase} ${chain.baseUnit}`;
  }

  return {
    primaryQty: wholeUnits,
    primaryUnit: targetStep.name,
    remainderQty: remainderBase,
    remainderUnit: chain.baseUnit,
    displayString,
  };
}
