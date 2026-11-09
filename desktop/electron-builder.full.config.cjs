'use strict';
/** FE11.5: retain ALL previous builder settings; additionally bundle Spring Boot. */
const base = require('./electron-builder.config.cjs');
module.exports = {
  ...base,
  extraResources: [
    ...(base.extraResources || []),
    {
      from: '.jarvis-build/backend/jarvis-backend.jar',
      to: 'backend/jarvis-backend.jar',
    },
  ],
};
