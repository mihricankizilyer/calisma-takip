(function () {
  "use strict";

  function q(id) {
    return document.getElementById(id);
  }

  function init() {
    var baseEl = q("sync-api-base");
    var keyEl = q("sync-api-key");
    if (baseEl && typeof getCalismaApiBase === "function") {
      baseEl.value = getCalismaApiBase() || "";
    }

    var btnSave = q("btn-sync-save");
    if (btnSave) {
      btnSave.addEventListener("click", function () {
        var base = baseEl ? baseEl.value.trim() : "";
        var nk = keyEl ? keyEl.value.trim() : "";
        if (typeof setCalismaApiBase === "function") setCalismaApiBase(base);
        if (typeof setCalismaApiKey === "function") {
          if (nk) setCalismaApiKey(nk);
        }
        alert("Kaydedildi. Diğer sayfaları yenileyin.");
        if (keyEl) keyEl.value = "";
      });
    }

    var btnClear = q("btn-sync-clear");
    if (btnClear) {
      btnClear.addEventListener("click", function () {
        if (typeof setCalismaApiBase === "function") setCalismaApiBase("");
        if (typeof setCalismaApiKey === "function") setCalismaApiKey("");
        if (baseEl) baseEl.value = "";
        if (keyEl) keyEl.value = "";
        alert("Uzak adres ve anahtar silindi.");
      });
    }

    var btnRmKey = q("btn-sync-remove-key");
    if (btnRmKey) {
      btnRmKey.addEventListener("click", function () {
        if (typeof setCalismaApiKey === "function") setCalismaApiKey("");
        if (keyEl) keyEl.value = "";
        alert("API anahtarı kaldırıldı.");
      });
    }

    var btnLogout = q("btn-account-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", function () {
        var path = typeof getCalismaApiUrl === "function" ? getCalismaApiUrl("/api/auth/logout") : "/api/auth/logout";
        var headers = {};
        if (typeof getCalismaSessionToken === "function" && getCalismaSessionToken()) {
          headers["X-Calisma-Session"] = getCalismaSessionToken();
        }
        btnLogout.disabled = true;
        fetch(path, {
          method: "POST",
          headers: headers,
          credentials: typeof getCalismaApiBase === "function" && getCalismaApiBase() ? "omit" : "include",
        })
          .finally(function () {
            if (typeof setCalismaSessionToken === "function") setCalismaSessionToken("");
            btnLogout.disabled = false;
            alert("Oturum kapatıldı. Sayfayı yenileyin.");
          });
      });
    }

    var btnTest = q("btn-sync-test");
    if (btnTest) {
      btnTest.addEventListener("click", function () {
        var base = baseEl ? baseEl.value.trim() : "";
        var nk = keyEl ? keyEl.value.trim() : "";
        if (typeof setCalismaApiBase === "function") setCalismaApiBase(base);
        if (nk && typeof setCalismaApiKey === "function") setCalismaApiKey(nk);

        var path = typeof getCalismaApiUrl === "function" ? getCalismaApiUrl("/api/state") : "/api/state";
        var headers = {};
        if (typeof getCalismaApiKey === "function" && getCalismaApiKey()) {
          headers["X-API-Key"] = getCalismaApiKey();
        }
        if (typeof getCalismaSessionToken === "function" && getCalismaSessionToken()) {
          headers["X-Calisma-Session"] = getCalismaSessionToken();
        }
        btnTest.disabled = true;
        fetch(path, {
          method: "GET",
          headers: headers,
          credentials: typeof getCalismaApiBase === "function" && getCalismaApiBase() ? "omit" : "include",
        })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then(function () {
            alert("Sunucu yanıt verdi; bağlantı tamam.");
          })
          .catch(function (e) {
            alert("Hata: " + (e && e.message ? e.message : String(e)));
          })
          .finally(function () {
            btnTest.disabled = false;
          });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
