/**
 * Utility functions for generating metric conclusions and interpretations
 */

type TFunc = (key: string, params?: Record<string, unknown>) => string;

/**
 * Generate performance conclusion based on relative performance percentage
 */
export function getPerformanceConclusion(
  relativePerf: number,
  period: string,
  assetPerf: number | null,
  t: TFunc
): string {
  // Exceptional outlier (penny stock or major disruption)
  if (Math.abs(relativePerf) > 500) {
    return assetPerf && assetPerf > 500
      ? t("assets.conclusions.performance.exceptionalOutlierPositive")
      : t("assets.conclusions.performance.exceptionalOutlierNegative");
  }

  // Very strong performance ranges
  if (relativePerf > 50) {
    return period === "1y"
      ? t("assets.conclusions.performance.veryStrongLongTerm")
      : t("assets.conclusions.performance.veryStrongOtherPeriods", { period });
  }
  if (relativePerf < -50) {
    return t("assets.conclusions.performance.severeUnderperformance");
  }

  // Strong performance ranges
  if (relativePerf > 20) {
    return period === "ytd" || period === "1y"
      ? t("assets.conclusions.performance.strongLongTerm")
      : t("assets.conclusions.performance.strongShortTerm");
  }
  if (relativePerf < -20) {
    return t("assets.conclusions.performance.significantUnderperformance");
  }

  // Moderate ranges
  if (relativePerf > 5) {
    return t("assets.conclusions.performance.moderateOutperformance");
  }
  if (relativePerf < -5) {
    return t("assets.conclusions.performance.moderateUnderperformance");
  }

  // In-line with benchmark
  return t("assets.conclusions.performance.inLineWithBenchmark");
}

/**
 * Generate volatility conclusion
 */
export function getVolatilityConclusion(vol: number, t: TFunc): string {
  if (vol > 60) {
    return t("assets.conclusions.volatility.veryHigh");
  }
  if (vol > 40) {
    return t("assets.conclusions.volatility.high");
  }
  if (vol > 20) {
    return t("assets.conclusions.volatility.moderate");
  }
  return t("assets.conclusions.volatility.low");
}

/**
 * Generate beta conclusion
 */
export function getBetaConclusion(beta: number, t: TFunc): string {
  if (beta > 1.5) {
    return t("assets.conclusions.beta.high");
  }
  if (beta > 1.2) {
    return t("assets.conclusions.beta.aboveAverage");
  }
  if (beta >= 0.8 && beta <= 1.2) {
    return t("assets.conclusions.beta.marketLike");
  }
  if (beta >= 0.5 && beta < 0.8) {
    return t("assets.conclusions.beta.defensive");
  }
  if (beta >= 0) {
    return t("assets.conclusions.beta.low");
  }
  return t("assets.conclusions.beta.negative");
}

/**
 * Generate risk score conclusion
 */
export function getRiskScoreConclusion(score: number, t: TFunc): string {
  if (score >= 80) {
    return t("assets.conclusions.risk.extreme");
  }
  if (score >= 60) {
    return t("assets.conclusions.risk.high");
  }
  if (score >= 40) {
    return t("assets.conclusions.risk.moderate");
  }
  if (score >= 20) {
    return t("assets.conclusions.risk.low");
  }
  return t("assets.conclusions.risk.veryLow");
}

export type MarketCapTier = "megacap" | "largecap" | "midcap" | "smallcap" | "microcap";

/**
 * Classify a market cap value (in its native currency) into a tier
 */
export function getMarketCapTier(marketCap: number): MarketCapTier {
  if (marketCap >= 200_000_000_000) return "megacap";
  if (marketCap >= 10_000_000_000) return "largecap";
  if (marketCap >= 2_000_000_000) return "midcap";
  if (marketCap >= 300_000_000) return "smallcap";
  return "microcap";
}

/**
 * Generate market cap conclusion
 */
export function getMarketCapConclusion(marketCap: number, t: TFunc): string {
  return t(`assets.conclusions.marketCap.${getMarketCapTier(marketCap)}`);
}

/**
 * Generate P/E ratio conclusion
 */
