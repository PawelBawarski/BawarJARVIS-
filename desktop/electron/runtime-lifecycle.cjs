'use strict';

// Coordinates owned services. In particular, Java must exit before its DB stops.
function createRuntimeLifecycle({ startDatabase, startQwen, startBackend,
  stopBackend, stopQwen, stopDatabase }) {
  let stopping = false;
  let starting = null;
  let shutdown = null;
  function checkOpen() {
    if (stopping) throw new Error('Anulowano uruchamianie aplikacji.');
  }
  function start(options) {
    if (stopping) return Promise.reject(new Error('Trwa zamykanie aplikacji.'));
    if (!starting) starting = (async () => {
      for (const service of [startDatabase, startQwen, startBackend]) {
        checkOpen();
        await service(options);
        checkOpen();
      }
    })();
    return starting;
  }
  function stop() {
    stopping = true;
    if (!shutdown) shutdown = (async () => {
      await stopBackend();
      await stopQwen();
      await stopDatabase();
      // A native model chooser can remain pending. Service lifecycles forbid
      // late spawns; waiting for that dialog here would prevent app.quit().
    })().catch((error) => { shutdown = null; throw error; });
    return shutdown;
  }
  return { start, stop, isStopping: () => stopping };
}

module.exports = { createRuntimeLifecycle };
