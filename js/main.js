/* =====================================================================
   QUICKMARK — main.js
   Vanilla JS, no dependencies besides the vendored qrcode.lib.js
   ===================================================================== */
(function () {
  "use strict";

  /* -------------------------------------------------------------
     Theme (light / dark)
  ------------------------------------------------------------- */
  function initTheme() {
    var root = document.documentElement;
    var stored = null;
    try { stored = localStorage.getItem("quickmark-theme"); } catch (e) {}
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored || (prefersDark ? "dark" : "light");
    root.setAttribute("data-theme", theme);

    var toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-pressed", theme === "dark");
      toggle.addEventListener("click", function () {
        var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        toggle.setAttribute("aria-pressed", next === "dark");
        try { localStorage.setItem("quickmark-theme", next); } catch (e) {}
      });
    }
  }

  /* -------------------------------------------------------------
     Mobile nav
  ------------------------------------------------------------- */
  function initNav() {
    var burger = document.querySelector("[data-nav-burger]");
    var links = document.querySelector("[data-nav-links]");
    if (!burger || !links) return;
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      burger.setAttribute("aria-expanded", open);
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* -------------------------------------------------------------
     Toasts
  ------------------------------------------------------------- */
  var toastStack;
  function ensureToastStack() {
    if (toastStack) return toastStack;
    toastStack = document.createElement("div");
    toastStack.className = "toast-stack";
    toastStack.setAttribute("aria-live", "polite");
    document.body.appendChild(toastStack);
    return toastStack;
  }
  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
  };
  function toast(message, type) {
    type = type || "info";
    var stack = ensureToastStack();
    var el = document.createElement("div");
    el.className = "toast " + type;
    el.innerHTML = (ICONS[type] || ICONS.info) + "<span>" + message + "</span>";
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); }, 260);
    }, 3200);
  }
  window.qmToast = toast;

  /* -------------------------------------------------------------
     FAQ accordion
  ------------------------------------------------------------- */
  function initFaq() {
    document.querySelectorAll(".faq-item").forEach(function (item) {
      var btn = item.querySelector(".faq-q");
      var panel = item.querySelector(".faq-a");
      if (!btn || !panel) return;
      btn.addEventListener("click", function () {
        var isOpen = item.getAttribute("data-open") === "true";
        document.querySelectorAll(".faq-item").forEach(function (other) {
          other.setAttribute("data-open", "false");
          other.querySelector(".faq-a").style.maxHeight = null;
          other.querySelector(".faq-q").setAttribute("aria-expanded", "false");
        });
        if (!isOpen) {
          item.setAttribute("data-open", "true");
          panel.style.maxHeight = panel.scrollHeight + 24 + "px";
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  /* -------------------------------------------------------------
     QR engine — shared helpers built on the vendored qrcode lib
  ------------------------------------------------------------- */
  function buildQrModel(text, ecLevel) {
    if (!text) return null;
    var qr = qrcode(0, ecLevel || "M");
    qr.addData(text, "Byte");
    qr.make();
    return qr;
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function renderToCanvas(canvas, qr, opts) {
    var size = opts.size || 260;
    var margin = opts.margin != null ? opts.margin : 4;
    var fg = opts.fg || "#101114";
    var bg = opts.bg || "#ffffff";
    var count = qr.getModuleCount();
    var moduleSize = size / (count + margin * 2);
    var dpr = window.devicePixelRatio || 1;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";

    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = fg;

    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          var x = (c + margin) * moduleSize;
          var y = (r + margin) * moduleSize;
          ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(moduleSize) + 0.5, Math.ceil(moduleSize) + 0.5);
        }
      }
    }

    if (opts.logo) {
      var frac = opts.logoSize || 0.2;
      var logoBox = size * frac;
      var pad = logoBox * 0.16;
      var bx = (size - logoBox) / 2 - pad;
      var by = (size - logoBox) / 2 - pad;
      var bwh = logoBox + pad * 2;
      ctx.fillStyle = bg;
      drawRoundedRect(ctx, bx, by, bwh, bwh, bwh * 0.16);
      ctx.fill();
      ctx.drawImage(opts.logo, (size - logoBox) / 2, (size - logoBox) / 2, logoBox, logoBox);
    }
  }

  function buildSvgString(qr, opts) {
    var size = opts.size || 512;
    var margin = opts.margin != null ? opts.margin : 4;
    var fg = opts.fg || "#101114";
    var bg = opts.bg || "#ffffff";
    var count = qr.getModuleCount();
    var moduleSize = size / (count + margin * 2);
    var rects = "";
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          var x = ((c + margin) * moduleSize).toFixed(2);
          var y = ((r + margin) * moduleSize).toFixed(2);
          rects += '<rect x="' + x + '" y="' + y + '" width="' + moduleSize.toFixed(2) + '" height="' + moduleSize.toFixed(2) + '" fill="' + fg + '"/>';
        }
      }
    }
    var logoMarkup = "";
    if (opts.logo) {
      var frac = opts.logoSize || 0.2;
      var logoBox = size * frac;
      var pad = logoBox * 0.16;
      var bx = (size - logoBox) / 2 - pad;
      var by = (size - logoBox) / 2 - pad;
      var bwh = logoBox + pad * 2;
      logoMarkup = '<rect x="' + bx.toFixed(2) + '" y="' + by.toFixed(2) + '" width="' + bwh.toFixed(2) + '" height="' + bwh.toFixed(2) + '" rx="' + (bwh * 0.16).toFixed(2) + '" fill="' + bg + '"/>' +
        '<image href="' + opts.logo + '" x="' + ((size - logoBox) / 2).toFixed(2) + '" y="' + ((size - logoBox) / 2).toFixed(2) + '" width="' + logoBox.toFixed(2) + '" height="' + logoBox.toFixed(2) + '"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<rect width="100%" height="100%" fill="' + bg + '"/>' + rects + logoMarkup + "</svg>";
  }

  /* -------------------------------------------------------------
     Hero mini live preview (URL only, always-on demo)
  ------------------------------------------------------------- */
  function initHeroLive() {
    var input = document.querySelector("[data-hero-input]");
    var stage = document.querySelector("[data-hero-stage]");
    if (!input || !stage) return;

    function render() {
      var val = input.value.trim() || "https://quickmark.app";
      stage.innerHTML = "";
      var canvas = document.createElement("canvas");
      stage.appendChild(canvas);
      try {
        var qr = buildQrModel(val, "M");
        renderToCanvas(canvas, qr, { size: 220, margin: 2, fg: "#101114", bg: "#ffffff" });
      } catch (e) {
        stage.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Content too long to render live.</p>';
      }
    }

    var debounceTimer;
    input.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(render, 180);
    });
    render();
  }

  /* -------------------------------------------------------------
     Main generator
  ------------------------------------------------------------- */
  function initGenerator() {
    var root = document.querySelector("[data-generator]");
    if (!root) return;

    var typeButtons = root.querySelectorAll(".type-btn");
    var fieldGroups = root.querySelectorAll("[data-fields]");
    var currentType = "url";

    var fgInput = root.querySelector("[data-fg]");
    var fgHex = root.querySelector("[data-fg-hex]");
    var bgInput = root.querySelector("[data-bg]");
    var bgHex = root.querySelector("[data-bg-hex]");
    var sizeSlider = root.querySelector("[data-size]");
    var sizeVal = root.querySelector("[data-size-val]");
    var marginSlider = root.querySelector("[data-margin]");
    var marginVal = root.querySelector("[data-margin-val]");
    var ecSelect = root.querySelector("[data-ec]");
    var canvasHolder = root.querySelector("[data-canvas-holder]");
    var emptyState = root.querySelector("[data-empty-state]");
    var metaEl = root.querySelector("[data-gen-meta]");

    var logoInput = root.querySelector("[data-logo-input]");
    var logoRemoveBtn = root.querySelector("[data-logo-remove]");
    var logoThumb = root.querySelector("[data-logo-thumb]");
    var logoPreviewImg = root.querySelector("[data-logo-preview]");
    var logoEmptyIcon = root.querySelector("[data-logo-empty]");
    var logoSizeField = root.querySelector("[data-logo-size-field]");
    var logoSizeSlider = root.querySelector("[data-logo-size]");
    var logoSizeVal = root.querySelector("[data-logo-size-val]");

    var downloadPngBtn = root.querySelector("[data-download-png]");
    var downloadSvgBtn = root.querySelector("[data-download-svg]");
    var printBtn = root.querySelector("[data-print]");
    var resetBtn = root.querySelector("[data-reset]");
    var copyBtn = root.querySelector("[data-copy]");

    var currentQr = null;
    var currentCanvas = null;
    var logoImage = null;
    var logoDataUrl = null;
    var ecBeforeLogo = null;

    function logoSizeFraction() {
      return (logoSizeSlider ? parseInt(logoSizeSlider.value, 10) : 20) / 100;
    }

    function handleLogoFile(file) {
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        toast("Please choose an image file.", "error");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast("Logo image should be under 2MB.", "error");
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          logoImage = img;
          logoDataUrl = reader.result;
          logoPreviewImg.src = logoDataUrl;
          logoThumb.hidden = false;
          logoEmptyIcon.hidden = true;
          logoRemoveBtn.hidden = false;
          logoSizeField.hidden = false;
          if (ecSelect && ecSelect.value !== "H") {
            ecBeforeLogo = ecSelect.value;
            ecSelect.value = "H";
            toast("Error correction raised to High so the logo doesn't break scanning.", "info");
          }
          renderQr();
        };
        img.onerror = function () {
          toast("That image couldn't be loaded.", "error");
        };
        img.src = reader.result;
      };
      reader.onerror = function () {
        toast("Couldn't read that file.", "error");
      };
      reader.readAsDataURL(file);
    }

    function clearLogo() {
      logoImage = null;
      logoDataUrl = null;
      if (logoInput) logoInput.value = "";
      logoThumb.hidden = true;
      logoEmptyIcon.hidden = false;
      logoRemoveBtn.hidden = true;
      logoSizeField.hidden = true;
      if (ecSelect && ecBeforeLogo) {
        ecSelect.value = ecBeforeLogo;
        ecBeforeLogo = null;
      }
      renderQr();
    }

    if (logoInput) logoInput.addEventListener("change", function (e) {
      handleLogoFile(e.target.files && e.target.files[0]);
    });
    if (logoRemoveBtn) logoRemoveBtn.addEventListener("click", clearLogo);

    function buildPageLink(path, params) {
      var url = new URL(path, window.location.href);
      Object.keys(params).forEach(function (k) {
        if (params[k]) url.searchParams.set(k, params[k]);
      });
      return url.toString();
    }

    function activeContentString() {
      switch (currentType) {
        case "url": {
          var v = getVal("url-input");
          if (!v) return "";
          if (!/^https?:\/\//i.test(v)) v = "https://" + v;
          return v;
        }
        case "text": {
          var t = getVal("text-input");
          if (!t) return "";
          // Point at the bundled viewer page so scanning actually opens
          // and displays the text, instead of relying on a scanner app's
          // generic "raw text" popup (which many apps don't show at all).
          return buildPageLink("view.html", { t: t });
        }
        case "app": {
          var ios = getVal("app-ios");
          var android = getVal("app-android");
          var fallback = getVal("app-fallback");
          if (!ios && !android) return "";
          return buildPageLink("app.html", { ios: ios, android: android, fallback: fallback });
        }
        case "email": {
          var to = getVal("email-to"), subj = getVal("email-subject"), body = getVal("email-body");
          if (!to) return "";
          return "mailto:" + to + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
        }
        case "phone": {
          var p = getVal("phone-input");
          return p ? "tel:" + p.replace(/\s+/g, "") : "";
        }
        case "sms": {
          var num = getVal("sms-number"), msg = getVal("sms-message");
          if (!num) return "";
          return "smsto:" + num + ":" + msg;
        }
        case "whatsapp": {
          var wnum = getVal("wa-number"), wmsg = getVal("wa-message");
          if (!wnum) return "";
          return "https://wa.me/" + wnum.replace(/[^\d]/g, "") + (wmsg ? "?text=" + encodeURIComponent(wmsg) : "");
        }
        case "wifi": {
          var ssid = getVal("wifi-ssid"), pass = getVal("wifi-password"), enc = getVal("wifi-enc");
          if (!ssid) return "";
          var esc = function (s) { return (s || "").replace(/([\\;,:"])/g, "\\$1"); };
          if (enc === "nopass") return "WIFI:T:nopass;S:" + esc(ssid) + ";;";
          return "WIFI:T:" + enc + ";S:" + esc(ssid) + ";P:" + esc(pass) + ";;";
        }
        case "location": {
          var lat = getVal("geo-lat"), lng = getVal("geo-lng");
          if (!lat || !lng) return "";
          return "https://maps.google.com/?q=" + lat + "," + lng;
        }
        default:
          return "";
      }
    }

    function getVal(name) {
      var el = root.querySelector('[name="' + name + '"]');
      return el ? el.value.trim() : "";
    }

    function switchType(type) {
      currentType = type;
      typeButtons.forEach(function (b) {
        b.setAttribute("aria-pressed", b.dataset.type === type);
      });
      fieldGroups.forEach(function (g) {
        g.classList.toggle("hidden", g.dataset.fields !== type);
      });
      renderQr();
    }

    typeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () { switchType(btn.dataset.type); });
    });

    root.addEventListener("input", function (e) {
      if (e.target.matches("input, select, textarea")) {
        updateCounters(e.target);
        validateField(e.target);
        if (e.target === fgInput) fgHex.textContent = fgInput.value.toUpperCase();
        if (e.target === bgInput) bgHex.textContent = bgInput.value.toUpperCase();
        if (e.target === sizeSlider) sizeVal.textContent = sizeSlider.value + " px";
        if (e.target === marginSlider) marginVal.textContent = marginSlider.value;
        if (e.target === logoSizeSlider) logoSizeVal.textContent = logoSizeSlider.value + "%";
        renderQr();
      }
    });
    root.addEventListener("change", function (e) {
      if (e.target.matches("select")) renderQr();
    });

    function updateCounters(el) {
      var group = el.closest(".field-group");
      if (!group) return;
      var counter = group.querySelector(".counter");
      if (counter && el.maxLength && el.maxLength > 0) {
        counter.textContent = el.value.length + " / " + el.maxLength;
      }
    }

    var VALIDATORS = {
      "url-input": function (v) { return v.length === 0 || /^[a-z0-9.\-]+\.[a-z]{2,}([/?#].*)?$/i.test(v) || /^https?:\/\//i.test(v); },
      "email-to": function (v) { return v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); },
      "phone-input": function (v) { return v.length === 0 || /^[+\d][\d\s-]{5,}$/.test(v); },
      "sms-number": function (v) { return v.length === 0 || /^[+\d][\d\s-]{5,}$/.test(v); },
      "wa-number": function (v) { return v.length === 0 || /^[+\d][\d\s-]{5,}$/.test(v); },
      "geo-lat": function (v) { return v.length === 0 || /^-?\d{1,3}(\.\d+)?$/.test(v); },
      "geo-lng": function (v) { return v.length === 0 || /^-?\d{1,3}(\.\d+)?$/.test(v); },
      "app-ios": function (v) { return v.length === 0 || /^https:\/\/apps\.apple\.com\//i.test(v); },
      "app-android": function (v) { return v.length === 0 || /^https:\/\/play\.google\.com\//i.test(v); },
      "app-fallback": function (v) { return v.length === 0 || /^https?:\/\//i.test(v); }
    };
    function validateField(el) {
      var name = el.getAttribute("name");
      var validator = VALIDATORS[name];
      var group = el.closest(".field-group");
      if (!validator || !group) return;
      var ok = validator(el.value.trim());
      group.classList.toggle("invalid", !ok);
    }

    function renderQr() {
      var content = activeContentString();
      if (!content) {
        canvasHolder.hidden = true;
        emptyState.hidden = false;
        metaEl.textContent = "";
        currentQr = null;
        return;
      }
      canvasHolder.classList.add("loading");
      requestAnimationFrame(function () {
        try {
          var ec = ecSelect ? ecSelect.value : "M";
          var qr = buildQrModel(content, ec);
          currentQr = qr;
          canvasHolder.hidden = false;
          emptyState.hidden = true;
          canvasHolder.innerHTML = "";
          var canvas = document.createElement("canvas");
          canvasHolder.appendChild(canvas);
          currentCanvas = canvas;
          renderToCanvas(canvas, qr, {
            size: 260,
            margin: marginSlider ? parseInt(marginSlider.value, 10) : 4,
            fg: fgInput ? fgInput.value : "#101114",
            bg: bgInput ? bgInput.value : "#ffffff",
            logo: logoImage,
            logoSize: logoSizeFraction()
          });
          var modules = qr.getModuleCount();
          metaEl.textContent = modules + " × " + modules + " modules · EC " + ec + " · " + content.length + " chars" + (logoImage ? " · logo added" : "");
        } catch (err) {
          canvasHolder.hidden = true;
          emptyState.hidden = false;
          emptyState.querySelector("p").textContent = "That's too much data for a single QR code. Try shortening it.";
          metaEl.textContent = "";
        } finally {
          canvasHolder.classList.remove("loading");
        }
      });
    }

    function exportSize() {
      return sizeSlider ? parseInt(sizeSlider.value, 10) : 512;
    }

    if (downloadPngBtn) downloadPngBtn.addEventListener("click", function () {
      if (!currentQr) { toast("Generate a QR code first.", "error"); return; }
      var tmp = document.createElement("canvas");
      renderToCanvas(tmp, currentQr, {
        size: exportSize(),
        margin: marginSlider ? parseInt(marginSlider.value, 10) : 4,
        fg: fgInput.value,
        bg: bgInput.value,
        logo: logoImage,
        logoSize: logoSizeFraction()
      });
      var link = document.createElement("a");
      link.download = "quickmark-qr.png";
      link.href = tmp.toDataURL("image/png");
      link.click();
      toast("PNG downloaded.", "success");
    });

    if (downloadSvgBtn) downloadSvgBtn.addEventListener("click", function () {
      if (!currentQr) { toast("Generate a QR code first.", "error"); return; }
      var svg = buildSvgString(currentQr, {
        size: exportSize(),
        margin: marginSlider ? parseInt(marginSlider.value, 10) : 4,
        fg: fgInput.value,
        bg: bgInput.value,
        logo: logoDataUrl,
        logoSize: logoSizeFraction()
      });
      var blob = new Blob([svg], { type: "image/svg+xml" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.download = "quickmark-qr.svg";
      link.href = url;
      link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast("SVG downloaded.", "success");
    });

    if (printBtn) printBtn.addEventListener("click", function () {
      if (!currentQr) { toast("Generate a QR code first.", "error"); return; }
      var svg = buildSvgString(currentQr, { size: 600, margin: 3, fg: fgInput.value, bg: bgInput.value, logo: logoDataUrl, logoSize: logoSizeFraction() });
      var win = window.open("", "_blank", "width=500,height=600");
      win.document.write("<title>Print QR Code — QuickMark</title><style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;}</style>" + svg);
      win.document.close();
      win.focus();
      setTimeout(function () { win.print(); }, 300);
    });

    if (copyBtn) copyBtn.addEventListener("click", function () {
      var content = activeContentString();
      if (!content) { toast("Nothing to copy yet.", "error"); return; }
      navigator.clipboard.writeText(content).then(function () {
        toast("Content copied to clipboard.", "success");
      }).catch(function () {
        toast("Couldn't copy — try selecting the text manually.", "error");
      });
    });

    if (resetBtn) resetBtn.addEventListener("click", function () {
      root.querySelectorAll("input[type='text'], input[type='tel'], input[type='email'], input[type='url'], input[type='number'], textarea").forEach(function (el) { el.value = ""; });
      root.querySelectorAll(".field-group").forEach(function (g) { g.classList.remove("invalid"); });
      if (fgInput) { fgInput.value = "#101114"; fgHex.textContent = "#101114"; }
      if (bgInput) { bgInput.value = "#ffffff"; bgHex.textContent = "#FFFFFF"; }
      if (sizeSlider) { sizeSlider.value = 512; sizeVal.textContent = "512 px"; }
      if (marginSlider) { marginSlider.value = 4; marginVal.textContent = "4"; }
      if (logoSizeSlider) { logoSizeSlider.value = 20; logoSizeVal.textContent = "20%"; }
      ecBeforeLogo = null;
      clearLogo();
      if (ecSelect) ecSelect.value = "M";
      switchType("url");
      toast("Generator reset.", "info");
    });

    renderQr();
  }

  /* -------------------------------------------------------------
     Contact form (client-side only — opens the visitor's email client)
  ------------------------------------------------------------- */
  function initContactForm() {
    var form = document.querySelector("[data-contact-form]");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.querySelector('[name="name"]').value.trim();
      var email = form.querySelector('[name="email"]').value.trim();
      var subject = form.querySelector('[name="subject"]').value.trim();
      var message = form.querySelector('[name="message"]').value.trim();
      if (!name || !email || !message) {
        toast("Please fill in your name, email, and message.", "error");
        return;
      }
      var body = "From: " + name + " (" + email + ")\n\n" + message;
      var mailto = "mailto:hello@quickmark.app?subject=" + encodeURIComponent(subject || "Website contact form") + "&body=" + encodeURIComponent(body);
      window.location.href = mailto;
      toast("Opening your email client…", "success");
      form.reset();
    });
  }

  /* -------------------------------------------------------------
     Boot
  ------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initNav();
    initFaq();
    initHeroLive();
    initGenerator();
    initContactForm();

    // Footer year
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  });
})();
