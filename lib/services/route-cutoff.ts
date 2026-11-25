import { prisma } from '@/lib/db/prisma';

export interface RouteCutoffResult {
  cutoffTime: string; // e.g. "18:00"
  cutoffTimeFormatted: string; // e.g. "18:00 IST"
  isPastCutoff: boolean;
  minutesRemaining: number;
  secondsRemaining: number;
  orderDayName: string;
  packingDayName: string;
  deliveryDayName: string;
  deliveryDateFormatted: string; // e.g. "Tuesday, 25 Nov 2026"
  deliveryNotice: string;
  deliveryNoticeHindi: string;
  routeGroupName?: string;
  areaName?: string;
}

const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_HI = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns current date and time components computed strictly in Asia/Kolkata timezone.
 */
export function getKolkataZonedTime(refDate: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0-6 (0=Sunday)
  hours: number;
  minutes: number;
  seconds: number;
  dateString: string; // "YYYYMMDD"
  rawDate: Date;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(refDate);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hours = parseInt(partMap.hour, 10);
  const minutes = parseInt(partMap.minute, 10);
  const seconds = parseInt(partMap.second, 10);

  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayOfWeek = shortDays.indexOf(partMap.weekday);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateString = `${year}${pad(month)}${pad(day)}`;

  return {
    year,
    month,
    day,
    dayOfWeek: dayOfWeek >= 0 ? dayOfWeek : 0,
    hours,
    minutes,
    seconds,
    dateString,
    rawDate: refDate,
  };
}

function formatTargetDate(baseRef: Date, daysToAdd: number): string {
  const target = new Date(baseRef.getTime() + daysToAdd * 86400000);
  const k = getKolkataZonedTime(target);
  return `${DAY_NAMES_EN[k.dayOfWeek]}, ${k.day} ${MONTH_NAMES[k.month - 1]} ${k.year}`;
}

/**
 * Computes exact route-based cut-off, countdown, and scheduled delivery date for a shop
 * from its assigned RouteGroup and RouteSchedule in Asia/Kolkata (F4 compliance).
 */
