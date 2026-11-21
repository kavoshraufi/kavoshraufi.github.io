/* Registrerar testappens service worker och tar in nya versioner. */
(function () {
  var script = document.currentScript;
  var swUrl = (script && script.getAttribute('data-sw')) || './sw.js';
  var scope = (script && script.getAttribute('data-scope')) || './';
  var kandNyVersion = null;

  function paHyllan() {
    return location.pathname.indexOf('/titlar/') === -1;
  }

  function nyVersionText(nummer) {
    return nummer ? ('Ny version ' + nummer + ' finns.') : 'Ny version finns.';
  }

  function visaNuvarande(nummer) {
    var el = document.getElementById('app-version');
    if (!el || !nummer) return;
    el.textContent = 'Version ' + nummer;
  }

  if (typeof KVARNEN_APP_VERSION === 'string') {
    visaNuvarande(KVARNEN_APP_VERSION);
  }

  function uppdateraRutaText() {
    var ruta = document.getElementById('ny-version');
    var p = ruta && ruta.querySelector('p');
    if (p) p.textContent = nyVersionText(kandNyVersion);
  }

  function taEmotNyVersion(nummer) {
    if (!nummer) return;
    if (typeof KVARNEN_APP_VERSION === 'string' && nummer === KVARNEN_APP_VERSION) return;
    kandNyVersion = nummer;
    uppdateraRutaText();
  }

  function fragaVersion(worker, hantera) {
    if (!worker || !hantera) return;
    try {
      var kanal = new MessageChannel();
      kanal.port1.onmessage = function (event) {
        if (event.data && event.data.nummer) hantera(event.data.nummer);
      };
      worker.postMessage({ typ: 'VERSION?' }, [kanal.port2]);
    } catch (err) {
      try { worker.postMessage({ typ: 'VERSION?' }); } catch (e) {}
    }
  }

  function visaRuta() {
    var ruta = document.getElementById('ny-version');
    if (!ruta) return;
    uppdateraRutaText();
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
    fragaVersion(worker, taEmotNyVersion);
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

  if (!('serviceWorker' in navigator)) return;

  var hadeController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('message', function (event) {
    if (!event.data || !event.data.nummer) return;
    if (event.data.typ === 'NY_VERSION') taEmotNyVersion(event.data.nummer);
    if (event.data.typ === 'VERSION') visaNuvarande(event.data.nummer);
  });

  if (navigator.serviceWorker.controller) {
    fragaVersion(navigator.serviceWorker.controller, visaNuvarande);
  }

  navigator.serviceWorker.register(swUrl, {
    scope: scope,
    updateViaCache: 'none'
  }).then(function (reg) {
    if (reg.active) fragaVersion(reg.active, visaNuvarande);
    if (reg.waiting) aktivera(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (!w) return;
      fragaVersion(w, taEmotNyVersion);
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
