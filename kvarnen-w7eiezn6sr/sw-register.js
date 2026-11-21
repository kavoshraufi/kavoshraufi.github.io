/* Registrerar testappens service worker och tar in nya versioner. */
(function () {
  if (!('serviceWorker' in navigator)) return;

  var script = document.currentScript;
  var swUrl = (script && script.getAttribute('data-sw')) || './sw.js';
  var scope = (script && script.getAttribute('data-scope')) || './';

  function paHyllan() {
    return location.pathname.indexOf('/titlar/') === -1;
  }

  function visaRuta() {
    var ruta = document.getElementById('ny-version');
    if (!ruta) return;
    ruta.hidden = false;
    ruta.classList.add('synlig');
    var knapp = document.getElementById('ny-version-knapp');
    if (knapp) {
      knapp.onclick = function () {
        window.location.reload();
      };
    }
  }

  function aktivera(worker) {
    if (!worker) return;
    if (paHyllan()) {
      worker.postMessage({ typ: 'SKIP_WAITING' });
      return;
    }
    visaRuta();
    var knapp = document.getElementById('ny-version-knapp');
    if (knapp) {
      knapp.onclick = function () {
        worker.postMessage({ typ: 'SKIP_WAITING' });
        window.location.reload();
      };
    }
  }

  var hadeController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.register(swUrl, {
    scope: scope,
    updateViaCache: 'none'
  }).then(function (reg) {
    if (reg.waiting) aktivera(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', function () {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          aktivera(w);
        }
      });
    });
    reg.update();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') reg.update();
    });
  }).catch(function () {});

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadeController) return;
    if (paHyllan()) {
      window.location.reload();
    } else {
      visaRuta();
    }
  });
})();
