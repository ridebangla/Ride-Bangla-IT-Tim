/* Ride Bangla IT Team — public Reviews section (assets/js/reviews.js)
 *
 * UNIFIED REVIEWS SPEC (programme 2026-10-24, ~/workspace/fullwidth-reviews/
 * ARCHITECTURE.md §B1–B6): one shared pool — Firestore collection
 * `website_reviews`, project `ride-bangla-app` — serves all five public
 * sites (Studio, Tools, AI, Main, IT). This file adapts that system to
 * this site's static stack and theme; the data contract is the spec's:
 *
 *   READ (public): approved reviews only, NO sourceSite filter (every
 *     site shows ALL sources) — where("status","==","approved")
 *     orderBy("created_at","desc"), 24 per page + Load more, read here
 *     via the Firestore REST API (the rules allow public reads:
 *     `allow read: if true`). The ordered query needs a composite
 *     index (status + created_at); while it is missing it returns
 *     HTTP 400, so the unordered fallback (client-side sort, growing
 *     limit) IS the plan, not a bug. No fake/seeded data: an empty
 *     pool renders the honest empty state, and a failed fetch
 *     (BOTH attempts non-2xx — e.g. 429 quota exhaustion, 403, or
 *     network failure) renders a DISTINCT "temporarily unavailable"
 *     state with a Try again button.
 *   SUMMARY: average (1 decimal) + count + per-star percentages,
 *     computed from the same approved list the slider displays. When
 *     more pages exist the summary says so honestly ("Based on the
 *     latest N reviews shown") — never a 24-review sample presented
 *     as a lifetime total, and never a fake average/count on empty.
 *   PER-SITE RATINGS (2026-10-24 completion): a separate "Ratings
 *     across Ride Bangla websites" block inside #rb-reviews. It is
 *     NOT computed from the loaded page: a dedicated aggregate read
 *     (fetchAggregatePool) re-reads the FULL approved pool from
 *     website_reviews with the same approved-only filter as the
 *     cards, then groups by sourceSite. Rows in fixed order: IT
 *     first (marked "This website"), then Main, AI, Studio, Tools,
 *     then the legacy row (docs with no/invalid sourceSite — NEVER
 *     split by site), then the "All websites" total. A site with
 *     zero attributable reviews shows "No reviews yet" — no fake
 *     average, no stars presented as a rating. AGGREGATE CAP: the
 *     aggregate read covers at most AGGREGATE_CAP (500) approved
 *     docs; if that cap is hit and more docs may exist, the block
 *     shows an honest capped note (see fetchAggregatePool). The
 *     live pool is far below this cap, so today the block is the
 *     full pool, not a sample.
 *   CARD: avatar (Google photo, https-only, initials fallback), name,
 *     star row, comment truncated at 80 chars with See more/less,
 *     "Verified Google Account" chip ONLY when the stored record's
 *     source == "google", the MANDATORY source badge (§B2: "Reviewed
 *     on <site>" for studio|tools|ai|main|it; legacy docs without
 *     sourceSite get ONLY "Reviewed on Ride Bangla — source site not
 *     recorded"), date.
 *   SLIDER: one row, one-card-at-a-time smooth slide (translateX),
 *     auto-advance every 4s with wrap-around, pause on hover/touch,
 *     arrows + dots when there is more than one page. Visible cards:
 *     1 on phones, 2 on tablets, 4 on desktop.
 *   WRITE: Google sign-in ONLY (Firebase Auth, lazy-loaded compat
 *     SDK; popup first, signInWithRedirect fallback on popup-blocked /
 *     popup-closed-by-user; google.com provider check before any
 *     submit); the document id IS the user's uid (one account = one
 *     review across ALL five sites), saved with status "pending" for
 *     admin moderation, source "google", sourceSite "it" (this site's
 *     constant — never user input, never a URL param), exactly the
 *     shape the spec's rules diff requires (keys uid/name/photo_url/
 *     rating/comment/status/source/sourceSite/created_at/updated_at;
 *     rating int 1–5; comment 2–600 chars; name/photo must match the
 *     Google token). sourceSite is set at CREATE and immutable after:
 *     an edit preserves the stored value and a legacy doc without one
 *     NEVER gains one through this client path (Admin-SDK backfill
 *     only, spec §B8). A signed-in user can edit their own review
 *     only while it is still pending.
 *     RULES GAP (spec §B7, OWNER ACTION): until the owner deploys the
 *     spec's rules diff (sourceSite in hasOnly + enum check), writes
 *     carrying sourceSite are REJECTED by the current deployed rules
 *     — a pre-deploy submit failure is that gap, not a code bug.
 *
 * Firebase config: the PUBLIC web-app values of the shared project
 * (ride-bangla-app) — embedded directly (spec §B5: never depend on
 * another site's runtime config endpoint for the read path). Public
 * web config is safe to ship client-side by design; access control
 * lives in the Firestore rules, not here.
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
  var COLLECTION = "website_reviews";
  var PAGE_SIZE = 24;
  var TRUNCATE_LENGTH = 80;
  /* Spec §B2: this site's constant — the ONLY sourceSite value IT writes. */
  var SITE = "it";
  var SOURCE_BADGES = {
    studio: "Reviewed on Ride Bangla Studio",
    tools: "Reviewed on Ride Bangla Tools",
    ai: "Reviewed on Ride Bangla AI",
    main: "Reviewed on Ride Bangla Main Website",
    it: "Reviewed on Ride Bangla IT Team"
  };
  var LEGACY_BADGE = "Reviewed on Ride Bangla — source site not recorded";
  /* Per-site ratings block: fixed row order (this site first), short
     labels matching the §B2 badge site names. */
  var SITE_ORDER = ["it", "main", "ai", "studio", "tools"];
  var SITE_SHORT_NAMES = {
    it: "IT Team",
    main: "Main Website",
    ai: "AI",
    studio: "Studio",
    tools: "Tools"
  };
  /* Aggregate-read cap (see fetchAggregatePool): the dedicated
     aggregate read never fetches more than this many approved docs.
     If the cap is hit and more docs may exist, the UI says so. */
  var AGGREGATE_CAP = 500;
  function sourceBadgeFor(value) {
    return Object.prototype.hasOwnProperty.call(SOURCE_BADGES, value) ? SOURCE_BADGES[value] : LEGACY_BADGE;
  }
  function validSourceSite(value) {
    return Object.prototype.hasOwnProperty.call(SOURCE_BADGES, value);
  }

  var root = document.getElementById("rb-reviews");
  if (!root) return;

  var COPY = {
    en: {
      verified: "Verified Google Account",
      reviewsCount: function (n) { return n === 1 ? "1 review" : n + " reviews"; },
      loading: "Loading reviews…",
      empty: "No customer reviews are published yet.",
      emptySub: "Be the first to share your experience.",
      unavailable: "Reviews are temporarily unavailable — please check back later.",
      tryAgain: "Try again",
      loadMore: "Load more",
      basedOnLatest: function (n) { return "Based on the latest " + n + " reviews shown."; },
      siteRatingsHeading: "Ratings across Ride Bangla websites",
      thisWebsite: "This website",
      noReviewsYet: "No reviews yet",
      legacyReviews: "Reviews with source not recorded",
      allWebsites: "All websites",
      ratingsLoading: "Loading ratings…",
      ratingsUnavailable: "Ratings are temporarily unavailable — please check back later.",
      aggregateCapped: "Ratings cover the first 500 approved reviews.",
      seeMore: "See more",
      seeLess: "See less",
      writeReview: "Write a Review",
      closeReview: "Close Review",
      signInBody: "Sign in with your Google account to leave a real, verified review. One account, one honest review — no fake ratings.",
      signInWithGoogle: "Sign in with Google",
      signInFail: "Sign-in was cancelled or failed. Please try again.",
      signedInWith: "Signed in with Google",
      signOut: "Sign out",
      yourRating: "Your rating",
      reviewPlaceholder: "Tell others about your experience with Ride Bangla IT Team...",
      postReview: "Post Review",
      submitAndSignIn: "Submit & Sign in with Google",
      signInOnSubmit: "You'll sign in with Google when you submit — one quick step.",
      thankYou: "Thank you! Your review was submitted and is waiting for approval.",
      editReview: "Edit your review",
      reviewPublished: "Your review is published. Published reviews can't be edited.",
      reviewPending: "Your review is waiting for approval — you can still edit it below.",
      submitFail: "Could not submit your review. Please try again.",
      star: "star",
      stars: "stars",
      prev: "Previous reviews",
      next: "Next reviews",
      breakdown: "Rating breakdown"
    },
    bn: {
      verified: "যাচাইকৃত Google অ্যাকাউন্ট",
      reviewsCount: function (n) { return n + "টি রিভিউ"; },
      loading: "রিভিউ লোড হচ্ছে…",
      empty: "এখনো কোনো গ্রাহক রিভিউ প্রকাশিত হয়নি।",
      emptySub: "",
      unavailable: "রিভিউ এখন সাময়িকভাবে পাওয়া যাচ্ছে না — পরে আবার দেখুন।",
      tryAgain: "আবার চেষ্টা করুন",
      loadMore: "আরও লোড করুন",
      basedOnLatest: function (n) { return "দেখানো সর্বশেষ " + n + "টি রিভিউর ভিত্তিতে।"; },
      siteRatingsHeading: "Ride Bangla ওয়েবসাইটগুলোর রেটিং",
      thisWebsite: "এই ওয়েবসাইট",
      noReviewsYet: "এখনো কোনো রিভিউ নেই",
      legacyReviews: "উৎস রেকর্ড করা হয়নি এমন রিভিউ",
      allWebsites: "সব ওয়েবসাইট",
      ratingsLoading: "রেটিং লোড হচ্ছে…",
      ratingsUnavailable: "রেটিং এখন সাময়িকভাবে পাওয়া যাচ্ছে না — পরে আবার দেখুন।",
      aggregateCapped: "রেটিং প্রথম ৫০০টি অনুমোদিত রিভিউর ভিত্তিতে।",
      seeMore: "আরো দেখুন",
      seeLess: "কম দেখুন",
      writeReview: "রিভিউ লিখুন",
      closeReview: "রিভিউ বন্ধ করুন",
      signInBody: "বাস্তব, যাচাইকৃত রিভিউ দিতে আপনার Google অ্যাকাউন্ট দিয়ে সাইন ইন করুন। একটি অ্যাকাউন্ট, একটি সৎ রিভিউ — কোনো ভুয়া রেটিং নয়।",
      signInWithGoogle: "Google দিয়ে সাইন ইন",
      signInFail: "সাইন-ইন বাতিল হয়েছে বা ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
      signedInWith: "Google দিয়ে সাইন ইন করেছেন",
      signOut: "সাইন আউট",
      yourRating: "আপনার রেটিং",
      reviewPlaceholder: "Ride Bangla IT Team নিয়ে আপনার অভিজ্ঞতা অন্যদের জানান...",
      postReview: "রিভিউ পোস্ট করুন",
      submitAndSignIn: "সাবমিট করুন ও Google দিয়ে সাইন ইন",
      signInOnSubmit: "সাবমিট করার সময় Google দিয়ে সাইন ইন করবেন — মাত্র একটা ধাপ।",
      thankYou: "ধন্যবাদ! আপনার রিভিউ জমা হয়েছে এবং অনুমোদনের অপেক্ষায় আছে।",
      editReview: "আপনার রিভিউ সম্পাদনা করুন",
      reviewPublished: "আপনার রিভিউ প্রকাশিত হয়েছে। প্রকাশিত রিভিউ সম্পাদনা করা যায় না।",
      reviewPending: "আপনার রিভিউ অনুমোদনের অপেক্ষায় আছে — নিচে এখনো সম্পাদনা করতে পারবেন।",
      submitFail: "আপনার রিভিউ জমা দেওয়া যায়নি। আবার চেষ্টা করুন।",
      star: "স্টার",
      stars: "স্টার",
      prev: "আগের রিভিউ",
      next: "পরের রিভিউ",
      breakdown: "রেটিং বিবরণ"
    }
  };

  function lang() {
    try {
      return localStorage.getItem("rbit-lang") === "bn" ? "bn" : "en";
    } catch (e) {
      return "en";
    }
  }
  function t() {
    return COPY[lang()];
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  var STAR = "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.6 6.8L12 17l-6.2 3.4 1.6-6.8-5.2-4.6 6.9-.7z";
  var GOOGLE_G =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-9z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.4 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.9-3C.5 9.3 0 10.6 0 12s.5 2.7 1.3 3.9l3.9-3z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.4 0 3.3 2.7 1.3 6.6l3.9 3c.9-2.9 3.6-4.9 6.8-4.9z"/></svg>';

  function starSvg(cls) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR + '"/></svg>';
  }

  /* Fractional-fill star row (same rendering as the Tools site):
     shows the summary average; per-card rows use whole ratings. */
  function starsRowHtml(value, cls) {
    var out = '<span class="rb-stars" role="img" aria-label="' + value.toFixed(1) + ' out of 5 stars">';
    for (var i = 1; i <= 5; i++) {
      var f = Math.max(0, Math.min(1, value - (i - 1)));
      out +=
        '<span class="rb-star-wrap">' +
        starSvg("rb-star") +
        '<span class="rb-star-fill" style="width:' + Math.round(f * 100) + '%">' +
        starSvg("rb-star") +
        "</span></span>";
    }
    return out + "</span>";
  }

  function fmtDate(ms) {
    if (!ms) return "";
    try {
      return new Date(ms).toLocaleDateString(lang() === "bn" ? "bn-BD" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch (e) {
      return "";
    }
  }

  /* ------------------------------ data ------------------------------ */

  function fieldStr(fields, key) {
    var v = fields && fields[key];
    if (!v) return "";
    if (typeof v.stringValue === "string") return v.stringValue;
    return "";
  }
  function fieldRating(fields) {
    var v = fields && fields.rating;
    if (!v) return 0;
    var n = typeof v.integerValue === "string" ? parseInt(v.integerValue, 10) : v.doubleValue;
    if (typeof n !== "number" || isNaN(n)) return 0;
    return Math.min(5, Math.max(1, Math.round(n)));
  }
  function fieldTime(fields, key) {
    var v = fields && fields[key];
    if (!v || typeof v.timestampValue !== "string") return 0;
    var ms = Date.parse(v.timestampValue);
    return isNaN(ms) ? 0 : ms;
  }
  function safeHttpsUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      var u = new URL(value.trim());
      return u.protocol === "https:" ? u.toString() : null;
    } catch (e) {
      return null;
    }
  }

  function normalizeDoc(doc) {
    var fields = (doc && doc.fields) || {};
    var name = fieldStr(fields, "name").trim();
    var comment = fieldStr(fields, "comment").trim();
    // Same validity gate as the main site: a card needs a name + text.
    if (!name || !comment) return null;
    return {
      id: doc.name ? doc.name.split("/").pop() : "",
      uid: fieldStr(fields, "uid"),
      name: name,
      photo_url: safeHttpsUrl(fieldStr(fields, "photo_url")),
      rating: fieldRating(fields),
      comment: comment,
      source: fieldStr(fields, "source") || null,
      /* Spec §B2: only a valid enum value counts; anything else (incl.
         a missing field on legacy docs) renders the legacy badge. */
      sourceSite: validSourceSite(fieldStr(fields, "sourceSite")) ? fieldStr(fields, "sourceSite") : null,
      created_ms: fieldTime(fields, "created_at")
    };
  }

  function runQuery(ordered, limit, offset) {
    var q = {
      from: [{ collectionId: COLLECTION }],
      where: {
        fieldFilter: {
          field: { fieldPath: "status" },
          op: "EQUAL",
          value: { stringValue: "approved" }
        }
      },
      limit: limit
    };
    if (ordered) {
      q.orderBy = [{ field: { fieldPath: "created_at" }, direction: "DESCENDING" }];
      if (offset) q.offset = offset;
    }
    return fetch(
      "https://firestore.googleapis.com/v1/projects/" +
        FIREBASE_CONFIG.projectId +
        "/databases/(default)/documents:runQuery?key=" +
        encodeURIComponent(FIREBASE_CONFIG.apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredQuery: q })
      }
    ).then(function (res) {
      if (!res.ok) throw new Error("http-" + res.status);
      return res.json();
    });
  }

  /* First page: ordered query, falling back to unordered + client-side
     sort when the ordered query errors (e.g. the composite index is
     still missing — observed live as HTTP 400 — or quota/permission
     failure on the ordered attempt only). A page is PAGE_SIZE docs.
     hasMore is tentative when a page comes back exactly full: the next
     fetch returning fewer docs (or none) is what clears it — there is
     no silent cap and no invented total. */
  function fetchFirstPage() {
    return runQuery(true, PAGE_SIZE, 0)
      .then(function (rows) {
        var items = parseRows(rows);
        return { items: items, mode: "ordered", hasMore: items.length === PAGE_SIZE };
      })
      .catch(function () {
        // Mirror the main site: if the composite query fails (e.g. the
        // index is still building), retry unordered and sort client-side.
        return runQuery(false, PAGE_SIZE, 0).then(function (rows) {
          var items = parseRows(rows);
          items.sort(function (a, b) {
            return b.created_ms - a.created_ms;
          });
          return { items: items.slice(0, PAGE_SIZE), mode: "fallback", hasMore: items.length === PAGE_SIZE };
        });
      });
  }

  /* Later pages. Ordered mode pages with offset (no re-fetch). Fallback
     mode re-runs the unordered query with a growing limit and re-sorts,
     so paging never silently caps below the pool size. */
  function fetchNextPage() {
    if (state.mode === "fallback") {
      var want = state.reviews.length + PAGE_SIZE;
      return runQuery(false, want, 0).then(function (rows) {
        var items = parseRows(rows);
        items.sort(function (a, b) {
          return b.created_ms - a.created_ms;
        });
        var page = items.slice(state.reviews.length, want);
        return { items: page, hasMore: items.length === want && page.length > 0 };
      });
    }
    return runQuery(true, PAGE_SIZE, state.reviews.length).then(function (rows) {
      var items = parseRows(rows);
      return { items: items, hasMore: items.length === PAGE_SIZE };
    });
  }

  /* Dedicated aggregate read — the per-site ratings block must cover
     the FULL approved pool, never just the loaded card page (24).
     Ordered path: page through the ordered query with offset until
     a short page proves the pool is exhausted, up to AGGREGATE_CAP.
     If exactly AGGREGATE_CAP docs are collected, one extra 1-doc
     probe at that offset decides whether more docs exist (probe hit
     => capped; probe empty => the pool is exactly the cap, not
     capped). Any ordered failure => unordered fallback: a single
     limit-AGGREGATE_CAP query, client-sorted; reaching the cap there
     is reported as capped (conservative — an unordered query cannot
     probe beyond its limit). Same approved-only filter and same
     normalizeDoc validity gate as the cards, so the aggregates
     describe exactly the pool the cards draw from (invalid docs are
     excluded from both). Never invents attribution: docs with a
     missing/invalid sourceSite land only in the legacy bucket. */
  function fetchAggregatePool() {
    function loop(offset, acc) {
      if (acc.length >= AGGREGATE_CAP) {
        return runQuery(true, 1, AGGREGATE_CAP).then(function (rows) {
          return { items: acc.slice(0, AGGREGATE_CAP), capped: parseRows(rows).length > 0 };
        });
      }
      var want = Math.min(PAGE_SIZE, AGGREGATE_CAP - acc.length);
      return runQuery(true, want, offset).then(function (rows) {
        var items = parseRows(rows);
        var next = acc.concat(items);
        if (items.length < want) return { items: next, capped: false };
        return loop(offset + items.length, next);
      });
    }
    return loop(0, []).catch(function () {
      return runQuery(false, AGGREGATE_CAP, 0).then(function (rows) {
        var items = parseRows(rows);
        items.sort(function (a, b) {
          return b.created_ms - a.created_ms;
        });
        return { items: items, capped: items.length >= AGGREGATE_CAP };
      });
    });
  }

  function computeAggregates(items) {
    var perSite = {};
    SITE_ORDER.forEach(function (site) {
      perSite[site] = [];
    });
    var legacy = [];
    (items || []).forEach(function (r) {
      if (r.sourceSite && perSite[r.sourceSite]) perSite[r.sourceSite].push(r);
      else legacy.push(r);
    });
    return { perSite: perSite, legacy: legacy, total: items || [] };
  }

  function parseRows(rows) {
    var items = [];
    (rows || []).forEach(function (row) {
      if (!row || !row.document) return;
      var n = normalizeDoc(row.document);
      if (n) items.push(n);
    });
    return items;
  }

  /* Per-star share of the approved pool (same formula as the main
     site's reviewStarPercents): whole percents, 5★ → 1★. */
  function starPercents(reviews) {
    var total = reviews.length;
    return [5, 4, 3, 2, 1].map(function (star) {
      var count = reviews.filter(function (r) {
        return r.rating === star;
      }).length;
      return { star: star, count: count, percent: total > 0 ? Math.round((count / total) * 100) : 0 };
    });
  }

  /* ---------------------------- rendering ---------------------------- */

  var summaryEl = root.querySelector('[data-rb="summary"]');
  var breakdownEl = root.querySelector('[data-rb="breakdown"]');
  var listEl = root.querySelector('[data-rb="list"]');
  var formZone = root.querySelector('[data-rb="form-zone"]');
  var statusEl = root.querySelector('[data-rb="status"]');
  var writeBtn = root.querySelector('[data-rb="write"]');

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function renderSummary(reviews) {
    if (!summaryEl) return;
    if (state.kind === "loading") {
      summaryEl.innerHTML = "";
      summaryEl.appendChild(el("span", "rb-reviews-count", t().loading));
      if (breakdownEl) breakdownEl.style.display = "none";
      return;
    }
    if (state.kind === "error") {
      // The count is UNKNOWN on failure — never render a fake "0".
      summaryEl.innerHTML = "";
      if (breakdownEl) breakdownEl.style.display = "none";
      return;
    }
    var count = reviews.length;
    var avg = count > 0 ? reviews.reduce(function (s, r) { return s + r.rating; }, 0) / count : 0;
    summaryEl.innerHTML = "";
    if (count === 0) {
      /* Spec §B6: empty pool — no fake average and no "0 reviews"
         presented as a rating. The summary area stays in the DOM;
         the empty copy lives in the list area. */
      if (breakdownEl) breakdownEl.style.display = "none";
      return;
    }
    var stars = el("span");
    stars.innerHTML = starsRowHtml(avg, "rb-star");
    summaryEl.appendChild(stars);
    summaryEl.appendChild(el("strong", "rb-reviews-avg", (Math.round(avg * 10) / 10).toFixed(1)));
    summaryEl.appendChild(el("span", "rb-reviews-count", t().reviewsCount(count)));
    if (state.hasMore) {
      /* Spec §B3: a partial page must never read as a lifetime total. */
      summaryEl.appendChild(el("span", "rb-reviews-more-note", t().basedOnLatest(count)));
    }

    if (!breakdownEl) return;
    breakdownEl.innerHTML = "";
    if (count === 0) {
      breakdownEl.style.display = "none";
      return;
    }
    breakdownEl.style.display = "";
    breakdownEl.appendChild(el("span", "rb-breakdown-label", t().breakdown));
    starPercents(reviews).forEach(function (row) {
      var chip = el("span", "rb-breakdown-chip");
      chip.setAttribute("data-star-percent", String(row.star));
      chip.innerHTML = row.star + " " + starSvg("rb-star rb-star-sm") + " " + row.percent + "%";
      breakdownEl.appendChild(chip);
    });
  }

  function initialsFor(name) {
    var parts = String(name || "").split(" ").filter(Boolean).slice(0, 2);
    var s = parts
      .map(function (p) {
        return p.charAt(0).toUpperCase();
      })
      .join("");
    return s || "R";
  }

  function avatarNode(r) {
    if (r.photo_url) {
      var img = el("img", "rb-review-avatar");
      img.src = r.photo_url;
      img.alt = r.name;
      img.setAttribute("referrerpolicy", "no-referrer");
      img.loading = "lazy";
      img.addEventListener("error", function () {
        var fb = el("span", "rb-review-initials", initialsFor(r.name));
        if (img.parentNode) img.parentNode.replaceChild(fb, img);
      });
      return img;
    }
    return el("span", "rb-review-initials", initialsFor(r.name));
  }

  function reviewCard(r) {
    var card = el("article", "rb-review-card");
    var head = el("div", "rb-review-head");
    head.appendChild(avatarNode(r));
    var idCol = el("div", "rb-review-id");
    idCol.appendChild(el("strong", "rb-review-name", r.name.slice(0, 100)));
    var s = el("span");
    s.innerHTML = starsRowHtml(r.rating, "rb-star");
    idCol.appendChild(s);
    head.appendChild(idCol);
    card.appendChild(head);

    var expanded = false;
    var isLong = r.comment.length > TRUNCATE_LENGTH;
    var text = el("p", "rb-review-text", isLong ? r.comment.slice(0, TRUNCATE_LENGTH).trim() + "..." : r.comment);
    card.appendChild(text);
    if (isLong) {
      var more = el("button", "rb-see-more", t().seeMore);
      more.type = "button";
      more.addEventListener("click", function () {
        expanded = !expanded;
        text.textContent = expanded ? r.comment : r.comment.slice(0, TRUNCATE_LENGTH).trim() + "...";
        more.textContent = expanded ? t().seeLess : t().seeMore;
      });
      card.appendChild(more);
    }

    var meta = el("div", "rb-review-meta");
    // The verified chip renders only when the stored record itself
    // proves Google submission (source == "google") — as on Main.
    if (r.source === "google") {
      var pill = el("span", "rb-review-verified");
      pill.innerHTML = GOOGLE_G;
      pill.appendChild(document.createTextNode(t().verified));
      meta.appendChild(pill);
    }
    /* Spec §B2: source badge on EVERY card, in the meta row next to
       the verified chip and the date — never truncated, never hidden
       behind See more, never hover-only. Legacy docs (no sourceSite)
       get ONLY the truthful "not recorded" badge, never a guessed site. */
    meta.appendChild(el("span", "rb-review-source", sourceBadgeFor(r.sourceSite)));
    var date = fmtDate(r.created_ms);
    if (date) meta.appendChild(el("span", "rb-review-date", date));
    if (meta.childNodes.length) card.appendChild(meta);
    return card;
  }

  /* Carousel — mirrors the main website: cards in ONE horizontal line,
     one-card-at-a-time smooth slide, auto-advance 4s wrap-around,
     pause on hover/touch, arrows + dots when more than one page. */
  var carousel = { timer: null, index: 0, count: 0, paused: false, track: null, slides: [] };

  function visibleCount() {
    var w = window.innerWidth || 1024;
    if (w < 640) return 1;
    if (w < 1024) return 2;
    return 4;
  }
  function maxIndex() {
    return Math.max(0, carousel.count - visibleCount());
  }
  function layoutCarousel() {
    if (!carousel.track) return;
    var vis = visibleCount();
    var w = 100 / vis + "%";
    carousel.slides.forEach(function (s) {
      s.style.width = w;
    });
    if (carousel.index > maxIndex()) carousel.index = maxIndex();
    carousel.track.style.transform = "translateX(-" + carousel.index * (100 / vis) + "%)";
    var dots = listEl.querySelectorAll(".rb-dot");
    dots.forEach(function (d, i) {
      d.classList.toggle("on", i === carousel.index);
    });
  }
  function goToSlide(i) {
    var max = maxIndex();
    if (max <= 0) {
      carousel.index = 0;
      layoutCarousel();
      return;
    }
    carousel.index = ((i % (max + 1)) + (max + 1)) % (max + 1);
    layoutCarousel();
  }
  function stopCarousel() {
    if (carousel.timer) {
      clearInterval(carousel.timer);
      carousel.timer = null;
    }
  }
  function startCarousel() {
    stopCarousel();
    if (maxIndex() <= 0) return;
    carousel.timer = setInterval(function () {
      if (carousel.paused) return;
      goToSlide(carousel.index + 1);
    }, 4000);
  }

  var state = { kind: "loading", reviews: [], mode: "ordered", hasMore: false, loadingMore: false };

  /* Per-site ratings block state. Independent of the card pager:
     a failed aggregate fetch never wipes the cards, and a failed
     card load never fakes the ratings block. */
  var aggregates = { kind: "loading", data: null, capped: false };
  var aggregatesInFlight = false;

  function avgOf(list) {
    if (!list || !list.length) return 0;
    return list.reduce(function (s, r) { return s + r.rating; }, 0) / list.length;
  }

  function siteRatingRow(key, label, list, isThisSite, extraClass) {
    var row = el("div", "rb-site-rating-row" + (extraClass ? " " + extraClass : ""));
    row.setAttribute("data-site", key);
    row.appendChild(el("span", "rb-site-rating-name", label));
    if (isThisSite) row.appendChild(el("span", "rb-site-rating-this", t().thisWebsite));
    var val = el("span", "rb-site-rating-value");
    if (!list || !list.length) {
      /* Honest empty state: no average, no stars presented as a
         rating — the words alone. */
      val.appendChild(el("span", "rb-site-rating-empty", t().noReviewsYet));
      row.setAttribute("data-count", "0");
    } else {
      var avg = avgOf(list);
      var stars = el("span", "rb-site-rating-stars");
      stars.innerHTML = starsRowHtml(avg, "rb-star");
      val.appendChild(stars);
      val.appendChild(el("strong", "rb-site-rating-avg", avg.toFixed(1)));
      val.appendChild(el("span", "rb-site-rating-count", "(" + t().reviewsCount(list.length) + ")"));
      row.setAttribute("data-count", String(list.length));
      row.setAttribute("data-avg", avg.toFixed(1));
    }
    row.appendChild(val);
    return row;
  }

  function renderAggregates() {
    var block = root.querySelector('[data-rb="site-ratings"]');
    if (!block) return;
    block.innerHTML = "";
    block.appendChild(el("h3", "rb-site-ratings-title", t().siteRatingsHeading));
    if (aggregates.kind === "loading") {
      block.appendChild(el("p", "rb-site-ratings-note", t().ratingsLoading));
      return;
    }
    if (aggregates.kind === "error" || !aggregates.data) {
      /* Count is UNKNOWN on failure — never a fake zero row set. */
      block.appendChild(el("p", "rb-site-ratings-note", t().ratingsUnavailable));
      return;
    }
    var data = aggregates.data;
    SITE_ORDER.forEach(function (site) {
      block.appendChild(
        siteRatingRow(site, SITE_SHORT_NAMES[site], data.perSite[site], site === SITE, "")
      );
    });
    block.appendChild(siteRatingRow("legacy", t().legacyReviews, data.legacy, false, "rb-site-rating-legacy"));
    block.appendChild(siteRatingRow("all", t().allWebsites, data.total, false, "rb-site-rating-all"));
    if (aggregates.capped) {
      block.appendChild(el("p", "rb-site-ratings-note", t().aggregateCapped));
    }
  }

  function loadAggregates() {
    if (aggregatesInFlight || aggregates.kind === "ready") return;
    aggregatesInFlight = true;
    aggregates.kind = "loading";
    renderAggregates();
    fetchAggregatePool()
      .then(function (pool) {
        aggregates.data = computeAggregates(pool.items);
        aggregates.capped = !!pool.capped;
        aggregates.kind = "ready";
        aggregatesInFlight = false;
        renderAggregates();
      })
      .catch(function (err) {
        try {
          console.error("[rb-reviews] ratings load failed:", err && err.message ? err.message : err);
        } catch (e) {}
        aggregates.kind = "error";
        aggregatesInFlight = false;
        renderAggregates();
      });
  }

  function renderList() {
    if (!listEl) return;
    stopCarousel();
    carousel.track = null;
    carousel.slides = [];
    carousel.index = 0;
    carousel.count = 0;
    listEl.innerHTML = "";

    if (state.kind === "loading") {
      listEl.setAttribute("data-reviews-state", "loading");
      listEl.appendChild(el("p", "rb-review-note", t().loading));
      return;
    }
    if (state.kind === "error") {
      listEl.setAttribute("data-reviews-state", "error");
      listEl.appendChild(el("p", "rb-review-note rb-review-note-error", t().unavailable));
      /* Spec §B6: error state carries a Try again button that re-runs
         the load — never a silent blank section. */
      var retry = el("button", "btn sm", t().tryAgain);
      retry.type = "button";
      retry.addEventListener("click", function () {
        loadReviews();
      });
      var retryWrap = el("div", "rb-load-more");
      retryWrap.appendChild(retry);
      listEl.appendChild(retryWrap);
      return;
    }
    if (!state.reviews.length) {
      listEl.setAttribute("data-reviews-state", "empty");
      listEl.appendChild(el("p", "rb-review-note", t().empty));
      if (t().emptySub) listEl.appendChild(el("p", "rb-review-sub", t().emptySub));
      return;
    }
    listEl.setAttribute("data-reviews-state", "ready");
    carousel.count = state.reviews.length;
    var wrap = el("div", "rb-carousel");
    var viewport = el("div", "rb-carousel-viewport");
    var track = el("div", "rb-carousel-track");
    state.reviews.forEach(function (r) {
      var slide = el("div", "rb-carousel-slide");
      slide.appendChild(reviewCard(r));
      track.appendChild(slide);
      carousel.slides.push(slide);
    });
    viewport.appendChild(track);
    wrap.appendChild(viewport);
    carousel.track = track;

    if (maxIndex() > 0) {
      var prev = el("button", "rb-carousel-btn rb-carousel-prev", "");
      prev.type = "button";
      prev.setAttribute("aria-label", t().prev);
      prev.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7"/></svg>';
      prev.addEventListener("click", function () {
        goToSlide(carousel.index - 1);
      });
      var next = el("button", "rb-carousel-btn rb-carousel-next", "");
      next.type = "button";
      next.setAttribute("aria-label", t().next);
      next.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
      next.addEventListener("click", function () {
        goToSlide(carousel.index + 1);
      });
      wrap.appendChild(prev);
      wrap.appendChild(next);
    }
    listEl.appendChild(wrap);

    var pages = maxIndex() + 1;
    if (pages > 1) {
      var dots = el("div", "rb-carousel-dots");
      var shown = Math.min(5, pages);
      for (var i = 0; i < shown; i++) {
        (function (idx) {
          var d = el("button", "rb-dot", "");
          d.type = "button";
          d.setAttribute("aria-label", "Go to slide " + (idx + 1));
          d.addEventListener("click", function () {
            goToSlide(idx);
          });
          dots.appendChild(d);
        })(i);
      }
      listEl.appendChild(dots);
    }

    /* Spec §B3 pagination: Load more appends the next 24; it is
       removed (not disabled-forever) once a fetch proves there are
       no more. While a page loads the button is disabled. */
    if (state.hasMore) {
      var moreWrap = el("div", "rb-load-more");
      var moreBtn = el("button", "btn sm", state.loadingMore ? t().loading : t().loadMore);
      moreBtn.type = "button";
      moreBtn.disabled = state.loadingMore;
      moreBtn.addEventListener("click", function () {
        loadMore();
      });
      moreWrap.appendChild(moreBtn);
      listEl.appendChild(moreWrap);
    }

    wrap.addEventListener("mouseenter", function () {
      carousel.paused = true;
    });
    wrap.addEventListener("mouseleave", function () {
      carousel.paused = false;
    });
    wrap.addEventListener(
      "touchstart",
      function () {
        carousel.paused = true;
      },
      { passive: true }
    );
    wrap.addEventListener(
      "touchend",
      function () {
        carousel.paused = false;
      },
      { passive: true }
    );

    layoutCarousel();
    startCarousel();
  }

  function renderAll() {
    renderSummary(state.reviews);
    renderAggregates();
    renderList();
  }

  function loadReviews() {
    state.kind = "loading";
    state.reviews = [];
    state.hasMore = false;
    state.loadingMore = false;
    state.mode = "ordered";
    /* Ratings block loads (or reloads after a failure) alongside
       the cards; a ready block is not re-fetched on Try again. */
    loadAggregates();
    renderAll();
    fetchFirstPage()
      .then(function (page) {
        state.reviews = page.items;
        state.mode = page.mode;
        state.hasMore = page.hasMore;
        state.kind = "ready";
        renderAll();
      })
      .catch(function (err) {
        try {
          console.error("[rb-reviews] load failed:", err && err.message ? err.message : err);
        } catch (e) {}
        state.reviews = [];
        state.hasMore = false;
        state.kind = "error";
        renderAll();
      });
  }

  /* Append the next page without losing the reviews already shown. A
     page-load failure keeps the current list and reports the failure
     in the status line, with the Load more button left enabled to
     retry — it never wipes the list into the error state. */
  function loadMore() {
    if (state.loadingMore || !state.hasMore) return;
    state.loadingMore = true;
    var keepIndex = carousel.index;
    renderList();
    fetchNextPage()
      .then(function (page) {
        state.reviews = state.reviews.concat(page.items);
        state.hasMore = page.hasMore;
        state.loadingMore = false;
        state.kind = "ready";
        renderAll();
        if (keepIndex) goToSlide(keepIndex);
      })
      .catch(function (err) {
        try {
          console.error("[rb-reviews] load-more failed:", err && err.message ? err.message : err);
        } catch (e) {}
        state.loadingMore = false;
        setStatus(t().unavailable);
        renderList();
      });
  }

  window.addEventListener("resize", function () {
    layoutCarousel();
  });

  /* ------------------------- write-a-review ------------------------- */
  /* Firebase Auth + Firestore load lazily, only when a visitor actually
     opens the review form (same approach as the Tools site) — readers
     never pay the SDK cost. The write is the main website's
     submitReview() shape PLUS the spec's sourceSite field (§B1); until
     the owner's final rules deploy (§B7) that extra key is rejected
     by the current hasOnly list — see the header comment. */

  var sdkPromise = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("sdk"));
      };
      document.head.appendChild(s);
    });
  }

  function ensureFirebase() {
    if (window.firebase && window.firebase.auth && window.firebase.firestore) {
      return Promise.resolve(window.firebase);
    }
    if (sdkPromise) return sdkPromise;
    sdkPromise = (async function () {
      if (!window.firebase || !window.firebase.app) {
        await loadScript("https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-app-compat.js");
      }
      if (!window.firebase.auth) {
        await loadScript("https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-auth-compat.js");
      }
      if (!window.firebase.firestore) {
        await loadScript("https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-firestore-compat.js");
      }
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(FIREBASE_CONFIG);
      }
      return window.firebase;
    })();
    // A failed SDK load must not poison every later attempt.
    sdkPromise.catch(function () {
      sdkPromise = null;
    });
    return sdkPromise;
  }

  var authState = { user: null, ready: false, ownStatus: null, ownRating: 0, ownComment: "" };

  function friendlyError(err) {
    var code = (err && err.code) || "";
    var msg = (err && err.message) || "";
    try {
      console.error("[rb-reviews]", code || "(no code)", msg);
    } catch (e) {}
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return t().signInFail;
    return t().submitFail;
  }

  /* Spec §B4: a review identity is Google ONLY. The sign-in UI offers
     Google alone, but the check is enforced anyway — a non-Google
     provider (or a missing provider list) never reaches a submit. */
  function isGoogleUser(user) {
    if (!user || !user.providerData) return false;
    for (var i = 0; i < user.providerData.length; i++) {
      if (user.providerData[i] && user.providerData[i].providerId === "google.com") return true;
    }
    return false;
  }

  function renderSignIn() {
    formZone.innerHTML = "";
    var box = el("div", "rb-review-signin");
    box.appendChild(el("p", "", t().signInBody));
    var btn = el("button", "btn sm", t().signInWithGoogle);
    btn.type = "button";
    btn.addEventListener("click", function () {
      btn.disabled = true;
      setStatus("");
      ensureFirebase()
        .then(function (fb) {
          var provider = new fb.auth.GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          /* Spec §B4 (static sites): popup first; on popup-blocked /
             popup-closed-by-user (incl. mobile browsers where the
             popup cannot open) fall back to redirect. The redirect
             needs the OAuth client's redirect URI
             https://it.ridebangla.bd/__/auth/handler (spec §B9 #4). */
          return fb
            .auth()
            .signInWithPopup(provider)
            .catch(function (err) {
              if (err && (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user")) {
                return fb.auth().signInWithRedirect(provider);
              }
              throw err;
            });
        })
        .then(function () {
          /* onAuthStateChanged re-renders the form */
        })
        .catch(function (err) {
          btn.disabled = false;
          setStatus(t().signInFail);
          try {
            console.error("[rb-reviews] sign-in failed:", (err && err.code) || err);
          } catch (e) {}
        });
    });
    box.appendChild(btn);
    formZone.appendChild(box);
  }

  function loadOwnReview(fb, user) {
    return fb
      .firestore()
      .collection(COLLECTION)
      .doc(user.uid)
      .get()
      .then(function (snap) {
        if (snap.exists) {
          var d = snap.data() || {};
          authState.ownStatus = typeof d.status === "string" ? d.status : null;
          authState.ownRating = typeof d.rating === "number" ? d.rating : 0;
          authState.ownComment = typeof d.comment === "string" ? d.comment : "";
        } else {
          authState.ownStatus = null;
          authState.ownRating = 0;
          authState.ownComment = "";
        }
      })
      .catch(function () {
        authState.ownStatus = null;
      });
  }

  function renderForm() {
    var user = authState.user;
    formZone.innerHTML = "";
    var box = el("div", "rb-review-form");

    var head = el("div", "rb-form-head");
    var idCol = el("div", "rb-form-id");
    idCol.appendChild(el("strong", "", (user.displayName || "You").slice(0, 100)));
    idCol.appendChild(el("span", "rb-form-sub", t().signedInWith));
    head.appendChild(idCol);
    var out = el("button", "rb-signout", t().signOut);
    out.type = "button";
    out.addEventListener("click", function () {
      ensureFirebase().then(function (fb) {
        fb.auth().signOut();
      });
    });
    head.appendChild(out);
    box.appendChild(head);

    if (authState.ownStatus === "approved") {
      box.appendChild(el("p", "rb-form-note", t().reviewPublished));
      formZone.appendChild(box);
      return;
    }
    if (authState.ownStatus === "pending") {
      box.appendChild(el("p", "rb-form-note", t().reviewPending));
    }

    var rating = authState.ownRating || 0;
    box.appendChild(el("p", "rb-form-label", t().yourRating));
    var pick = el("div", "rb-review-pick");
    var starBtns = [];
    for (var i = 1; i <= 5; i++) {
      (function (v) {
        var b = el("button", "rb-pick-star" + (v <= rating ? " on" : ""), "");
        b.type = "button";
        b.setAttribute("aria-label", v + " " + (v > 1 ? t().stars : t().star));
        b.innerHTML = starSvg("rb-star");
        b.addEventListener("click", function () {
          rating = v;
          starBtns.forEach(function (x, idx) {
            x.classList.toggle("on", idx < v);
          });
        });
        starBtns.push(b);
        pick.appendChild(b);
      })(i);
    }
    box.appendChild(pick);

    var area = el("textarea", "rb-review-input rb-review-textarea");
    area.placeholder = t().reviewPlaceholder;
    area.maxLength = 600;
    area.rows = 3;
    area.value = authState.ownComment || "";
    box.appendChild(area);

    var submit = el("button", "btn sm", t().postReview);
    submit.type = "button";
    submit.addEventListener("click", function () {
      var comment = area.value.trim();
      if (rating < 1 || rating > 5 || comment.length < 2) {
        setStatus(t().submitFail);
        return;
      }
      /* Spec §B4: never submit without a proven Google identity. */
      if (!isGoogleUser(user)) {
        setStatus(t().signInFail);
        return;
      }
      submit.disabled = true;
      setStatus("");
      ensureFirebase()
        .then(function (fb) {
          var db = fb.firestore();
          var ref = db.collection(COLLECTION).doc(user.uid);
          return ref.get().then(function (existing) {
            if (existing.exists && existing.data().status === "approved") {
              throw new Error("already-approved");
            }
            var FieldValue = fb.firestore.FieldValue;
            var payload = {
              uid: user.uid,
              name: (user.displayName || "").trim(),
              photo_url: user.photoURL || null,
              rating: Math.round(rating),
              comment: comment,
              status: "pending",
              source: "google",
              created_at: existing.exists ? existing.data().created_at : FieldValue.serverTimestamp(),
              updated_at: FieldValue.serverTimestamp()
            };
            /* Spec §B2/§B7 — sourceSite, set at CREATE, immutable after:
               a brand-new review gets this site's constant ("it"); an
               edit preserves the stored value verbatim; a legacy doc
               without sourceSite NEVER gains one through this client
               path (Admin-SDK backfill only, §B8) — so it is omitted
               here, not guessed. */
            if (!existing.exists) {
              payload.sourceSite = SITE;
            } else if (existing.data() && validSourceSite(existing.data().sourceSite)) {
              payload.sourceSite = existing.data().sourceSite;
            }
            return ref.set(payload, { merge: false });
          });
        })
        .then(function () {
          authState.ownStatus = "pending";
          setStatus(t().thankYou);
          renderForm();
        })
        .catch(function (err) {
          submit.disabled = false;
          if (err && err.message === "already-approved") {
            authState.ownStatus = "approved";
            renderForm();
            return;
          }
          setStatus(friendlyError(err));
        });
    });
    box.appendChild(submit);
    formZone.appendChild(box);
  }

  var formOpen = false;
  var authListenerBound = false;
  function renderWriteZone() {
    if (!formOpen) {
      formZone.innerHTML = "";
      return;
    }
    if (!authState.ready) {
      formZone.innerHTML = "";
      formZone.appendChild(el("p", "rb-review-note", t().loading));
      return;
    }
    if (authState.user) renderForm();
    else renderSignIn();
  }

  if (writeBtn) {
    writeBtn.addEventListener("click", function () {
      formOpen = !formOpen;
      writeBtn.textContent = formOpen ? t().closeReview : t().writeReview;
      if (formOpen && !authListenerBound) {
        authListenerBound = true;
        ensureFirebase()
          .then(function (fb) {
            /* Consume a redirect sign-in result (spec §B4 fallback);
               errors here are surfaced by the auth listener below. */
            try {
              if (fb.auth().getRedirectResult) fb.auth().getRedirectResult().catch(function () {});
            } catch (e) {}
            fb.auth().onAuthStateChanged(function (user) {
              /* Spec §B4: a signed-in user who does not prove Google
                 is treated as NOT signed in for reviews (and signed
                 out of the reviews session) — never shown the form. */
              if (user && !isGoogleUser(user)) {
                try {
                  fb.auth().signOut();
                } catch (e) {}
                user = null;
              }
              var wasUid = authState.user && authState.user.uid;
              authState.user = user;
              authState.ready = true;
              if (user && user.uid !== wasUid) {
                loadOwnReview(fb, user).then(renderWriteZone);
              } else {
                renderWriteZone();
              }
            });
          })
          .catch(function () {
            authListenerBound = false;
            authState.ready = true;
            renderWriteZone();
          });
      }
      renderWriteZone();
    });
  }

  /* Language toggle: the page's own handler runs first (registered
     earlier); localStorage already holds the new language here —
     same re-render hook as it-updates.js. */
  var langBtn = document.getElementById("lang");
  if (langBtn) {
    langBtn.addEventListener("click", function () {
      if (writeBtn) writeBtn.textContent = formOpen ? t().closeReview : t().writeReview;
      renderAll();
      renderWriteZone();
    });
  }

  loadReviews();
})();
