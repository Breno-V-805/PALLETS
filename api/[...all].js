/**
 * PALLETS Root // Vercel Catch-All API Forwarder
 * Delegates all /api/* subpath calls directly to PALLETS-V3 serverless handler.
 */
'use strict';

const handler = require('./index.js');

module.exports = handler;

