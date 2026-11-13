/**
 * PALLETS Root // Vercel API Forwarder
 * Delegates all /api calls directly to PALLETS-V3 serverless handler.
 */
'use strict';

const handler = require('../PALLETS-V3/api/index.js');

module.exports = handler;

