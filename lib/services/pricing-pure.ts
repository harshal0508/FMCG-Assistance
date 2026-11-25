/**
 * Pure FMCG Pricing & Order Validation Engine
 * 
 * 100% pure function with ZERO database, network, or server-only dependencies.
 * Can execute in any JavaScript environment (Node, Browser, Edge).
 * 
 * Rules Enforced:
 * 1. Client-supplied rates and totals are completely ignored — all pricing is recomputed from catalog data.
 * 2. GST is strictly disabled unless `tenant.enableGst === true`. When disabled, GST is 0 and total equals sum of lines.
 * 3. Daily maximum limits are enforced in base units across unit chains.
 * 4. Cut-off times and "today" are calculated using the tenant's specified timezone (e.g. Asia/Kolkata), never server time.
 * 5. Strict credit hold blocks and soft credit limit warnings.
 */

export interface PureProduct {
  id: string;
  name: string;
  ratePaise: number;
  stockQty: number;
  inStockFlag: boolean;
  dailyMaxBaseUnits: number | null;
  baseUnit: string;
  gstRatePercent?: number; // Only applied if tenant.enableGst is true
}

export interface PureShop {
  id: string;
  name: string;
  creditHold: boolean;
  creditLimitPaise: number;
  currentBalancePaise: number;
  rateOverrides?: Record<string, number>; // tenantProductId -> ratePaise
}

export interface PureTenant {
  timezone: string;           // e.g. "Asia/Kolkata"
  orderCutoffTime: string;    // e.g. "18:00" in HH:mm 24-hr format
  enableGst: boolean;         // Default: false
}

export interface PureOrderItemInput {
  tenantProductId: string;
  orderQty?: number;
  displayQty?: number;
  orderUnitName?: string;
  conversionFactor?: number;  // Multiplier to base unit. Default = 1.
  clientPricePaise?: number;  // Must be ignored!
}

export interface PureLineResult {
  tenantProductId: string;
  productName: string;
  orderUnitName: string;
  orderQty: number;
  displayQty: number;
  quantityBase: number;
  baseRatePaise: number;
  effectiveRatePaise: number;
  isOverridden: boolean;
  lineSubtotalPaise: number;
  gstPaise: number;
  lineTotalPaise: number;
  stockAvailable: number;
  isOutOfStock: boolean;
}

export interface PurePricingResult {
  allowed: boolean;
  blockReason?: string;
  warnings: string[];
  lines: PureLineResult[];
  subtotalPaise: number;
  discountPaise: number;
  gstPaise: number;
  totalPaise: number;
  shopCredit: {
    creditLimitPaise: number;
    currentBalancePaise: number;
    projectedBalancePaise: number;
    isExceeded: boolean;
    isOnHold: boolean;
  };
  cutoffInfo: {
    isPastCutoff: boolean;
    cutoffTime: string;
    localCurrentTime: string;
    timezone: string;
  };
}

/**
 * Gets current HH:mm in the specified IANA timezone.
 */
