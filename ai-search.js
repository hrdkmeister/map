// 대한민국명장 지도 - 생성형 AI 검색 애드온
// 기존 script.js를 수정하지 않고, 검색 함수만 확장한다.
(function () {
  "use strict";

  // 지도 메인 화면에서만 동작
  if (!document.getElementById("map") || !document.getElementById("searchInput")) {
    return;
  }

  if (typeof searchRows !== "function" ||
      typeof applyFilters !== "function" ||
      typeof rowMatchesKeyword !== "function") {
    console.warn("AI 검색 애드온: 기존 검색 함수가 준비되지 않았습니다.");
    return;
  }

  const originalSearchRows = searchRows;
  let aiIntent = null;
  let aiEffectiveKeyword = "";

  function cleanText(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function cleanAiKeywords(intent) {
    const source = Array.isArray(intent?.keywords) ? intent.keywords : [];
    const region = cleanText(intent?.region);
    const job = cleanText(intent?.job_group);

    const genericByJob = {
      bakery: new Set(["빵집", "베이커리", "제과", "제빵", "빵가게"]),
      cooking: new Set(["식당", "음식점", "요리", "한식집", "한식당"]),
      car: new Set(["자동차정비", "자동차 정비", "정비소"])
    };

    const generic = genericByJob[job] || new Set();
    const result = [];

    source.forEach(value => {
      const text = cleanText(value);
      if (!text || text === region || generic.has(text)) return;
      if (!result.includes(text)) result.push(text);
    });

    return result.slice(0, 5);
  }

  function rowMatchesAiIntent(row) {
    if (!aiIntent) return true;

    const region = cleanText(aiIntent.region);
    if (region) {
      const address = getField(row, ["주소", "사업장 주소"]);
      if (getRegionLabel(address) !== region) return false;
    }

    const jobGroup = cleanText(aiIntent.job_group);
    if (jobGroup && jobGroup !== "any") {
      const job = cleanText(row["직종"]);
      if (getJobType(job) !== jobGroup) return false;
    }

    return true;
  }

  // 기존 applyFilters를 AI 조건까지 반영하도록 확장.
  // aiIntent가 null이면 기존 검색과 동일하게 동작한다.
  applyFilters = function () {
    const input = document.getElementById("searchInput");
    const keyword = aiIntent
      ? aiEffectiveKeyword.toLowerCase()
      : cleanText(input?.value).toLowerCase();

    currentRows = allRows.filter(row => {
      return rowMatchesKeyword(row, keyword) &&
        rowMatchesJobFilter(row) &&
        rowMatchesRegionFilter(row) &&
        rowMatchesAiIntent(row);
    });

    if (sortByDistance && userCoords) {
      currentRows = currentRows.slice().sort((a, b) => {
        const distanceA = getRowDistanceKm(a);
        const distanceB = getRowDistanceKm(b);

        if (distanceA === null) return 1;
        if (distanceB === null) return -1;
        return distanceA - distanceB;
      });
    }

    showMarkers(currentRows);
    updateLegendStyle();
  };

  async function requestAiIntent(keyword) {
    const config = window.MEISTER_SUPABASE_CONFIG ||
                   window.MEISTER_ANALYTICS_CONFIG || {};
    const supabaseUrl = cleanText(config.supabaseUrl).replace(/\/$/, "");
    const publishableKey = cleanText(config.supabaseAnonKey);

    if (!supabaseUrl || !publishableKey) {
      throw new Error("AI_SEARCH_CONFIG_MISSING");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/meister-ai-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": publishableKey
          },
          body: JSON.stringify({ query: keyword.slice(0, 150) }),
          signal: controller.signal
        }
      );

      let data = null;
      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }

      if (!response.ok || !data || data.ok !== true || !data.intent) {
        const code = data?.code || `HTTP_${response.status}`;
        throw new Error(code);
      }

      const intent = data.intent;
      intent.keywords = cleanAiKeywords(intent);
      return intent;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function intentLabel(intent) {
    if (!intent) return "";

    const parts = [];
    if (intent.nearby) parts.push("내 주변");
    if (intent.region) parts.push(intent.region);

    const jobLabels = {
      bakery: "제과·제빵",
      cooking: "요리",
      car: "자동차정비"
    };

    if (jobLabels[intent.job_group]) parts.push(jobLabels[intent.job_group]);

    (intent.keywords || []).forEach(value => {
      const text = cleanText(value);
      if (text && !parts.includes(text)) parts.push(text);
    });

    return parts.join(" · ");
  }

  function clearAiState() {
    aiIntent = null;
    aiEffectiveKeyword = "";
  }

  // 기존 버튼의 화살표 리스너가 searchRows()를 호출하므로
  // 이 전역 함수만 교체하면 기존 UI를 그대로 사용할 수 있다.
  searchRows = async function () {
    const input = document.getElementById("searchInput");
    const keyword = cleanText(input?.value);
    clearAiState();

    if (!keyword) {
      return originalSearchRows();
    }

    setSearchModeStatus("✨ AI가 검색 의도를 분석하는 중입니다…", "loading");

    try {
      aiIntent = await requestAiIntent(keyword);
      aiEffectiveKeyword = (aiIntent.keywords || []).join(" ").trim();

      // AI가 아무 검색조건도 추출하지 못했으면 기존 검색이 더 안전하다.
      if (!aiEffectiveKeyword &&
          !aiIntent.region &&
          (!aiIntent.job_group || aiIntent.job_group === "any") &&
          !aiIntent.nearby) {
        throw new Error("AI_EMPTY_INTENT");
      }
    } catch (error) {
      clearAiState();
      console.info(
        "AI 검색을 사용할 수 없어 기존 자연어 검색으로 전환:",
        error?.message || error
      );
      return originalSearchRows();
    }

    const nearbyIntent = Boolean(aiIntent.nearby);
    trackEvent("search_execute", "ai");

    if (nearbyIntent) {
      const nearbyButton = document.getElementById("nearbyButton");
      const label = intentLabel(aiIntent) || "전체 사업장";

      setSearchModeStatus("📍 현재 위치를 확인하는 중입니다…", "loading");

      if (nearbyButton) {
        nearbyButton.disabled = true;
        nearbyButton.textContent = "위치 확인 중...";
      }

      try {
        const position = await getCurrentPosition();
        const { latitude, longitude, accuracy } = position.coords;

        userCoords = { lat: latitude, lng: longitude };
        sortByDistance = true;
        showUserLocationOnMap(latitude, longitude, accuracy);

        if (nearbyButton) nearbyButton.classList.add("active");

        applyFilters();
        scrollMapIntoViewOnMobile();

        setSearchModeStatus(
          `✨ AI 검색 · 현재 위치 기준 · ${label} · 가까운 순 · ${currentRows.length}개`,
          "location"
        );
      } catch (error) {
        console.error("AI 주변검색 위치 확인 실패:", error);
        setSearchModeStatus(
          "위치정보를 사용할 수 없습니다. 브라우저의 위치 권한을 허용한 뒤 다시 검색해 주세요.",
          "loading"
        );
        if (nearbyButton) nearbyButton.classList.remove("active");
        return;
      } finally {
        if (nearbyButton) {
          nearbyButton.disabled = false;
          nearbyButton.textContent = "📍 내 주변 찾기";
        }
      }
    } else {
      sortByDistance = false;
      applyFilters();

      setSearchModeStatus(
        `✨ AI 검색 · ${intentLabel(aiIntent) || keyword} · ${currentRows.length}개`,
        "ai"
      );
    }

    trackEvent(
      "search_result",
      currentRows.length > 0 ? "has_result" : "no_result"
    );

    recordSearchQuery(keyword, currentRows.length);
  };

  // 기존 초기화 처리 전에 AI 검색 상태도 같이 비운다.
  const resetButton = document.getElementById("resetButton");
  if (resetButton) {
    resetButton.addEventListener("click", clearAiState, true);
  }

  console.info("대한민국명장 지도: 생성형 AI 검색 애드온 준비 완료");
})();