export function getPEConclusion(peRatio: number, t: TFunc): string {
  if (peRatio < 0) {
    return t("assets.conclusions.peRatio.nonProfitable");
  }
  return t("assets.conclusions.peRatio.profitable");
}

/**
 * Generate volume conclusion
 */
export function getVolumeConclusion(volume: number, avgVolume: number, t: TFunc): string {
  if (!volume || !avgVolume || avgVolume <= 0) {
    return t("assets.conclusions.volume.unknown");
  }

  const ratio = volume / avgVolume;

  if (ratio >= 2) {
    return t("assets.conclusions.volume.veryHigh");
  }
  if (ratio >= 1.2) {
    return t("assets.conclusions.volume.aboveAverage");
  }
  if (ratio > 0.8) {
    return t("assets.conclusions.volume.inLine");
  }
  if (ratio > 0.4) {
    return t("assets.conclusions.volume.belowAverage");
  }
  return t("assets.conclusions.volume.veryLow");
}

/**
 * Generate EPS conclusion
 */
export function getEpsConclusion(eps: number, t: TFunc): string {
  if (eps > 0.5) {
    return t("assets.conclusions.eps.profitable");
  }
  if (eps >= -0.5 && eps <= 0.5) {
    return t("assets.conclusions.eps.breakEven");
  }
  if (eps > -10) {
    return t("assets.conclusions.eps.negative");
  }
  if (eps > -50) {
    return t("assets.conclusions.eps.heavyLoss");
  }
  return t("assets.conclusions.eps.severeLoss");
}

/**
 * Generate liquidity score conclusion
 */
export function getLiquidityScoreConclusion(liquidityScore: number, t: TFunc): string {
  if (liquidityScore >= 90) {
    return t("assets.conclusions.liquidityScore.excellent");
  }
  if (liquidityScore >= 70) {
    return t("assets.conclusions.liquidityScore.good");
  }
  if (liquidityScore >= 40) {
    return t("assets.conclusions.liquidityScore.average");
  }
  if (liquidityScore >= 20) {
    return t("assets.conclusions.liquidityScore.belowAverage");
  }
  return t("assets.conclusions.liquidityScore.poor");
}

/**
 * Generate revenue growth conclusion
 */