export function getCurrentTimeInZone(timezone = 'Asia/Kolkata', referenceDate = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(referenceDate);
  } catch {
    // Fallback to UTC if timezone is invalid
    const h = String(referenceDate.getUTCHours()).padStart(2, '0');
    const m = String(referenceDate.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/**
 * Calculates complete order pricing, GST, and validation rules purely.
 */
export function calculatePureOrderPricing(
  tenant: PureTenant,
  shop: PureShop,
  productsMap: Map<string, PureProduct>,
  items: PureOrderItemInput[],
  options: { checkStock?: boolean; checkCutoff?: boolean; referenceDate?: Date } = {
    checkStock: true,
    checkCutoff: true,
  }
): PurePricingResult {
  const warnings: string[] = [];
  const lines: PureLineResult[] = [];

  // 1. Strict Credit Hold Check
  if (shop.creditHold) {
    return {
      allowed: false,
      blockReason: `Shop "${shop.name}" is on Credit Hold. Order placement is blocked (उधारी रोक लगी है).`,
      warnings: [],
      lines: [],
      subtotalPaise: 0,
      discountPaise: 0,
      gstPaise: 0,
      totalPaise: 0,
      shopCredit: {
        creditLimitPaise: shop.creditLimitPaise,
        currentBalancePaise: shop.currentBalancePaise,
        projectedBalancePaise: shop.currentBalancePaise,
        isExceeded: false,
        isOnHold: true,
      },
      cutoffInfo: {
        isPastCutoff: false,
        cutoffTime: tenant.orderCutoffTime,
        localCurrentTime: getCurrentTimeInZone(tenant.timezone, options.referenceDate),
        timezone: tenant.timezone,
      },
    };
  }

  // 2. Timezone-Aware Cut-off Evaluation
  const localCurrentTime = getCurrentTimeInZone(tenant.timezone, options.referenceDate);
  const isPastCutoff = options.checkCutoff !== false && localCurrentTime > tenant.orderCutoffTime;
  if (isPastCutoff) {
    warnings.push(
      `Order submitted after daily cutoff time of ${tenant.orderCutoffTime} (${tenant.timezone}). Will be scheduled for next delivery cycle.`
    );
  }

  let subtotalPaise = 0;
  let totalGstPaise = 0;

  // 3. Process Line Items
  for (const item of items) {
    const effectiveQty = item.orderQty ?? item.displayQty ?? 0;
    if (effectiveQty <= 0) continue;

    const prod = productsMap.get(item.tenantProductId);
    if (!prod) {
      return {
        allowed: false,
        blockReason: `Product ID "${item.tenantProductId}" not found in distributor catalog.`,
        warnings,
        lines: [],
        subtotalPaise: 0,
        discountPaise: 0,
        gstPaise: 0,
        totalPaise: 0,
        shopCredit: {
          creditLimitPaise: shop.creditLimitPaise,
          currentBalancePaise: shop.currentBalancePaise,
          projectedBalancePaise: shop.currentBalancePaise,
          isExceeded: false,
          isOnHold: false,
        },
        cutoffInfo: {
          isPastCutoff,
          cutoffTime: tenant.orderCutoffTime,
          localCurrentTime,
          timezone: tenant.timezone,
        },
      };
    }

    // Convert ordered quantity to base unit (grams, ml, pcs)
    const factor = item.conversionFactor && item.conversionFactor > 0 ? item.conversionFactor : 1;
    const qtyBase = Math.round(effectiveQty * factor);

    // Enforce daily maximum quota in base units across unit chains
    if (prod.dailyMaxBaseUnits !== null && prod.dailyMaxBaseUnits > 0) {
      if (qtyBase > prod.dailyMaxBaseUnits) {
        return {
          allowed: false,
          blockReason: `Order quantity for "${prod.name}" (${qtyBase} ${prod.baseUnit}) exceeds daily quota limit of ${prod.dailyMaxBaseUnits} ${prod.baseUnit}.`,
          warnings,
          lines: [],
          subtotalPaise: 0,
          discountPaise: 0,
          gstPaise: 0,
          totalPaise: 0,
          shopCredit: {
            creditLimitPaise: shop.creditLimitPaise,
            currentBalancePaise: shop.currentBalancePaise,
            projectedBalancePaise: shop.currentBalancePaise,
            isExceeded: false,
            isOnHold: false,
          },
          cutoffInfo: {
            isPastCutoff,
            cutoffTime: tenant.orderCutoffTime,
            localCurrentTime,
            timezone: tenant.timezone,
          },
        };
      }
    }

    // Stock check
    let isOutOfStock = false;
    if (options.checkStock !== false) {
      if (!prod.inStockFlag) {
        return {
          allowed: false,
          blockReason: `Product "${prod.name}" is Out of Stock.`,
          warnings,
          lines: [],
          subtotalPaise: 0,
          discountPaise: 0,
          gstPaise: 0,
          totalPaise: 0,
          shopCredit: {
            creditLimitPaise: shop.creditLimitPaise,
            currentBalancePaise: shop.currentBalancePaise,
            projectedBalancePaise: shop.currentBalancePaise,
            isExceeded: false,
            isOnHold: false,
          },
          cutoffInfo: {
            isPastCutoff,
            cutoffTime: tenant.orderCutoffTime,
            localCurrentTime,
            timezone: tenant.timezone,
          },
        };
      }
      if (qtyBase > prod.stockQty) {
        return {
          allowed: false,
          blockReason: `Insufficient stock for "${prod.name}". Requested ${qtyBase} ${prod.baseUnit}, but only ${prod.stockQty} ${prod.baseUnit} available.`,
          warnings,
          lines: [],
          subtotalPaise: 0,
          discountPaise: 0,
          gstPaise: 0,
          totalPaise: 0,
          shopCredit: {
            creditLimitPaise: shop.creditLimitPaise,
            currentBalancePaise: shop.currentBalancePaise,
            projectedBalancePaise: shop.currentBalancePaise,
            isExceeded: false,
            isOnHold: false,
          },
          cutoffInfo: {
            isPastCutoff,
            cutoffTime: tenant.orderCutoffTime,
            localCurrentTime,
            timezone: tenant.timezone,
          },
        };
      }
    }

    // Resolve rate: Check per-shop / rate group override, fallback to product base rate
    // Note: item.clientPricePaise is strictly ignored!
    const override = shop.rateOverrides ? shop.rateOverrides[prod.id] : undefined;
    const effectiveRatePaise = override !== undefined ? override : prod.ratePaise;
    const isOverridden = override !== undefined && override !== prod.ratePaise;

    const lineSubtotalPaise = Math.round(effectiveQty * effectiveRatePaise);

    // GST calculation: strictly 0 unless tenant explicitly has enableGst === true
    let lineGstPaise = 0;
    if (tenant.enableGst && prod.gstRatePercent && prod.gstRatePercent > 0) {
      lineGstPaise = Math.round((lineSubtotalPaise * prod.gstRatePercent) / 100);
    }

    const lineTotalPaise = lineSubtotalPaise + lineGstPaise;

    subtotalPaise += lineSubtotalPaise;
    totalGstPaise += lineGstPaise;

    lines.push({
      tenantProductId: prod.id,
      productName: prod.name,
      orderUnitName: item.orderUnitName || prod.baseUnit,
      orderQty: effectiveQty,
      displayQty: effectiveQty,
      quantityBase: qtyBase,
      baseRatePaise: prod.ratePaise,
      effectiveRatePaise,
      isOverridden,
      lineSubtotalPaise,
      gstPaise: lineGstPaise,
      lineTotalPaise,
      stockAvailable: prod.stockQty,
      isOutOfStock,
    });
  }

  const discountPaise = 0; // Pure schemes evaluation can populate if schemes applied
  // If GST is disabled, totalPaise MUST strictly equal subtotalPaise - discountPaise
  const totalPaise = subtotalPaise - discountPaise + (tenant.enableGst ? totalGstPaise : 0);

  // 4. Shop Credit Limit Evaluation
  const projectedBalancePaise = shop.currentBalancePaise + totalPaise;
  const isCreditExceeded =
    shop.creditLimitPaise > 0 && projectedBalancePaise > shop.creditLimitPaise;

  if (isCreditExceeded) {
    const excessRupees = ((projectedBalancePaise - shop.creditLimitPaise) / 100).toFixed(2);
    const limitRupees = (shop.creditLimitPaise / 100).toFixed(2);
    warnings.push(
      `Order total exceeds the shop's credit threshold of ₹${limitRupees} by ₹${excessRupees} (उधारी सीमा से अधिक).`
    );
  }

  return {
    allowed: true,
    warnings,
    lines,
    subtotalPaise,
    discountPaise,
    gstPaise: tenant.enableGst ? totalGstPaise : 0,
    totalPaise,
    shopCredit: {
      creditLimitPaise: shop.creditLimitPaise,
      currentBalancePaise: shop.currentBalancePaise,
      projectedBalancePaise,
      isExceeded: isCreditExceeded,
      isOnHold: false,
    },
    cutoffInfo: {
      isPastCutoff,
      cutoffTime: tenant.orderCutoffTime,
      localCurrentTime,
      timezone: tenant.timezone,
    },
  };
}
