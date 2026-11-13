/**
 * PALLETS V3 // Vercel Catch-All Serverless Route
 * Routes all subpath API calls (/api/auth/*, /api/ops/*, etc.) to handleApiRequest.
 */
'use strict';

const handler = require('./index.js');

module.exports = handler;

