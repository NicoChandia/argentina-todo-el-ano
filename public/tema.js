// Modo claro / oscuro. Por defecto sigue al sistema; si la persona elige uno con el botón,
// se recuerda en este navegador. Se carga en el <head> para que la página no "parpadee".
(function () {
  var raiz = document.documentElement;
  var oscuroSistema = window.matchMedia('(prefers-color-scheme: dark)');
  var guardado = null;
  try { guardado = localStorage.getItem('tema'); } catch (e) {}
  if (guardado === 'claro') raiz.setAttribute('data-theme', 'light');
  if (guardado === 'oscuro') raiz.setAttribute('data-theme', 'dark');

  function esOscuro() {
    var t = raiz.getAttribute('data-theme');
    return t ? t === 'dark' : oscuroSistema.matches;
  }
  function pintar() {
    var oscuro = esOscuro();
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.setAttribute('content', oscuro ? '#0d161c' : '#f4f6f5');
      m.removeAttribute('media');
    });
    document.querySelectorAll('[data-tema]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(oscuro));
      b.setAttribute('aria-label', oscuro ? b.dataset.aClaro : b.dataset.aOscuro);
      b.setAttribute('title', oscuro ? b.dataset.aClaro : b.dataset.aOscuro);
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    pintar();
    document.querySelectorAll('[data-tema]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pasarAOscuro = !esOscuro();
        raiz.setAttribute('data-theme', pasarAOscuro ? 'dark' : 'light');
        try { localStorage.setItem('tema', pasarAOscuro ? 'oscuro' : 'claro'); } catch (e) {}
        pintar();
        window.dispatchEvent(new CustomEvent('tema:cambio'));
      });
    });
  });
  oscuroSistema.addEventListener('change', pintar);
})();
