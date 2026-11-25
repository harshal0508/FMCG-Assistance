import { describe, it, expect } from 'vitest';
import {
  STANDARD_UNIT_CHAINS,
  convertUnitQuantity,
  parseOrderQuantityToBase,
  formatBaseQuantityForDisplay,
  UnitConversionError,
} from '@/lib/units';

describe('Unit Conversion & Multi-Tier Chain Engine', () => {
  describe('convertUnitQuantity', () => {
    it('converts packets to cartons accurately in discrete chain', () => {
      const chain = STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE;
      // 1 carton = 120 packets; 240 packets = 2 cartons
      expect(convertUnitQuantity(240, 'packet', 'carton', chain)).toBe(2);
      // 10 bundles = 120 packets = 1 carton
      expect(convertUnitQuantity(10, 'bundle', 'carton', chain)).toBe(1);
      // 3 cartons = 30 bundles
      expect(convertUnitQuantity(3, 'carton', 'bundle', chain)).toBe(30);
    });

    it('converts weight units accurately (gram <-> kg <-> 50kg bag)', () => {
      const chain = STANDARD_UNIT_CHAINS.WEIGHT_METRIC;
      // 2.5 kg = 2500 grams
      expect(convertUnitQuantity(2.5, 'kg', 'gram', chain)).toBe(2500);
      // 5000 grams = 5 kg
      expect(convertUnitQuantity(5000, 'gram', 'kg', chain)).toBe(5);
      // 100 kg = 2 bags of 50kg
      expect(convertUnitQuantity(100, 'kg', 'bag_50kg', chain)).toBe(2);
    });

    it('converts volume units accurately (ml <-> litre <-> 12L carton)', () => {
      const chain = STANDARD_UNIT_CHAINS.VOLUME_METRIC;
      // 1500 ml = 1.5 litres
      expect(convertUnitQuantity(1500, 'ml', 'litre', chain)).toBe(1.5);
      // 1 carton (12L) = 12000 ml
      expect(convertUnitQuantity(1, 'carton_12l', 'ml', chain)).toBe(12000);
    });

    it('throws error when unit is not found in chain', () => {
      const chain = STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE;
      expect(() => convertUnitQuantity(10, 'kg', 'packet', chain)).toThrow(UnitConversionError);
    });
  });

  describe('parseOrderQuantityToBase', () => {
    it('parses discrete order quantities into integer base units for DB storage', () => {
      const chain = STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE;
      // 5 bundles (12 pkts/bundle) = 60 packets base
      expect(parseOrderQuantityToBase(5, 'bundle', chain)).toBe(60);
      // 2 cartons (120 pkts/carton) = 240 packets base
      expect(parseOrderQuantityToBase(2, 'carton', chain)).toBe(240);
    });

    it('rejects decimal quantities for discrete units', () => {
      const chain = STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE;
      expect(() => parseOrderQuantityToBase(2.5, 'bundle', chain)).toThrow(UnitConversionError);
      expect(() => parseOrderQuantityToBase(1.1, 'carton', chain)).toThrow(UnitConversionError);
    });

    it('accepts decimal quantities for weight/volume units that allow decimals', () => {
      const chain = STANDARD_UNIT_CHAINS.WEIGHT_METRIC;
      // 3.75 kg = 3750 grams
      expect(parseOrderQuantityToBase(3.75, 'kg', chain)).toBe(3750);
      // 0.5 kg = 500 grams
      expect(parseOrderQuantityToBase(0.5, 'kg', chain)).toBe(500);
    });
  });

  describe('formatBaseQuantityForDisplay', () => {
    it('formats decimal weights cleanly', () => {
      const chain = STANDARD_UNIT_CHAINS.WEIGHT_METRIC;
      const formatted = formatBaseQuantityForDisplay(2500, 'kg', chain);
      expect(formatted.primaryQty).toBe(2.5);
      expect(formatted.primaryUnit).toBe('kg');
      expect(formatted.displayString).toBe('2.5 kg');
    });

    it('formats discrete units with remainder breakdowns', () => {
      const chain = STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE;
      // 26 packets with target "bundle" (factor 12) -> 2 bundles + 2 packets
      const formatted = formatBaseQuantityForDisplay(26, 'bundle', chain);
      expect(formatted.primaryQty).toBe(2);
      expect(formatted.primaryUnit).toBe('bundle');
      expect(formatted.remainderQty).toBe(2);
      expect(formatted.remainderUnit).toBe('packet');
      expect(formatted.displayString).toBe('2 bundle + 2 packet');
    });

    it('formats exact multiples cleanly without remainder', () => {
      const chain = STANDARD_UNIT_CHAINS.DISCRETE_PACKET_BUNDLE;
      const formatted = formatBaseQuantityForDisplay(36, 'bundle', chain);
      expect(formatted.primaryQty).toBe(3);
      expect(formatted.remainderQty).toBe(0);
      expect(formatted.displayString).toBe('3 bundle');
    });
  });
});
