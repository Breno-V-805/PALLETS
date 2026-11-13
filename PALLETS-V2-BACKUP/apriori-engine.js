/**
 * Pallets // Apriori Association Rule Mining Engine
 * Performs Market Basket Analysis on customer transactions.
 * Calculates Support, Confidence, and Lift.
 */
class PalletsAprioriEngine {
  /**
   * Run Apriori on an array of transaction baskets
   * @param {Array<Array<string>>} baskets - e.g. [['SKU1', 'SKU2'], ['SKU2', 'SKU3']]
   * @param {Object} options - { minSupport, minConfidence, productMap }
   */
  static runApriori(baskets, options = {}) {
    const { minSupport = 0.02, minConfidence = 0.25, productMap = {} } = options;
    const totalTransactions = baskets.length;

    if (totalTransactions === 0) return { totalTransactions: 0, rules: [] };

    // 1. Calculate 1-Itemset Support
    const itemFreq = new Map();
    for (const basket of baskets) {
      const uniqueItems = new Set(basket);
      for (const item of uniqueItems) {
        itemFreq.set(item, (itemFreq.get(item) || 0) + 1);
      }
    }

    const frequentItems = new Set();
    const itemSupport = new Map();
    for (const [item, count] of itemFreq.entries()) {
      const support = count / totalTransactions;
      if (support >= minSupport) {
        frequentItems.add(item);
        itemSupport.set(item, support);
      }
    }

    // 2. Calculate 2-Itemset Pair Support
    const pairFreq = new Map();
    for (const basket of baskets) {
      const filtered = basket.filter(item => frequentItems.has(item));
      for (let i = 0; i < filtered.length; i++) {
        for (let j = i + 1; j < filtered.length; j++) {
          const a = filtered[i] < filtered[j] ? filtered[i] : filtered[j];
          const b = filtered[i] < filtered[j] ? filtered[j] : filtered[i];
          const key = `${a}:::${b}`;
          pairFreq.set(key, (pairFreq.get(key) || 0) + 1);
        }
      }
    }

    // 3. Generate Association Rules
    const rules = [];

    for (const [pairKey, count] of pairFreq.entries()) {
      const [itemA, itemB] = pairKey.split(':::');
      const pairSupport = count / totalTransactions;

      if (pairSupport < minSupport) continue;

      const suppA = itemSupport.get(itemA) || 0;
      const suppB = itemSupport.get(itemB) || 0;

      // Rule A -> B
      const confAtoB = suppA > 0 ? (pairSupport / suppA) : 0;
      const liftAtoB = (suppA * suppB > 0) ? (pairSupport / (suppA * suppB)) : 1.0;

      if (confAtoB >= minConfidence) {
        rules.push({
          antecedent: itemA,
          antecedentName: productMap[itemA]?.name || itemA,
          consequent: itemB,
          consequentName: productMap[itemB]?.name || itemB,
          support: Math.round(pairSupport * 1000) / 10,
          confidence: Math.round(confAtoB * 1000) / 10,
          lift: Math.round(liftAtoB * 100) / 100,
          coPurchases: count,
          strength: liftAtoB >= 2.0 ? 'VERY_STRONG' : (liftAtoB >= 1.2 ? 'STRONG' : 'MODERATE')
        });
      }

      // Rule B -> A
      const confBtoA = suppB > 0 ? (pairSupport / suppB) : 0;
      if (confBtoA >= minConfidence) {
        rules.push({
          antecedent: itemB,
          antecedentName: productMap[itemB]?.name || itemB,
          consequent: itemA,
          consequentName: productMap[itemA]?.name || itemA,
          support: Math.round(pairSupport * 1000) / 10,
          confidence: Math.round(confBtoA * 1000) / 10,
          lift: Math.round(liftAtoB * 100) / 100,
          coPurchases: count,
          strength: liftAtoB >= 2.0 ? 'VERY_STRONG' : (liftAtoB >= 1.2 ? 'STRONG' : 'MODERATE')
        });
      }
    }

    // Sort by highest Lift, then highest Confidence
    rules.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence);

    return {
      totalTransactions,
      frequentRulesCount: rules.length,
      rules
    };
  }

  /**
   * Get bundle recommendations for a specific SKU
   */
  static getCrossSellRecommendations(targetSku, allRules) {
    return allRules.filter(r => r.antecedent === targetSku).slice(0, 5);
  }
}

if (typeof window !== 'undefined') {
  window.PalletsAprioriEngine = PalletsAprioriEngine;
} else if (typeof globalThis !== 'undefined') {
  globalThis.PalletsAprioriEngine = PalletsAprioriEngine;
}
