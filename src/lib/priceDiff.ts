/**
 * What changed about a product's money, in words a manager can confirm.
 *
 * NOTE: (§8.3) Only money and stock are worth interrupting a save for, and the
 * editor asks before writing either.
 */

export interface MoneySnapshot {
  price: string;
  promotionalPrice: string;
  stock: string;
}

export interface MoneyChange {
  what: string;
  from: string;
  to: string;
}

export function moneySnapshot(price: string, promotionalPrice: string, stock: string): MoneySnapshot {
  return { price, promotionalPrice, stock };
}

/**
 * Compares current form state against initial snapshot.
 *
 * @param now Current form values.
 * @param before Initial loaded values or null for new products.
 * @returns List of detected changes requiring manager confirmation.
 */
export function moneyChanges(now: MoneySnapshot, before: MoneySnapshot | null): MoneyChange[] {
  if (!before) return [];
  const changes: MoneyChange[] = [];

  if (before.price !== now.price) {
    changes.push({ what: "Price", from: `${before.price} ₴`, to: `${now.price} ₴` });
  }
  if (before.promotionalPrice !== now.promotionalPrice) {
    changes.push({
      what: "Promotional price",
      from: before.promotionalPrice ? `${before.promotionalPrice} ₴` : "none",
      to: now.promotionalPrice ? `${now.promotionalPrice} ₴` : "none",
    });
  }
  if (before.stock !== now.stock) {
    changes.push({ what: "Stock", from: `${before.stock} pcs`, to: `${now.stock} pcs` });
  }

  return changes;
}

