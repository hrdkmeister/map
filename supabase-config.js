window.MEISTER_SUPABASE_CONFIG = Object.freeze({
  supabaseUrl: "https://ikouzufqmsgjpungfnbi.supabase.co",
  supabaseAnonKey: "sb_publishable_uwmJ6TovhD7fV7lKvIedBA_I8Yf5oH4"
});

// 지도 메인 화면에서만 AI 검색 애드온을 지연 로드한다.
(function () {
  function loadAiSearchAddon() {
    if (!document.getElementById("map") || !document.getElementById("searchInput")) {
      return;
    }
    if (document.querySelector('script[data-meister-ai-search]')) {
      return;
    }

    const script = document.createElement("script");
    script.src = "ai-search.js?v=20261113";
    script.defer = true;
    script.dataset.meisterAiSearch = "true";
    document.body.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAiSearchAddon, { once: true });
  } else {
    loadAiSearchAddon();
  }
})();
