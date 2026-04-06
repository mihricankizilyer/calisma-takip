/**
 * Uzak API kök adresi (ör. Render, Cloudflare Tunnel).
 * Boşsa istekler bu sayfanın adresine gider — telefon + PC’de aynı veriyi görmek için
 * her iki cihazda da uygulamayı aynı siteden açın (ör. hep https://…onrender.com)
 * veya buraya o sitenin kök adresini yazın. Wi‑Fi’nin adı önemli değildir.
 */
(function () {
  "use strict";

  var KEY_BASE = "calisma_sync_api_base";
  var KEY_SECRET = "calisma_sync_api_key";
  var KEY_SESSION = "calisma_sync_session";
  var KEY_USERNAME = "calisma_sync_username";

  function trimUrl(u) {
    if (u == null) return "";
    u = String(u).trim();
    if (!u) return "";
    u = u.replace(/\/+$/, "");
    return u;
  }

  window.getCalismaApiBase = function () {
    try {
      return trimUrl(localStorage.getItem(KEY_BASE));
    } catch (e) {
      return "";
    }
  };

  window.setCalismaApiBase = function (url) {
    try {
      var u = trimUrl(url);
      if (!u) localStorage.removeItem(KEY_BASE);
      else localStorage.setItem(KEY_BASE, u);
    } catch (e) {}
  };

  window.getCalismaApiKey = function () {
    try {
      var k = localStorage.getItem(KEY_SECRET);
      return k != null ? String(k).trim() : "";
    } catch (e) {
      return "";
    }
  };

  window.setCalismaApiKey = function (key) {
    try {
      var k = key != null ? String(key).trim() : "";
      if (!k) localStorage.removeItem(KEY_SECRET);
      else localStorage.setItem(KEY_SECRET, k);
    } catch (e) {}
  };

  window.getCalismaSessionToken = function () {
    try {
      var t = localStorage.getItem(KEY_SESSION);
      return t != null ? String(t).trim() : "";
    } catch (e) {
      return "";
    }
  };

  window.setCalismaSessionToken = function (token) {
    try {
      var t = token != null ? String(token).trim() : "";
      if (!t) {
        localStorage.removeItem(KEY_SESSION);
        localStorage.removeItem(KEY_USERNAME);
      } else localStorage.setItem(KEY_SESSION, t);
    } catch (e) {}
  };

  window.getCalismaUsername = function () {
    try {
      var u = localStorage.getItem(KEY_USERNAME);
      return u != null ? String(u).trim() : "";
    } catch (e) {
      return "";
    }
  };

  window.setCalismaUsername = function (name) {
    try {
      var n = name != null ? String(name).trim() : "";
      if (!n) localStorage.removeItem(KEY_USERNAME);
      else localStorage.setItem(KEY_USERNAME, n);
    } catch (e) {}
  };

  window.getCalismaApiUrl = function (path) {
    var p = path.indexOf("/") === 0 ? path : "/" + path;
    var base = window.getCalismaApiBase();
    if (!base) return p;
    return base + p;
  };
})();
