/* Ride Bangla IT Team — "Latest Updates" loader.
 *
 * Reads published docs from Firestore collection `it_team_updates`
 * (written by the Admin Console) and renders them into the #it-updates
 * section on the homepage. Same fetch-and-render shape as the
 * portfolio loader in index.html: live data first, section hidden
 * when there is nothing valid to show.
 *
 * Firebase config: the PUBLIC web-app values of the shared project
 * (ride-bangla-app) — the same values assets/js/reviews.js and the
 * contact-page lead persistence already ship (safe to ship in
 * client-side code by design; access control lives in the Firestore
 * rules, not here). With the config filled, the section loads live
 * updates instead of staying hidden.
 *
 * Deliberately NO hardcoded sample updates: with no live data the
 * section hides instead of showing invented content.
 */
(function () {
  "use strict";

  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyAZvlJJcJUvM7RJt771De5PyLNT_SjEGfQ",
    authDomain: "ride-bangla-app.firebaseapp.com",
    projectId: "ride-bangla-app",
    storageBucket: "ride-bangla-app.firebasestorage.app",
    messagingSenderId: "363230284581",
    appId: "1:363230284581:web:a42e57a134410a4eae68cc"
  };

  var SDK_VERSION = "10.14.1";
  var MAX_ITEMS = 12;

  var section = document.getElementById("it-updates");
  var list = document.getElementById("it-updates-list");
  var status = document.getElementById("it-updates-status");
  var langBtn = document.getElementById("lang");
  if (!section || !list) return;

  function hide() {
    section.style.display = "none";
  }

  function lang() {
    try {
      return localStorage.getItem("rbit-lang") || "en";
    } catch (e) {
      return "en";
    }
  }

  function isConfigured() {
    return (
      FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.apiKey.indexOf("PASTE_FROM") !== 0 &&
      FIREBASE_CONFIG.appId &&
      FIREBASE_CONFIG.appId.indexOf("PASTE_FROM") !== 0 &&
      FIREBASE_CONFIG.projectId
    );
  }

  function timeValue(v) {
    if (!v) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      var t = Date.parse(v);
      return isNaN(t) ? 0 : t;
    }
    if (v instanceof Date) return v.getTime();
    if (typeof v.toDate === "function") {
      try {
        return v.toDate().getTime();
      } catch (e) {
        return 0;
      }
    }
    if (typeof v.seconds === "number") return v.seconds * 1000;
    return 0;
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

  function isYouTubeUrl(u) {
    try {
      var h = new URL(u).hostname;
      return (
        h === "www.youtube.com" ||
        h === "youtube.com" ||
        h === "m.youtube.com" ||
        h === "youtu.be" ||
        h === "www.youtu.be"
      );
    } catch (e) {
      return false;
    }
  }

  function str(v) {
    return typeof v === "string" ? v : "";
  }

  function pickText(en, bn) {
    var l = lang();
    if (l === "bn") return (bn && bn.trim()) || (en && en.trim()) || "";
    return (en && en.trim()) || (bn && bn.trim()) || "";
  }

  /* Exact doc shape written by the Admin Console:
     { title, slug, excerpt, body, category,
       media_type: 'text'|'image'|'video'|'mixed',
       image_url, video_url, published, published_at, created_at,
       title_bn, body_bn, target: 'it_team' }
     Admin-screen alias shape also accepted (normalize() falls back):
     update_type for media_type, image_uri for image_url,
     video_uri for video_url, status == 'published' for published. */
  function normalize(id, raw) {
    var title = str(raw.title).trim() || str(raw.title_bn).trim();
    if (!title) return null;
    return {
      id: id,
      title: str(raw.title).trim(),
      titleBn: str(raw.title_bn).trim(),
      excerpt: str(raw.excerpt).trim(),
      excerptBn: str(raw.excerpt_bn).trim(),
      body: str(raw.body).trim(),
      bodyBn: str(raw.body_bn).trim(),
      category: str(raw.category).trim(),
      mediaType: str(raw.media_type).trim() || str(raw.update_type).trim(),
      imageUrl: safeHttpsUrl(raw.image_url) || safeHttpsUrl(raw.image_uri),
      videoUrl: safeHttpsUrl(raw.video_url) || safeHttpsUrl(raw.video_uri),
      publishedAt: timeValue(raw.published_at) || timeValue(raw.created_at) || timeValue(raw.createdAt) || timeValue(raw.updatedAt)
    };
  }

  var updates = [];

  function render() {
    var l = lang();
    list.innerHTML = "";
    updates.forEach(function (u) {
      var card = document.createElement("article");
      card.className = "card";

      var head = document.createElement("h3");
      head.textContent = pickText(u.title, u.titleBn);
      card.appendChild(head);

      if (u.category) {
        var cat = document.createElement("p");
        var chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = u.category;
        cat.appendChild(chip);
        card.appendChild(cat);
      }

      if (u.publishedAt) {
        var date = document.createElement("p");
        try {
          date.textContent = new Date(u.publishedAt).toLocaleDateString(
            l === "bn" ? "bn-BD" : "en-GB",
            { day: "numeric", month: "long", year: "numeric" }
          );
        } catch (e) {
          date.textContent = "";
        }
        if (date.textContent) card.appendChild(date);
      }

      var showImage =
        (u.mediaType === "image" || u.mediaType === "mixed") && u.imageUrl;
      var showVideo =
        (u.mediaType === "video" || u.mediaType === "mixed") && u.videoUrl;

      if (showImage) {
        var img = document.createElement("img");
        img.src = u.imageUrl;
        img.alt = pickText(u.title, u.titleBn);
        img.loading = "lazy";
        card.appendChild(img);
      }

      if (showVideo) {
        if (isYouTubeUrl(u.videoUrl)) {
          var a = document.createElement("a");
          a.className = "btn sm";
          a.href = u.videoUrl;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = l === "bn" ? "ভিডিও দেখুন" : "Watch video";
          card.appendChild(a);
        } else {
          var v = document.createElement("video");
          v.controls = true;
          v.preload = "metadata";
          v.src = u.videoUrl;
          card.appendChild(v);
        }
      }

      var excerpt = pickText(u.excerpt, u.excerptBn);
      var body = pickText(u.body, u.bodyBn);
      if (!excerpt && body) {
        excerpt = body.length > 280 ? body.slice(0, 280) + "…" : body;
      }
      if (excerpt) {
        var p = document.createElement("p");
        p.textContent = excerpt;
        card.appendChild(p);
      }

      if (body && body !== excerpt) {
        var det = document.createElement("details");
        var sum = document.createElement("summary");
        sum.textContent = l === "bn" ? "আরও পড়ুন" : "Read more";
        det.appendChild(sum);
        var bp = document.createElement("p");
        bp.textContent = body;
        det.appendChild(bp);
        card.appendChild(det);
      }

      list.appendChild(card);
    });
    if (status) status.style.display = "none";
  }

  function loadFrom(db) {
    var base = db.collection("it_team_updates").where("published", "==", true);

    function handle(snapshot) {
      var items = [];
      snapshot.forEach(function (doc) {
        var n = normalize(doc.id, doc.data() || {});
        if (n) items.push(n);
      });
      if (!items.length) {
        hide();
        return;
      }
      items.sort(function (a, b) {
        return b.publishedAt - a.publishedAt;
      });
      updates = items.slice(0, MAX_ITEMS);
      render();
    }

    base
      .orderBy("published_at", "desc")
      .limit(MAX_ITEMS)
      .get()
      .then(handle)
      .catch(function () {
        /* Same fallback as the main site's updates consumer: if the
           composite index (published + published_at) is not deployed yet,
           read without orderBy and sort client-side. */
        base
          .limit(50)
          .get()
          .then(handle)
          .catch(function () {
            /* Rules also allow reads of docs saved with the status
               shape (status == 'published') instead of the boolean
               shape; try that shape before giving up. */
            db.collection("it_team_updates")
              .where("status", "==", "published")
              .limit(50)
              .get()
              .then(handle)
              .catch(function () {
                hide();
              });
          });
      });
  }

  function init() {
    try {
      if (!window.firebase || !window.firebase.firestore) {
        hide();
        return;
      }
      var app =
        window.firebase.apps && window.firebase.apps.length
          ? window.firebase.app()
          : window.firebase.initializeApp(FIREBASE_CONFIG);
      loadFrom(window.firebase.firestore(app));
    } catch (e) {
      hide();
    }
  }

  function loadSdk() {
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
      var fsScript = document.createElement("script");
      fsScript.src =
        "https://www.gstatic.com/firebasejs/" +
        SDK_VERSION +
        "/firebase-firestore-compat.js";
      fsScript.onload = init;
      fsScript.onerror = hide;
      document.head.appendChild(fsScript);
    };
    appScript.onerror = hide;
    document.head.appendChild(appScript);
  }

  if (!isConfigured()) {
    hide();
    return;
  }

  /* Re-render the list when the existing EN/বাংলা toggle is used.
     The page's own toggle handler runs first (it is registered before
     this listener); by the time this fires, localStorage already holds
     the new language. */
  if (langBtn) {
    langBtn.addEventListener("click", function () {
      if (updates.length) render();
    });
  }

  loadSdk();
})();
