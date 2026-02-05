/**
 * LMSR (Logarithmic Market Scoring Rule) Automated Market Maker
 *
 * This is the same AMM model used by Polymarket and other prediction markets.
 *
 * Key formulas:
 * - Cost function: C(q) = b * ln(Σ e^(qi/b))
 * - Price of outcome i: pi = e^(qi/b) / Σ(e^(qj/b))
 * - Cost to buy Δ shares: C(q + Δ) - C(q)
 *
 * Where:
 * - b = liquidity parameter (higher = more liquidity, lower slippage)
 * - q = vector of shares outstanding for each outcome
 * - Max loss for market maker = b * ln(n) where n = number of outcomes
 */

export interface OutcomeState {
  id: string;
  shares: number; // Total shares outstanding for this outcome
}

export interface AMMState {
  b: number; // Liquidity parameter
  outcomes: OutcomeState[];
}

/**
 * Calculate the cost function C(q) for current state
 */
export function costFunction(state: AMMState): number {
  const { b, outcomes } = state;
  const sumExp = outcomes.reduce((sum, o) => sum + Math.exp(o.shares / b), 0);
  return b * Math.log(sumExp);
}

/**
 * Get the current price (probability) for each outcome
 * Prices always sum to 1 (100%)
 */
export function getPrices(state: AMMState): Map<string, number> {
  const { b, outcomes } = state;
  const expValues = outcomes.map(o => ({ id: o.id, exp: Math.exp(o.shares / b) }));
  const sumExp = expValues.reduce((sum, e) => sum + e.exp, 0);

  const prices = new Map<string, number>();
  for (const { id, exp } of expValues) {
    prices.set(id, exp / sumExp);
  }
  return prices;
}

/**
 * Get price for a single outcome
 */
export function getPrice(state: AMMState, outcomeId: string): number {
  const prices = getPrices(state);
  return prices.get(outcomeId) || 0;
}

/**
 * Calculate the cost to buy a certain number of shares of an outcome
 * Returns: { cost, newPrice, priceImpact }
 */
export function calculateBuyCost(
  state: AMMState,
  outcomeId: string,
  sharesToBuy: number
): { cost: number; newPrice: number; priceImpact: number; avgPrice: number } {
  const oldCost = costFunction(state);
  const oldPrice = getPrice(state, outcomeId);

  // Create new state with additional shares
  const newState: AMMState = {
    b: state.b,
    outcomes: state.outcomes.map(o => ({
      id: o.id,
      shares: o.id === outcomeId ? o.shares + sharesToBuy : o.shares,
    })),
  };

  const newCost = costFunction(newState);
  const newPrice = getPrice(newState, outcomeId);

  const cost = newCost - oldCost;
  const avgPrice = cost / sharesToBuy;
  const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;

  return { cost, newPrice, priceImpact, avgPrice };
}

/**
 * Calculate proceeds from selling shares of an outcome
 * Returns: { proceeds, newPrice, priceImpact }
 */
export function calculateSellProceeds(
  state: AMMState,
  outcomeId: string,
  sharesToSell: number
): { proceeds: number; newPrice: number; priceImpact: number; avgPrice: number } {
  const oldCost = costFunction(state);
  const oldPrice = getPrice(state, outcomeId);

  // Create new state with reduced shares
  const newState: AMMState = {
    b: state.b,
    outcomes: state.outcomes.map(o => ({
      id: o.id,
      shares: o.id === outcomeId ? o.shares - sharesToSell : o.shares,
    })),
  };

  const newCost = costFunction(newState);
  const newPrice = getPrice(newState, outcomeId);

  const proceeds = oldCost - newCost;
  const avgPrice = proceeds / sharesToSell;
  const priceImpact = ((oldPrice - newPrice) / oldPrice) * 100;

  return { proceeds, newPrice, priceImpact, avgPrice };
}

/**
 * Calculate how many shares you can buy with a given amount
 * Uses binary search for precision
 */
export function calculateSharesForAmount(
  state: AMMState,
  outcomeId: string,
  amount: number,
  maxIterations = 50
): { shares: number; actualCost: number; newPrice: number } {
  let low = 0;
  let high = amount * 100; // Upper bound estimate
  let bestShares = 0;
  let bestCost = 0;
  let bestPrice = getPrice(state, outcomeId);

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const { cost, newPrice } = calculateBuyCost(state, outcomeId, mid);

    if (Math.abs(cost - amount) < 0.0001) {
      return { shares: mid, actualCost: cost, newPrice };
    }

    if (cost < amount) {
      bestShares = mid;
      bestCost = cost;
      bestPrice = newPrice;
      low = mid;
    } else {
      high = mid;
    }
  }

  return { shares: bestShares, actualCost: bestCost, newPrice: bestPrice };
}

/**
 * Calculate liquidity parameter b for a given max exposure
 * Max exposure = b * ln(numOutcomes)
 */
export function calculateLiquidityParam(maxExposure: number, numOutcomes: number): number {
  return maxExposure / Math.log(numOutcomes);
}

/**
 * Calculate max exposure for a given liquidity parameter
 */
export function calculateMaxExposure(b: number, numOutcomes: number): number {
  return b * Math.log(numOutcomes);
}

/**
 * Initialize AMM state for a new market
 * Starts with equal probabilities (50/50 for binary)
 */
export function initializeAMM(
  outcomeIds: string[],
  maxExposure: number
): AMMState {
  const b = calculateLiquidityParam(maxExposure, outcomeIds.length);

  // Start with 0 shares for each outcome (equal probabilities)
  const outcomes: OutcomeState[] = outcomeIds.map(id => ({
    id,
    shares: 0,
  }));

  return { b, outcomes };
}

/**
 * Create AMM state from database values
 */
export function createAMMState(
  liquidityParam: number,
  outcomes: { id: string; sharesOutstanding: number }[]
): AMMState {
  return {
    b: liquidityParam,
    outcomes: outcomes.map(o => ({
      id: o.id,
      shares: o.sharesOutstanding,
    })),
  };
}
