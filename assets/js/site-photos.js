/* Ride Bangla IT Team — photo-slot overrides loader.
 *
 * Reads photo overrides from Firestore collection `website_photos`
 * (written by the Admin Console) and applies them to the elements
 * tagged with data-photo-slot / data-photo-bg on this page.
 *
 * Doc shape (one doc per override):
 *   { site: "it_team", slot: "<slotId>", imageUrl: "https://..." }
 * The slot may also be given as the doc ID when the `slot` field is
 * absent. Only overrides with a valid https:// imageUrl are applied.
 *
 * Firebase config: same PUBLIC web-app values pattern as
 * assets/js/it-updates.js (safe to ship in client-side code by design).
 * Fill in the four PASTE_FROM_FIREBASE_CONSOLE placeholders before
 * publishing; until then the loader silently does nothing and the
 * hardcoded photos stay exactly as they are.
 *
 * One-time read only (getDocs, no onSnapshot): photos change rarely,
 * so no permanent listener is kept open. Elements rendered after the
 * read (e.g. the portfolio slider) are covered by a MutationObserver
 * that re-applies the already-fetched overrides to newly added nodes.
 *
 * Guards: only https:// URLs are applied; empty / missing / invalid
 * values are ignored; everything is wrapped in try/catch and never
 * throws; elements without an override are never touched.
 */
(function () {
  "use strict";

  var FIREBASE_CONFIG = {
    apiKey: "PASTE_FROM_FIREBASE_CONSOLE",
    authDomain: "ride-bangla-app.firebaseapp.com",
    projectId: "ride-bangla-app",
    storageBucket: "PASTE_FROM_FIREBASE_CONSOLE",
    messagingSenderId: "PASTE_FROM_FIREBASE_CONSOLE",
    appId: "PASTE_FROM_FIREBASE_CONSOLE"
  };

  var SDK_VERSION = "10.14.1";

  /* Dark overlay kept over the team-band photo so white text stays
     readable. Only the photo URL part is swapped; the gradient is
     copied verbatim from the site's .band CSS rule. */
  var BAND_OVERLAY =
    "linear-gradient(rgba(5,60,31,.90),rgba(8,40,24,.94))";

  function isConfigured() {
    return (
      FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.apiKey.indexOf("PASTE_FROM") !== 0 &&
      FIREBASE_CONFIG.appId &&
      FIREBASE_CONFIG.appId.indexOf("PASTE_FROM") !== 0 &&
      FIREBASE_CONFIG.projectId
    );
  }

  function safeHttpsUrl(v) {
    if (typeof v !== "string" || !v.trim()) return null;
    try {
      var u = new URL(v.trim());
      return u.protocol === "https:" ? u.toString() : null;
    } catch (e) {
      return null;
    }
  }

  function str(v) {
    return typeof v === "string" ? v : "";
  }

  function validSlotId(v) {
    if (typeof v !== "string") return null;
    var s = v.trim();
    return /^[A-Za-z0-9_-]+$/.test(s) ? s : null;
  }

  /* slotId -> validated https URL. Filled once from Firestore. */
  var overrides = {};

  function applyToElement(el) {
    try {
      var slot = el.getAttribute("data-photo-slot");
      if (slot && overrides[slot]) {
        var tag = el.tagName;
        if (tag === "IMG") {
          el.setAttribute("src", overrides[slot]);
        } else if (tag === "VIDEO") {
          el.setAttribute("poster", overrides[slot]);
        }
      }
      var bg = el.getAttribute("data-photo-bg");
      if (bg && overrides[bg]) {
        el.style.backgroundImage =
          BAND_OVERLAY + ", url(" + overrides[bg] + ")";
      }
    } catch (e) {
      /* Never throw: one bad element must not break the rest. */
    }
  }

  function applyToTree(root) {
    try {
      if (!root) return;
      if (root.nodeType === 1) {
        if (
          root.hasAttribute("data-photo-slot") ||
          root.hasAttribute("data-photo-bg")
        ) {
          applyToElement(root);
        }
      }
      if (
        root.nodeType === 1 ||
        root.nodeType === 9 ||
        root.nodeType === 11
      ) {
        var tagged = root.querySelectorAll(
          "[data-photo-slot],[data-photo-bg]"
        );
        for (var i = 0; i < tagged.length; i++) {
          applyToElement(tagged[i]);
        }
      }
    } catch (e) {
      /* Never throw. */
    }
  }

  function observeLaterNodes() {
    try {
      if (!("MutationObserver" in window) || !document.body) return;
      var mo = new MutationObserver(function (mutations) {
        for (var m = 0; m < mutations.length; m++) {
          var added = mutations[m].addedNodes;
          for (var n = 0; n < added.length; n++) {
            applyToTree(added[n]);
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      /* Observer is best-effort only; already-rendered elements are
         covered by the direct apply below. */
    }
  }

  function loadFrom(db) {
    try {
      db.collection("website_photos")
        .where("site", "==", "it_team")
        .get()
        .then(function (snapshot) {
          try {
            snapshot.forEach(function (doc) {
              try {
                var raw = doc.data() || {};
                var slot =
                  validSlotId(raw.slot) || validSlotId(doc.id);
                if (!slot) return;
                var url = safeHttpsUrl(raw.imageUrl);
                if (!url) url = safeHttpsUrl(raw.image_url);
                if (!url) return;
                overrides[slot] = url;
              } catch (e) {
                /* Skip one bad doc; keep the rest. */
              }
            });
            applyToTree(document);
            observeLaterNodes();
          } catch (e) {
            /* Never throw. */
          }
        })
        .catch(function () {
          /* Firestore read failed: hardcoded photos stay. */
        });
    } catch (e) {
      /* Never throw. */
    }
  }

  function init() {
    try {
      if (!window.firebase || !window.firebase.firestore) return;
      var app =
        window.firebase.apps && window.firebase.apps.length
          ? window.firebase.app()
          : window.firebase.initializeApp(FIREBASE_CONFIG);
      loadFrom(window.firebase.firestore(app));
    } catch (e) {
      /* SDK init failed: hardcoded photos stay. */
    }
  }

  function loadSdk() {
    try {
      if (window.firebase && window.firebase.firestore) {
        init();
        return;
      }
      var appScript = document.createElement("script");
      appScript.src =
        "https://www.gstatic.com/firebasejs/" +
        SDK_VERSION +
        "/firebase-app-compat.js";
      appScript.onload = function () {
        try {
          var fsScript = document.createElement("script");
          fsScript.src =
            "https://www.gstatic.com/firebasejs/" +
            SDK_VERSION +
            "/firebase-firestore-compat.js";
          fsScript.onload = init;
          fsScript.onerror = function () {
            /* SDK failed to load: hardcoded photos stay. */
          };
          document.head.appendChild(fsScript);
        } catch (e) {
          /* Never throw. */
        }
      };
      appScript.onerror = function () {
        /* SDK failed to load: hardcoded photos stay. */
      };
      document.head.appendChild(appScript);
    } catch (e) {
      /* Never throw. */
    }
  }

  if (!isConfigured()) {
    /* Config still placeholder: silently do nothing. */
    return;
  }

  loadSdk();
})();
