'use strict';
/*
 * Preboot guard for the Ofertare app.
 * It gives docs/js/fixes.js one macrotask to patch Sync before app.js continues
 * from the initial Supabase getSession() call.
 */
(function(){
  if(window.__OFERTARE_PREBOOT__) return;
  window.__OFERTARE_PREBOOT__ = true;
  if(!window.supabase || typeof window.supabase.createClient !== 'function') return;

  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  window.supabase.createClient = function(...args){
    const client = originalCreateClient(...args);
    if(client && client.auth && typeof client.auth.getSession === 'function' && !client.auth.__ofertareDelayedSession){
      const originalGetSession = client.auth.getSession.bind(client.auth);
      client.auth.getSession = (...getArgs) => new Promise((resolve, reject) => {
        setTimeout(() => {
          try { Promise.resolve(originalGetSession(...getArgs)).then(resolve, reject); }
          catch(err){ reject(err); }
        }, 0);
      });
      client.auth.__ofertareDelayedSession = true;
    }
    return client;
  };
})();