export async function getShopRouteCutoffInfo(
  shopId: string,
  refDate: Date = new Date()
): Promise<RouteCutoffResult> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      tenant: true,
      area: {
        include: {
          route_areas: {
            include: {
              route_group: {
                include: {
                  schedules: {
                    where: { is_active: true },
                    orderBy: { order_day_of_week: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!shop) {
    throw new Error(`Shop not found: ${shopId}`);
  }

  const kolkata = getKolkataZonedTime(refDate);
  const currentTotalSeconds = kolkata.hours * 3600 + kolkata.minutes * 60 + kolkata.seconds;

  const routeArea = shop.area?.route_areas[0];
  const routeGroup = routeArea?.route_group;
  const schedules = routeGroup?.schedules || [];
  const areaName = shop.area?.name || 'Area';

  // 1. Check schedule for today
  const todaySchedule = schedules.find((s) => s.order_day_of_week === kolkata.dayOfWeek);

  if (todaySchedule) {
    const [cHoursStr, cMinsStr] = todaySchedule.order_cutoff_time.split(':');
    const cutoffHours = parseInt(cHoursStr, 10);
    const cutoffMins = parseInt(cMinsStr, 10);
    const cutoffTotalSeconds = cutoffHours * 3600 + cutoffMins * 60;

    const diffSeconds = cutoffTotalSeconds - currentTotalSeconds;

    if (diffSeconds > 0) {
      // Before cut-off today!
      const minutesRemaining = Math.floor(diffSeconds / 60);
      const secondsRemaining = diffSeconds % 60;

      // Calculate days until delivery
      const daysUntilDelivery = (todaySchedule.delivery_day_of_week - kolkata.dayOfWeek + 7) % 7 || 7;
      const deliveryDateFormatted = formatTargetDate(refDate, daysUntilDelivery);

      const orderDayName = DAY_NAMES_EN[todaySchedule.order_day_of_week];
      const packingDayName = DAY_NAMES_EN[todaySchedule.packing_day_of_week];
      const deliveryDayName = DAY_NAMES_EN[todaySchedule.delivery_day_of_week];

      const deliveryNotice = `Orders placed before ${todaySchedule.order_cutoff_time} IST are packed ${packingDayName} and delivered on ${deliveryDateFormatted} (${areaName} route)`;
      const deliveryNoticeHindi = `${todaySchedule.order_cutoff_time} IST से पहले के ऑर्डर: पैकिंग ${DAY_NAMES_HI[todaySchedule.packing_day_of_week]}, डिलीवरी ${deliveryDateFormatted} (${areaName} रूट)`;

      return {
        cutoffTime: todaySchedule.order_cutoff_time,
        cutoffTimeFormatted: `${todaySchedule.order_cutoff_time} IST`,
        isPastCutoff: false,
        minutesRemaining,
        secondsRemaining,
        orderDayName,
        packingDayName,
        deliveryDayName,
        deliveryDateFormatted,
        deliveryNotice,
        deliveryNoticeHindi,
        routeGroupName: routeGroup?.name,
        areaName,
      };
    }
  }

  // 2. Fallback / Past Cut-Off / Off-Day: find next available order schedule
  let nextSchedule: (typeof schedules)[0] | undefined;
  let daysUntilNextOrder = 0;

  for (let offset = 1; offset <= 7; offset++) {
    const targetDay = (kolkata.dayOfWeek + offset) % 7;
    const match = schedules.find((s) => s.order_day_of_week === targetDay);
    if (match) {
      nextSchedule = match;
      daysUntilNextOrder = offset;
      break;
    }
  }

  if (nextSchedule) {
    const daysFromNextOrderToDelivery = (nextSchedule.delivery_day_of_week - nextSchedule.order_day_of_week + 7) % 7 || 7;
    const totalDaysToDelivery = daysUntilNextOrder + daysFromNextOrderToDelivery;
    const deliveryDateFormatted = formatTargetDate(refDate, totalDaysToDelivery);

    const orderDayName = DAY_NAMES_EN[nextSchedule.order_day_of_week];
    const packingDayName = DAY_NAMES_EN[nextSchedule.packing_day_of_week];
    const deliveryDayName = DAY_NAMES_EN[nextSchedule.delivery_day_of_week];

    const deliveryNotice = `Cut-off for today has passed. Next order dispatch: order ${orderDayName} (cut-off ${nextSchedule.order_cutoff_time} IST), packed ${packingDayName}, delivered on ${deliveryDateFormatted} (${areaName} route)`;
    const deliveryNoticeHindi = `आज का कट-ऑफ़ समाप्त हो गया है। अगला डिस्पैच: ऑर्डर ${DAY_NAMES_HI[nextSchedule.order_day_of_week]}, पैकिंग ${DAY_NAMES_HI[nextSchedule.packing_day_of_week]}, डिलीवरी ${deliveryDateFormatted} (${areaName} रूट)`;

    return {
      cutoffTime: nextSchedule.order_cutoff_time,
      cutoffTimeFormatted: `${nextSchedule.order_cutoff_time} IST`,
      isPastCutoff: true,
      minutesRemaining: 0,
      secondsRemaining: 0,
      orderDayName,
      packingDayName,
      deliveryDayName,
      deliveryDateFormatted,
      deliveryNotice,
      deliveryNoticeHindi,
      routeGroupName: routeGroup?.name,
      areaName,
    };
  }

  // Default fallback if no schedules configured for route
  const fallbackCutoff = shop.tenant.order_cutoff_time || '18:00';
  const deliveryDateFormatted = formatTargetDate(refDate, 1);
  return {
    cutoffTime: fallbackCutoff,
    cutoffTimeFormatted: `${fallbackCutoff} IST`,
    isPastCutoff: true,
    minutesRemaining: 0,
    secondsRemaining: 0,
    orderDayName: DAY_NAMES_EN[kolkata.dayOfWeek],
    packingDayName: DAY_NAMES_EN[kolkata.dayOfWeek],
    deliveryDayName: DAY_NAMES_EN[(kolkata.dayOfWeek + 1) % 7],
    deliveryDateFormatted,
    deliveryNotice: `Cut-off for today has passed. Next delivery scheduled on ${deliveryDateFormatted}`,
    deliveryNoticeHindi: `आज का कट-ऑफ़ समाप्त हो गया है। अगली डिलीवरी ${deliveryDateFormatted} को निर्धारित है`,
    routeGroupName: routeGroup?.name,
    areaName,
  };
}
