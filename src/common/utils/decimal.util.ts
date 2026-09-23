import Decimal from 'decimal.js';

type Numeric = string | number;

/** Money/decimal math. Never use JS number arithmetic for money. Results are strings with fixed scale. */
export const addDecimal = (values: Numeric[], scale = 2): string =>
  values
    .reduce<Decimal>((sum, v) => sum.plus(v), new Decimal(0))
    .toFixed(scale, Decimal.ROUND_HALF_UP);

export const multiplyDecimal = (a: Numeric, b: Numeric, scale = 2): string =>
  new Decimal(a).times(b).toFixed(scale, Decimal.ROUND_HALF_UP);

export const roundDecimal = (value: Numeric, scale = 2): string =>
  new Decimal(value).toFixed(scale, Decimal.ROUND_HALF_UP);

/** Postgres numeric ↔ string: keeps money exact (JS numbers would round it). */
export const decimalTransformer = {
  to: (value?: string | null) => value,
  from: (value: string | null): string => (value === null ? '0.00' : roundDecimal(value)),
};
