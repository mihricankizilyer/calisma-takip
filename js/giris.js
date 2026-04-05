(function () {
  "use strict";

  function q(id) {
    return document.getElementById(id);
  }

  function safeReturnUrl() {
    try {
      var p = new URLSearchParams(window.location.search).get("return");
      if (!p) return "index.html";
      var d = decodeURIComponent(p);
      if (d.indexOf("://") >= 0 || d.indexOf("..") >= 0) return "index.html";
      if (d.charAt(0) === "/") return d.slice(1) || "index.html";
      return d;
    } catch (e) {
      return "index.html";
    }
  }

  function credMode() {
    return typeof getCalismaApiBase === "function" && getCalismaApiBase() ? "omit" : "include";
  }

  function apiPost(path, body) {
    var url = typeof getCalismaApiUrl === "function" ? getCalismaApiUrl(path) : path;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: credMode(),
    });
  }

  function showMsg(el, text) {
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.style.display = "";
    } else {
      el.textContent = "";
      el.style.display = "none";
    }
  }

  function init() {
    var userEl = q("giris-user");
    var passEl = q("giris-pass");
    var msgEl = q("giris-msg");
    var btnLogin = q("btn-giris-login");
    var btnReg = q("btn-giris-register");

    var bannerEl = q("giris-banner");
    var statusUrl = typeof getCalismaApiUrl === "function" ? getCalismaApiUrl("/api/auth/status") : "/api/auth/status";
    fetch(statusUrl, { credentials: credMode() })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!bannerEl) return;
        if (data && data.usersCount === 0) {
          bannerEl.textContent =
            "Bu sunucuda henüz hesap yok. Önce Kayıt ol ile hesap oluşturun. " +
            "Ücretsiz Render’da sunucu uyku/ yeniden başlatma sonrası veritabanı sıfırlanabilir; o zaman aynı adreste tekrar Kayıt gerekir.";
          bannerEl.style.display = "block";
        } else if (data && data.usersCount > 0) {
          bannerEl.textContent = "Hesabınız varsa kullanıcı adı ve şifreyle Giriş yapın.";
          bannerEl.style.display = "block";
        }
      })
      .catch(function () {});

    if (typeof getCalismaSessionToken === "function" && getCalismaSessionToken()) {
      var path = typeof getCalismaApiUrl === "function" ? getCalismaApiUrl("/api/state") : "/api/state";
      var headers = { "X-Calisma-Session": getCalismaSessionToken() };
      fetch(path, { method: "GET", headers: headers, credentials: credMode() })
        .then(function (r) {
          if (r.ok) window.location.href = safeReturnUrl();
        })
        .catch(function () {});
    }

    function doLogin() {
      var u = userEl ? userEl.value.trim() : "";
      var p = passEl ? String(passEl.value).trim() : "";
      showMsg(msgEl, "");
      btnLogin.disabled = true;
      btnReg.disabled = true;
      apiPost("/api/auth/login", { username: u, password: p })
        .then(function (r) {
          return r.text().then(function (t) {
            var j = null;
            try {
              j = t ? JSON.parse(t) : null;
            } catch (e) {}
            if (!r.ok) {
              var err = new Error((j && j.error) || "Sunucu yanıtı okunamadı (" + r.status + ").");
              err._code = j && j.code;
              throw err;
            }
            return j;
          });
        })
        .then(function (j) {
          if (j && j.token && typeof setCalismaSessionToken === "function") {
            setCalismaSessionToken(j.token);
            window.location.href = safeReturnUrl();
          } else throw new Error("Yanıt geçersiz");
        })
        .catch(function (e) {
          var msg = e && e.message ? e.message : "Giriş başarısız.";
          if (e && e._code === "no_user") {
            msg += " Önce bu adreste Kayıt ol veya Ayarlar’daki sunucu adresinin doğru olduğundan emin olun.";
          }
          showMsg(msgEl, msg);
        })
        .finally(function () {
          btnLogin.disabled = false;
          btnReg.disabled = false;
        });
    }

    function doRegister() {
      var u = userEl ? userEl.value.trim() : "";
      var p = passEl ? String(passEl.value).trim() : "";
      showMsg(msgEl, "");
      btnLogin.disabled = true;
      btnReg.disabled = true;
      apiPost("/api/auth/register", { username: u, password: p })
        .then(function (r) {
          return r.text().then(function (t) {
            var j = null;
            try {
              j = t ? JSON.parse(t) : null;
            } catch (e) {}
            if (!r.ok) throw new Error((j && j.error) || "Sunucu yanıtı okunamadı (" + r.status + ").");
            return j;
          });
        })
        .then(function (j) {
          if (j && j.token && typeof setCalismaSessionToken === "function") {
            setCalismaSessionToken(j.token);
            window.location.href = safeReturnUrl();
          } else throw new Error("Yanıt geçersiz");
        })
        .catch(function (e) {
          showMsg(msgEl, e && e.message ? e.message : "Kayıt başarısız.");
        })
        .finally(function () {
          btnLogin.disabled = false;
          btnReg.disabled = false;
        });
    }

    if (btnLogin) btnLogin.addEventListener("click", doLogin);
    if (btnReg) btnReg.addEventListener("click", doRegister);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