export function getRevenueGrowthConclusion(
  revenueGrowthPct: number | null | undefined,
  t: TFunc
): string {
  if (revenueGrowthPct == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  const v = revenueGrowthPct;
  if (v > 30) return t("assets.conclusions.growth.revenue.hyperGrowth");
  if (v > 15) return t("assets.conclusions.growth.revenue.strongGrowth");
  if (v > 5) return t("assets.conclusions.growth.revenue.moderateGrowth");
  if (v > 0) return t("assets.conclusions.growth.revenue.lowGrowth");
  return t("assets.conclusions.growth.revenue.declining");
}

/**
 * Generate earnings growth conclusion
 */
export function getEarningsGrowthConclusion(
  earningsGrowthPct: number | null | undefined,
  t: TFunc
): string {
  if (earningsGrowthPct == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  const v = earningsGrowthPct;
  if (v > 30) return t("assets.conclusions.growth.earnings.exceptional");
  if (v > 10) return t("assets.conclusions.growth.earnings.healthy");
  if (v > 0) return t("assets.conclusions.growth.earnings.mild");
  return t("assets.conclusions.growth.earnings.declining");
}

/**
 * Generate net margin conclusion
 */
export function getNetMarginConclusion(
  netMarginPct: number | null | undefined,
  t: TFunc
): string {
  if (netMarginPct == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  const v = netMarginPct;
  if (v > 20) return t("assets.conclusions.margins.net.excellent");
  if (v > 10) return t("assets.conclusions.margins.net.good");
  if (v > 5) return t("assets.conclusions.margins.net.moderate");
  if (v > 0) return t("assets.conclusions.margins.net.low");
  return t("assets.conclusions.margins.net.negative");
}

/**
 * Generate operating margin conclusion
 */
export function getOperatingMarginConclusion(
  opMarginPct: number | null | undefined,
  t: TFunc
): string {
  if (opMarginPct == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  const v = opMarginPct;
  if (v > 25) return t("assets.conclusions.margins.operating.highlyEfficient");
  if (v > 10) return t("assets.conclusions.margins.operating.good");
  if (v > 0) return t("assets.conclusions.margins.operating.low");
  return t("assets.conclusions.margins.operating.negative");
}

/**
 * Generate ROE conclusion
 */
export function getRoeConclusion(
  roePct: number | null | undefined,
  t: TFunc
): string {
  if (roePct == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  const v = roePct;
  if (v > 20) return t("assets.conclusions.roe.excellent");
  if (v > 10) return t("assets.conclusions.roe.healthy");
  if (v > 5) return t("assets.conclusions.roe.moderate");
  if (v > 0) return t("assets.conclusions.roe.low");
  return t("assets.conclusions.roe.negative");
}

/**
 * Generate net cash position conclusion
 */
export function getNetCashConclusion(
  netCash: number | null | undefined,
  t: TFunc
): string {
  if (netCash == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  if (netCash > 0) return t("assets.conclusions.balanceSheet.netCash");
  if (netCash === 0) return t("assets.conclusions.balanceSheet.neutral");
  return t("assets.conclusions.balanceSheet.netDebt");
}

/**
 * Generate debt-to-equity conclusion
 */
export function getDebtToEquityConclusion(
  debtToEquityPct: number | null | undefined,
  t: TFunc
): string {
  if (debtToEquityPct == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  const v = debtToEquityPct;
  if (v < 50) return t("assets.conclusions.balanceSheet.dte.lowLeverage");
  if (v < 100) return t("assets.conclusions.balanceSheet.dte.moderateLeverage");
  if (v < 200) return t("assets.conclusions.balanceSheet.dte.highLeverage");
  return t("assets.conclusions.balanceSheet.dte.veryHighLeverage");
}

/**
 * Generate current ratio conclusion
 */
export function getCurrentRatioConclusion(
  currentRatio: number | null | undefined,
  t: TFunc
): string {
  if (currentRatio == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  const v = currentRatio;
  if (v > 2) return t("assets.conclusions.balanceSheet.current.veryStrong");
  if (v >= 1) return t("assets.conclusions.balanceSheet.current.healthy");
  if (v >= 0.8) return t("assets.conclusions.balanceSheet.current.tight");
  return t("assets.conclusions.balanceSheet.current.weak");
}

/**
 * Generate quick ratio conclusion
 */
export function getQuickRatioConclusion(
  quickRatio: number | null | undefined,
  t: TFunc
): string {
  if (quickRatio == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  const v = quickRatio;
  if (v > 1.5) return t("assets.conclusions.balanceSheet.quick.excellent");
  if (v >= 1) return t("assets.conclusions.balanceSheet.quick.adequate");
  if (v >= 0.5) return t("assets.conclusions.balanceSheet.quick.weak");
  return t("assets.conclusions.balanceSheet.quick.veryWeak");
}

/**
 * Generate analyst consensus conclusion
 */
export function getAnalystConsensusConclusion(
  recMean: number | null | undefined,
  t: TFunc
): string {
  if (recMean == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  const v = recMean;
  if (v <= 1.5) return t("assets.conclusions.analyst.consensus.strongBuy");
  if (v <= 2.5) return t("assets.conclusions.analyst.consensus.buy");
  if (v <= 3.5) return t("assets.conclusions.analyst.consensus.hold");
  if (v <= 4.5) return t("assets.conclusions.analyst.consensus.sell");
  return t("assets.conclusions.analyst.consensus.strongSell");
}

/**
 * Generate implied upside conclusion
 */
export function getImpliedUpsideConclusion(
  impliedUpsidePct: number | null | undefined,
  t: TFunc
): string {
  if (impliedUpsidePct == null) {
    return t("assets.conclusions.common.insufficientData");
  }

  const v = impliedUpsidePct;
  if (v > 30) return t("assets.conclusions.analyst.upside.high");
  if (v > 10) return t("assets.conclusions.analyst.upside.moderate");
  if (v > 0) return t("assets.conclusions.analyst.upside.limited");
  return t("assets.conclusions.analyst.upside.downside");
}
