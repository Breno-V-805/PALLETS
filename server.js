/**
 * PALLETS V3 // Local Runtime Delegator
 * For local terminal execution: "node server.js"
 */
'use strict';

const serverModule = require('./server/server.js');

if (require.main === module) {
  const server = serverModule.createServerInstance();
  const PORT = Number(process.env.PORT) || 3001;
  server.listen(PORT, () => {
    console.log(`[PALLETS V3] Dark Industrial Enterprise Server listening on http://localhost:${PORT}`);
  });
}

module.exports = serverModule;
