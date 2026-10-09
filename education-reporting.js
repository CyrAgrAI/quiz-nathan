/* Results are attributed only through a personalized link issued by Education. */
(() => {
  "use strict";
  const api = "https://intelos-01.tailb936aa.ts.net/education";
  const fragment = new URLSearchParams(location.hash.slice(1));
  const pageKey = "education.link." + location.pathname;
  let launch = fragment.get("education_launch");
  try {
    if (launch) sessionStorage.setItem(pageKey, launch);
    else launch = sessionStorage.getItem(pageKey);
  } catch (_) {}
  // shortcut: browser links remain bearer credentials for seven days; add sign-in if links are shared.
  if (!launch || !/^[A-Za-z0-9_-]{43}$/.test(launch)) {
    window.EducationReporting = {start() {}, complete() {}};
    return;
  }
  history.replaceState(null, "", location.pathname + location.search);
  let current = null;
  const pendingKey = "education.pending." + launch;
  function status(text) {
    let node = document.getElementById("education-status");
    if (!node) {
      node = document.createElement("p");
      node.id = "education-status";
      node.setAttribute("role", "status");
      (document.getElementById("result-card") || document.querySelector("main") || document.body).append(node);
    }
    node.textContent = text;
  }
  async function post(path, data) {
    for (let retry = 0; retry < 3; retry++) {
      try {
        const response = await fetch(api + path, {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify(data), signal: AbortSignal.timeout(10000), keepalive: true
        });
        if (!response.ok) throw new Error("Enregistrement indisponible");
        return await response.json();
      } catch (error) {
        if (retry === 2) throw error;
      }
    }
  }
  async function transmit(data) {
    const result = await post("/api/result", data);
    sessionStorage.removeItem(pendingKey);
    status("✅ Note enregistrée dans Education : " + result.grade20 + "/20 (tentative " + result.version + ").");
  }
  try {
    const pending = sessionStorage.getItem(pendingKey);
    if (pending) transmit(JSON.parse(pending)).catch(() => status("⚠️ Note en attente d’enregistrement. Rouvre ce lien pour réessayer."));
  } catch (_) { /* Private mode can disable browser storage. */ }
  window.EducationReporting = {
    start(variant = "") {
      const previous = current;
      const attempt = {finished: false};
      current = attempt;
      const data = {launch_token: launch, url: location.href, request_key: crypto.randomUUID(), variant};
      attempt.ready = (previous ? previous.ready.catch(() => {}) : Promise.resolve()).then(() => post("/api/start", data));
      attempt.ready.catch(() => status("⚠️ Liaison Education indisponible. Rouvre ton activité depuis le bot."));
    },
    complete(score, total) {
      const attempt = current;
      if (!attempt || attempt.finished) return;
      attempt.finished = true;
      status("Enregistrement de la note dans Education…");
      attempt.ready.then(({attempt_token}) => {
        const data = {attempt_token, score, total};
        try { sessionStorage.setItem(pendingKey, JSON.stringify(data)); } catch (_) {}
        return transmit(data);
      }).catch(() => status("⚠️ Note non enregistrée dans Education. Rouvre ce lien pour réessayer."));
    }
  };
  document.addEventListener("click", event => {
    const anchor = event.target.closest?.("a[href]");
    if (!anchor) return;
    const target = new URL(anchor.href, location.href);
    if (target.origin === location.origin && target.pathname.startsWith("/quiz-nathan/eleves/")) {
      target.hash = "education_launch=" + launch;
      anchor.href = target.href;
    }
  });
  window.addEventListener("pagehide", () => {
    const attempt = current;
    if (!attempt || attempt.finished) return;
    // shortcut: closing a browser is best effort; next activity also closes the previous attempt.
    attempt.ready.then(({attempt_token}) => navigator.sendBeacon(api + "/api/interrupt",
      new Blob([JSON.stringify({attempt_token})], {type: "text/plain"}))).catch(() => {});
  });
})();
