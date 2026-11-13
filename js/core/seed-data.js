/**
 * PALLETS V3 // Master FMCG Seed Catalog, Suppliers & Benchmark Sales Logs
 * Contains zero credentials or authentication tokens.
 */
(function (global) {
  'use strict';

  function generateHistoricalDailySales(baseVelocity, weekendBoost = 1.35, noise = 0.15) {
    const data = [];
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const boost = isWeekend ? weekendBoost : 1.0;
      // Deterministic harmonic wave per index + baseVelocity seed
      const deterministicJitter = Math.cos((i + baseVelocity) * 0.7) * 0.04;
      const wave = 1.0 + (Math.sin(i * 0.45) * noise) + deterministicJitter;
      const qty = Math.max(1, Math.round(baseVelocity * boost * wave));
      data.push({
        date: d.toISOString().split('T')[0],
        quantity: qty
      });
    }
    return data;
  }

  const SUPPLIERS_MASTER = [
    {
      id: 'SUP-01',
      name: 'Oatly Indo-Pacific Logistics Pvt Ltd',
      category: 'Dairy & Chilled',
      leadTimeDays: 2,
      reliabilityScore: 99.1,
      defectRate: 0.12,
      onTimeDelivery: 98.4,
      defaultMoq: 500,
      contact: 'logistics@oatly-apac.com'
    },
    {
      id: 'SUP-02',
      name: 'Blue Tokai Roasters Direct',
      category: 'Beverages & Cold Brew',
      leadTimeDays: 3,
      reliabilityScore: 97.8,
      defectRate: 0.28,
      onTimeDelivery: 96.2,
      defaultMoq: 300,
      contact: 'wholesale@bluetokaicoffee.com'
    },
    {
      id: 'SUP-03',
      name: 'Drums Food International (Epigamia)',
      category: 'Dairy & Chilled',
      leadTimeDays: 1,
      reliabilityScore: 98.9,
      defectRate: 0.08,
      onTimeDelivery: 99.1,
      defaultMoq: 200,
      contact: 'supply@epigamia.com'
    },
    {
      id: 'SUP-04',
      name: 'LT Foods Ltd National Supply (Daawat)',
      category: 'Staples & Grains',
      leadTimeDays: 4,
      reliabilityScore: 96.5,
      defectRate: 0.45,
      onTimeDelivery: 94.8,
      defaultMoq: 150,
      contact: 'institutional@ltfoods.com'
    },
    {
      id: 'SUP-05',
      name: 'Hindustan Unilever Ltd (Dove)',
      category: 'Personal Care',
      leadTimeDays: 2,
      reliabilityScore: 99.4,
      defectRate: 0.05,
      onTimeDelivery: 99.0,
      defaultMoq: 100,
      contact: 'modernretail@hul.com'
    },
    {
      id: 'SUP-06',
      name: 'PepsiCo India Holdings (Doritos)',
      category: 'Snacks & Confectionery',
      leadTimeDays: 5,
      reliabilityScore: 95.2,
      defectRate: 0.62,
      onTimeDelivery: 93.5,
      defaultMoq: 500,
      contact: 'fmcg.india@pepsico.com'
    }
  ];

  function createInitialProducts() {
    return [
      {
        sku: 'SKU-9921-OAT',
        name: 'Oatly Barista Oat Milk 1L',
        category: 'Dairy & Chilled',
        brand: 'Oatly',
        hub: 'BLR_NORTH_DC',
        unitPrice: 280,
        costPrice: 195,
        onHand: 142,
        reserved: 40,
        onOrder: 500,
        leadTimeDays: 2,
        safetyStock: 300,
        targetStock: 2000,
        moq: 500,
        dailyDemand: 310,
        supplierId: 'SUP-01',
        supplier: 'Oatly Indo-Pacific Logistics Pvt Ltd',
        salesHistory: generateHistoricalDailySales(310, 1.45, 0.18),
        movements: [
          { id: 'MOV-9921-1', date: 'Today, 08:30 AM', type: 'SALE', qty: -48, ref: 'ORD-98211', user: 'Auto-POS', createdAt: new Date(Date.now() - 3600000).toISOString() },
          { id: 'MOV-9921-2', date: 'Yesterday', type: 'SALE', qty: -290, ref: 'BATCH-882', user: 'Auto-POS', createdAt: new Date(Date.now() - 86400000).toISOString() },
          { id: 'MOV-9921-3', date: '08 Nov 2026', type: 'INBOUND_PO', qty: 1000, ref: 'PO-8812', user: 'Operations Lead', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() }
        ]
      },
      {
        sku: 'SKU-8842-COLD',
        name: 'Blue Tokai Cold Brew Can 250ml',
        category: 'Beverages & Cold Brew',
        brand: 'Blue Tokai',
        hub: 'MUM_BANDRA_HUB',
        unitPrice: 160,
        costPrice: 110,
        onHand: 86,
        reserved: 20,
        onOrder: 0,
        leadTimeDays: 3,
        safetyStock: 250,
        targetStock: 1500,
        moq: 300,
        dailyDemand: 195,
        supplierId: 'SUP-02',
        supplier: 'Blue Tokai Roasters Direct',
        salesHistory: generateHistoricalDailySales(195, 1.5, 0.2),
        movements: [
          { id: 'MOV-8842-1', date: 'Today, 09:12 AM', type: 'SALE', qty: -32, ref: 'ORD-98218', user: 'Auto-POS', createdAt: new Date(Date.now() - 1800000).toISOString() },
          { id: 'MOV-8842-2', date: 'Yesterday', type: 'SALE', qty: -210, ref: 'BATCH-881', user: 'Auto-POS', createdAt: new Date(Date.now() - 90000000).toISOString() }
        ]
      },
      {
        sku: 'SKU-7714-PODS',
        name: 'Ariel Matic 3-in-1 Pods 32x',
        category: 'Home Care',
        brand: 'P&G',
        hub: 'DEL_GURGAON_CORE',
        unitPrice: 850,
        costPrice: 590,
        onHand: 6400,
        reserved: 120,
        onOrder: 0,
        leadTimeDays: 7,
        safetyStock: 350,
        targetStock: 1400,
        moq: 200,
        dailyDemand: 110,
        supplier: 'P&G FMCG Distribution North',
        salesHistory: generateHistoricalDailySales(110, 1.15, 0.1),
        movements: [
          { id: 'MOV-7714-1', date: '07 Nov 2026', type: 'INBOUND_PO', qty: 5000, ref: 'PO-8790', user: 'Supply VP', createdAt: new Date(Date.now() - 4 * 86400000).toISOString() }
        ]
      },
      {
        sku: 'SKU-6631-RICE',
        name: 'Daawat Biryani Basmati 5kg',
        category: 'Staples & Grains',
        brand: 'LT Foods',
        hub: 'HYD_HITEC_STORE',
        unitPrice: 620,
        costPrice: 440,
        onHand: 19,
        reserved: 10,
        onOrder: 0,
        leadTimeDays: 4,
        safetyStock: 200,
        targetStock: 800,
        moq: 150,
        dailyDemand: 85,
        supplierId: 'SUP-04',
        supplier: 'LT Foods Ltd National Supply (Daawat)',
        salesHistory: generateHistoricalDailySales(85, 1.3, 0.12),
        movements: [
          { id: 'MOV-6631-1', date: 'Today, 07:45 AM', type: 'SALE', qty: -12, ref: 'ORD-98202', user: 'Auto-POS', createdAt: new Date(Date.now() - 5400000).toISOString() }
        ]
      },
      {
        sku: 'SKU-5520-YOGU',
        name: 'Epigamia Greek Yogurt 400g',
        category: 'Dairy & Chilled',
        brand: 'Epigamia',
        hub: 'BLR_NORTH_DC',
        unitPrice: 140,
        costPrice: 95,
        onHand: 38,
        reserved: 15,
        onOrder: 0,
        leadTimeDays: 1,
        safetyStock: 180,
        targetStock: 700,
        moq: 200,
        dailyDemand: 140,
        supplierId: 'SUP-03',
        supplier: 'Drums Food International (Epigamia)',
        salesHistory: generateHistoricalDailySales(140, 1.35, 0.14),
        movements: [
          { id: 'MOV-5520-1', date: 'Today, 08:00 AM', type: 'SALE', qty: -22, ref: 'ORD-98207', user: 'Auto-POS', createdAt: new Date(Date.now() - 4800000).toISOString() }
        ]
      },
      {
        sku: 'SKU-4412-CHIP',
        name: 'Doritos Nacho Cheese 150g',
        category: 'Snacks & Confectionery',
        brand: 'PepsiCo',
        hub: 'MUM_BANDRA_HUB',
        unitPrice: 90,
        costPrice: 62,
        onHand: 9200,
        reserved: 200,
        onOrder: 0,
        leadTimeDays: 5,
        safetyStock: 600,
        targetStock: 2500,
        moq: 500,
        dailyDemand: 260,
        supplierId: 'SUP-06',
        supplier: 'PepsiCo India Holdings (Doritos)',
        salesHistory: generateHistoricalDailySales(260, 1.4, 0.15),
        movements: [
          { id: 'MOV-4412-1', date: '05 Nov 2026', type: 'INBOUND_PO', qty: 7000, ref: 'PO-8755', user: 'Supply VP', createdAt: new Date(Date.now() - 6 * 86400000).toISOString() }
        ]
      },
      {
        sku: 'SKU-3389-SALT',
        name: 'Tata Salt Immuno Lite 1kg',
        category: 'Staples & Grains',
        brand: 'Tata Consumer',
        hub: 'DEL_GURGAON_CORE',
        unitPrice: 32,
        costPrice: 22,
        onHand: 4800,
        reserved: 150,
        onOrder: 2000,
        leadTimeDays: 3,
        safetyStock: 1200,
        targetStock: 4500,
        moq: 1000,
        dailyDemand: 420,
        supplier: 'Tata Consumer Products Ltd',
        salesHistory: generateHistoricalDailySales(420, 1.05, 0.08),
        movements: [
          { id: 'MOV-3389-1', date: 'Yesterday', type: 'SALE', qty: -410, ref: 'BATCH-881', user: 'Auto-POS', createdAt: new Date(Date.now() - 88000000).toISOString() }
        ]
      },
      {
        sku: 'SKU-2290-BODY',
        name: 'Dove Deep Moisture 800ml',
        category: 'Personal Care',
        brand: 'Unilever',
        hub: 'DEL_GURGAON_CORE',
        unitPrice: 499,
        costPrice: 340,
        onHand: 14,
        reserved: 8,
        onOrder: 0,
        leadTimeDays: 2,
        safetyStock: 100,
        targetStock: 450,
        moq: 100,
        dailyDemand: 65,
        supplierId: 'SUP-05',
        supplier: 'Hindustan Unilever Ltd (Dove)',
        salesHistory: generateHistoricalDailySales(65, 1.2, 0.1),
        movements: [
          { id: 'MOV-2290-1', date: 'Today, 06:30 AM', type: 'SALE', qty: -9, ref: 'ORD-98199', user: 'Auto-POS', createdAt: new Date(Date.now() - 7200000).toISOString() }
        ]
      },
      {
        sku: 'SKU-1108-CHIL',
        name: 'Sichuan Chilli Crisp Oil 210g',
        category: 'Condiments & Sauces',
        brand: 'Artisanal Pantry',
        hub: 'BLR_NORTH_DC',
        unitPrice: 390,
        costPrice: 260,
        onHand: 1850,
        reserved: 25,
        onOrder: 0,
        leadTimeDays: 14,
        safetyStock: 80,
        targetStock: 300,
        moq: 200,
        dailyDemand: 18,
        supplier: 'Artisanal Pantry Imports',
        salesHistory: generateHistoricalDailySales(18, 1.15, 0.1),
        movements: [
          { id: 'MOV-1108-1', date: '01 Nov 2026', type: 'INBOUND_PO', qty: 1500, ref: 'PO-8692', user: 'Operations Lead', createdAt: new Date(Date.now() - 10 * 86400000).toISOString() }
        ]
      },
      {
        sku: 'SKU-7750-ATTA',
        name: 'Aashirvaad Select Sharbati 10kg',
        category: 'Staples & Grains',
        brand: 'ITC',
        hub: 'MUM_BANDRA_HUB',
        unitPrice: 580,
        costPrice: 410,
        onHand: 2200,
        reserved: 180,
        onOrder: 1500,
        leadTimeDays: 3,
        safetyStock: 800,
        targetStock: 2600,
        moq: 500,
        dailyDemand: 380,
        supplier: 'ITC Limited Foods Division',
        salesHistory: generateHistoricalDailySales(380, 1.1, 0.09),
        movements: [
          { id: 'MOV-7750-1', date: 'Yesterday', type: 'SALE', qty: -375, ref: 'BATCH-881', user: 'Auto-POS', createdAt: new Date(Date.now() - 92000000).toISOString() }
        ]
      },
      {
        sku: 'SKU-9021-ENERGY',
        name: 'Red Bull Energy 250ml 4-Pack',
        category: 'Beverages & Cold Brew',
        brand: 'Red Bull',
        hub: 'DEL_GURGAON_CORE',
        unitPrice: 450,
        costPrice: 315,
        onHand: 24,
        reserved: 12,
        onOrder: 0,
        leadTimeDays: 2,
        safetyStock: 150,
        targetStock: 600,
        moq: 100,
        dailyDemand: 110,
        supplier: 'Red Bull Direct DC',
        salesHistory: generateHistoricalDailySales(110, 1.6, 0.22),
        movements: [
          { id: 'MOV-9021-1', date: 'Today, 08:50 AM', type: 'SALE', qty: -18, ref: 'ORD-98215', user: 'Auto-POS', createdAt: new Date(Date.now() - 2400000).toISOString() }
        ]
      },
      {
        sku: 'SKU-8819-CHOCO',
        name: 'Ferrero Rocher T16 200g',
        category: 'Snacks & Confectionery',
        brand: 'Ferrero',
        hub: 'HYD_HITEC_STORE',
        unitPrice: 595,
        costPrice: 410,
        onHand: 3400,
        reserved: 80,
        onOrder: 0,
        leadTimeDays: 4,
        safetyStock: 250,
        targetStock: 900,
        moq: 200,
        dailyDemand: 72,
        supplier: 'Ferrero India Pvt Ltd',
        salesHistory: generateHistoricalDailySales(72, 1.25, 0.15),
        movements: [
          { id: 'MOV-8819-1', date: '04 Nov 2026', type: 'INBOUND_PO', qty: 2500, ref: 'PO-8720', user: 'Supply VP', createdAt: new Date(Date.now() - 7 * 86400000).toISOString() }
        ]
      }
    ];
  }

  function createInitialIngestionLogs() {
    return [
      {
        batchId: 'BATCH-ING-9842',
        fileName: 'fmcg_pos_transactions_today.csv',
        totalRecords: 1420,
        imported: 1412,
        duplicates: 8,
        invalidRows: 0,
        status: 'COMPLETED',
        sourceType: 'SEED_BENCHMARK',
        timestamp: 'Today, 09:30 AM',
        ingestedAt: new Date(Date.now() - 7200000).toISOString()
      },
      {
        batchId: 'BATCH-ING-9841',
        fileName: 'mumbai_bandra_hub_pos.csv',
        totalRecords: 2890,
        imported: 2884,
        duplicates: 6,
        invalidRows: 0,
        status: 'COMPLETED',
        sourceType: 'SEED_BENCHMARK',
        timestamp: 'Yesterday, 11:45 PM',
        ingestedAt: new Date(Date.now() - 36000000).toISOString()
      },
      {
        batchId: 'BATCH-ING-9840',
        fileName: 'bangalore_north_restock.json',
        totalRecords: 950,
        imported: 950,
        duplicates: 0,
        invalidRows: 0,
        status: 'COMPLETED',
        sourceType: 'SEED_BENCHMARK',
        timestamp: '08 Nov 2026',
        ingestedAt: new Date(Date.now() - 3 * 86400000).toISOString()
      }
    ];
  }

  function buildSampleBasketsForApriori() {
    const sampleBaskets = [];
    const combos = [
      ['SKU-9921-OAT', 'SKU-8842-COLD', 'SKU-5520-YOGU'],
      ['SKU-4412-CHIP', 'SKU-9021-ENERGY'],
      ['SKU-6631-RICE', 'SKU-1108-CHIL', 'SKU-3389-SALT'],
      ['SKU-7750-ATTA', 'SKU-3389-SALT'],
      ['SKU-5520-YOGU', 'SKU-8819-CHOCO', 'SKU-2290-BODY']
    ];
    for (let i = 0; i < 600; i++) {
      const slot = i % 25;
      if (slot < 7) sampleBaskets.push(combos[0]);
      else if (slot < 13) sampleBaskets.push(combos[1]);
      else if (slot < 18) sampleBaskets.push(combos[2]);
      else if (slot < 22) sampleBaskets.push(combos[3]);
      else sampleBaskets.push(combos[4]);
    }
    return sampleBaskets;
  }

  const api = {
    generateHistoricalDailySales,
    SUPPLIERS_MASTER,
    createInitialProducts,
    createInitialIngestionLogs,
    buildSampleBasketsForApriori
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.PalletsSeedData = api;
})(typeof window !== 'undefined' ? window : globalThis);

