const SCORE_LABELS = Object.freeze({
  5: "Exceptional",
  4: "Excellent",
  3: "Good",
  2: "Fair",
  1: "Wait",
  0: "Avoid",
});

function baseScore(economyFee) {
  if (economyFee <= 1) return 5;
  if (economyFee <= 2) return 4;
  if (economyFee <= 3) return 3;
  if (economyFee <= 5) return 2;
  if (economyFee <= 10) return 1;
  return 0;
}

function formatFee(value) {
  return Number(value.toFixed(3)).toString();
}

/**
 * A deliberately simple storage-transfer timing heuristic. When the economy
 * estimate looks cheap but projected block 2 remains above 5 sat/vB, the
 * recommendation is capped at "Wait" so a short congestion spike is not
 * presented as a favorable transfer window.
 */
export function calculateStorageOpportunity(economyFee, projectedBlock2Median) {
  if (!Number.isFinite(economyFee) || economyFee < 0) {
    throw new TypeError("economyFee must be a non-negative finite number");
  }

  let score = baseScore(economyFee);
  const congestionAdjusted =
    economyFee <= 3 &&
    Number.isFinite(projectedBlock2Median) &&
    projectedBlock2Median > 5;
  if (congestionAdjusted) {
    score = Math.min(score, 1);
  }

  const label = SCORE_LABELS[score];
  return {
    score,
    label,
    congestionAdjusted,
    text: `${label} — economy fee ${formatFee(economyFee)} sat/vB${
      congestionAdjusted ? " — projected congestion detected" : ""
    }`,
  };
}
