/**
 * PALLETS V3 // Vercel Serverless Function Handler
 * Routes all /api requests to server.js handleApiRequest.
 */
'use strict';

const { handleApiRequest } = require('../server/server.js');

module.exports = async (req, res) => {
  try {
    return await handleApiRequest(req, res);
  } catch (err) {
    console.error('[PALLETS V3 API UNCAUGHT]', err);
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify({ error: err.message || 'Internal server error.' }));
    }
  }
};
