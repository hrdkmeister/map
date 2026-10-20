const map = L.map("map").setView([36.5, 127.8], 7);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

function showUserLocationOnMap(lat, lng, accuracy) {
  const latlng = [lat, lng];

  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
  }

  if (userAccuracyCircle) {
    map.removeLayer(userAccuracyCircle);
  }

  userAccuracyCircle = L.circle(latlng, {
    radius: accuracy || 30,
    color: "#245b92",
    weight: 1,
    fillColor: "#245b92",
    fillOpacity: 0.12
  }).addTo(map);

  userLocationMarker = L.marker(latlng, {
    icon: L.divIcon({
      className: "user-location-marker",
      html: `<div class="user-location-dot"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    }),
    zIndexOffset: 1000
  })
    .addTo(map)
    .bindPopup("현재 위치입니다.");
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("이 브라우저는 위치 정보 기능을 지원하지 않습니다."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000
    });
  });
}

function locateUser() {
  getCurrentPosition()
    .then(position => {
      const { latitude, longitude, accuracy } = position.coords;

      showUserLocationOnMap(latitude, longitude, accuracy);
      map.setView([latitude, longitude], 15, { animate: true });
    })
    .catch(error => {
      console.error("위치 정보 가져오기 실패:", error);
      alert("현재 위치를 가져올 수 없습니다. 브라우저의 위치 권한을 확인해주세요.");
    });
}

const LocateControl = L.Control.extend({
  options: {
    position: "topleft"
  },

  onAdd: function() {
    const container = L.DomUtil.create("div", "locate-control leaflet-bar");
    const button = L.DomUtil.create("button", "", container);

    button.type = "button";
    button.title = "현위치로 이동";
    button.innerHTML = "📍";

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(button, "click", locateUser);

    return container;
  }
});

map.addControl(new LocateControl());

function setupMobileMapGuard() {
  const overlay = document.getElementById("mapTapOverlay");

  if (!overlay) {
    return;
  }

  const isMobile = window.matchMedia("(max-width: 900px)").matches;

  if (!isMobile) {
    return;
  }

  map.dragging.disable();
  map.touchZoom.disable();
  overlay.classList.add("mobile-active");

  const enableMapInteraction = () => {
    map.dragging.enable();
    map.touchZoom.enable();
    overlay.classList.remove("mobile-active");
    overlay.style.display = "none";
  };

  overlay.addEventListener("click", enableMapInteraction, { once: true });
}

setupMobileMapGuard();

function setupDesktopWheelZoomGuard() {
  const isMobile = window.matchMedia("(max-width: 900px)").matches;

  if (isMobile) {
    return;
  }

  map.scrollWheelZoom.disable();

  const mapContainer = map.getContainer();
  const hintOverlay = document.getElementById("mapWheelHint");
  let hintTimeoutId = null;

  mapContainer.addEventListener(
    "wheel",
    event => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();

        const zoomDelta = event.deltaY < 0 ? 1 : -1;

        map.setZoom(map.getZoom() + zoomDelta, { animate: true });

        if (hintOverlay) {
          hintOverlay.classList.remove("visible");
        }

        return;
      }

      if (hintOverlay) {
        hintOverlay.classList.add("visible");

        if (hintTimeoutId) {
          clearTimeout(hintTimeoutId);
        }

        hintTimeoutId = setTimeout(() => {
          hintOverlay.classList.remove("visible");
        }, 1200);
      }
    },
    { passive: false }
  );
}

function setupNoticeModal() {
  const STORAGE_KEY = "meisterMapNoticeDismissedDate";
  const modal = document.getElementById("noticeModal");

  if (!modal) {
    return;
  }

  const closeButton = document.getElementById("noticeCloseButton");
  const dontShowCheckbox = document.getElementById("noticeDontShowToday");
  const reopenLink = document.getElementById("noticeReopenLink");

  function todayString() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  function showModal() {
    modal.classList.add("visible");
  }

  function hideModal() {
    modal.classList.remove("visible");
  }

  let dismissedDate = null;

  try {
    dismissedDate = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    dismissedDate = null;
  }

  if (dismissedDate !== todayString()) {
    showModal();
  }

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      if (dontShowCheckbox && dontShowCheckbox.checked) {
        try {
          localStorage.setItem(STORAGE_KEY, todayString());
        } catch (e) {
          console.warn("안내 팝업 상태 저장 실패:", e);
        }
      }

      trackEvent(
        "notice_close",
        dontShowCheckbox && dontShowCheckbox.checked ? "dismiss_today" : "close"
      );
      hideModal();
    });
  }

  if (reopenLink) {
    reopenLink.addEventListener("click", event => {
      event.preventDefault();
      if (dontShowCheckbox) {
        dontShowCheckbox.checked = false;
      }
      showModal();
    });
  }
}

setupNoticeModal();

setupDesktopWheelZoomGuard();

// 브라우저 자체의 Ctrl(⌘)+휠 페이지 확대/축소를 막는 전역 안전장치.
// 지도 위가 아니라도, 스크롤 중 커서가 살짝 벗어나거나
// 트랙패드/브라우저에 따라 페이지 전체가 확대되며
// 사이드바 크기까지 같이 바뀌는 것을 방지한다.
window.addEventListener(
  "wheel",
  event => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  },
  { passive: false }
);

let allRows = [];
let currentRows = [];
let markers = [];
let markerByIndex = {};
let markerJobByIndex = {};
let markerCategoryByIndex = {};
let selectedIndex = null;

// 현위치 표시용
let userLocationMarker = null;
let userAccuracyCircle = null;

// 거리순 정렬용
let userCoords = null;
let sortByDistance = false;

// 현재 선택된 직종 필터
// ""이면 전체 보기
// "bakery"이면 제과·제빵
// "cooking"이면 요리
// "car"이면 자동차정비
let activeJobFilter = "";

// 현재 선택된 지역 필터
// ""이면 전체 지역
let activeRegionFilter = "";

function getText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}


function escapeHtml(value) {
  return getText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSafeNaverUrl(value, fallbackQuery = "") {
  const fallback =
    `https://map.naver.com/p/search/${encodeURIComponent(getText(fallbackQuery))}`;

  const raw = getText(value);

  if (!raw) {
    return fallback;
  }

  try {
    const url = new URL(raw);

    if (url.protocol !== "https:") {
      return fallback;
    }

    const allowedHosts = new Set([
      "naver.me",
      "map.naver.com",
      "m.map.naver.com",
      "place.naver.com",
      "m.place.naver.com"
    ]);

    return allowedHosts.has(url.hostname.toLowerCase())
      ? url.href
      : fallback;
  } catch {
    return fallback;
  }
}

function getField(row, names) {
  for (const name of names) {
    const value = getText(row[name]);

    if (value !== "") {
      return value;
    }
  }

  return "";
}


function getRepresentativeMenusForSearch(row) {
  const value = row ? row["대표메뉴검색용"] : "";

  if (Array.isArray(value)) {
    return value.map(getText).filter(Boolean).join(" ");
  }

  return getText(value);
}

// 자연어 검색에서 의미 없는 표현을 제거한다.
// 예: "인천 갈비집 알려줘" -> ["인천", "갈비집"]
const SEARCH_STOPWORDS = new Set([
  "알려줘", "알려주세요", "찾아줘", "찾아주세요", "검색해줘", "검색해주세요",
  "보여줘", "보여주세요", "추천해줘", "추천해주세요",
  "있는", "있는데", "있어", "있나요", "어디", "어디야", "어디에",
  "파는", "판매하는", "하는", "곳", "장소",
  "대한민국명장", "명장", "사업장", "가게", "매장",
  // 위치 기반 자연어 검색용 표현
  "내", "내주변", "주변", "주변에", "근처", "근처에",
  "가까운", "가까이", "인근", "인근에"
]);

const SEARCH_SYNONYMS = {
  "빵집": ["빵집", "빵", "제과", "제빵", "베이커리"],
  "베이커리": ["베이커리", "빵", "제과", "제빵"],
  "갈비집": ["갈비집", "갈비"],
  "고깃집": ["고깃집", "고기", "육류"],
  "고기집": ["고기집", "고기", "육류"],
  "횟집": ["횟집", "회", "생선회"],
  "떡집": ["떡집", "떡"],
  "한식집": ["한식집", "한식", "요리"],
  "한식당": ["한식당", "한식", "요리"],
  "식당": ["식당", "음식점", "요리"],
  "음식점": ["음식점", "식당", "요리"],
  "카페": ["카페", "커피", "제과", "제빵"]
};

function normalizeSearchToken(value) {
  return getText(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?()[\]{}"'`~:;·ㆍ/\\|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchTokens(keyword) {
  const normalized = normalizeSearchToken(keyword);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map(token => token.trim())
    .filter(Boolean)
    .filter(token => !SEARCH_STOPWORDS.has(token))
    .filter(token => token.length >= 1);
}

function hasNearbySearchIntent(keyword) {
  const normalized = normalizeSearchToken(keyword);

  if (!normalized) {
    return false;
  }

  return /(^|\s)(내\s*주변|내주변|주변|근처|가까운|가까이|인근)(\s|$)/.test(normalized);
}

function getSearchAlternatives(token) {
  const alternatives = new Set([token]);if (SEARCH_SYNONYMS[token]) {
    SEARCH_SYNONYMS[token].forEach(value => alternatives.add(value));
  }

  // "갈비집", "빵집"처럼 '~집' 표현은 원문과 함께 '집'을 뺀 표현도 검색한다.
  if (token.length >= 3 && token.endsWith("집")) {
    alternatives.add(token.slice(0, -1));
  }

  return Array.from(alternatives);
}

function getRowSearchText(row) {
  return normalizeSearchToken(`
    ${getField(row, ["성명", "성함"])}
    ${getText(row["직종"])}
    ${getText(row["선정년도"])}
    ${getField(row, ["대표사업장명", "사업장명"])}
    ${getField(row, ["주소", "사업장 주소"])}
    ${getField(row, ["대표품목", "주요메뉴", "대표메뉴", "주요사업"])}
    ${getRepresentativeMenusForSearch(row)}
    ${getField(row, ["사업장구분", "사업장 구분", "관계", "관계구분"])}
  `);
}

function scrollMapIntoViewOnMobile() {
  const isMobile = window.matchMedia("(max-width: 900px)").matches;

  if (!isMobile) {
    return;
  }

  const mapWrapper = document.querySelector(".map-wrapper");

  if (mapWrapper) {
    mapWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function getRowLatLng(row) {
  const latText = getField(row, [
    "위도",
    "lat",
    "latitude"
  ]);

  const lngText = getField(row, [
    "경도",
    "lng",
    "lon",
    "longitude"
  ]);

  return {
    lat: parseFloat(latText),
    lng: parseFloat(lngText)
  };
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function getRowDistanceKm(row) {
  if (!userCoords) {
    return null;
  }

  const { lat, lng } = getRowLatLng(row);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return getDistanceKm(userCoords.lat, userCoords.lng, lat, lng);
}

function findNearbyMasters() {
  const nearbyButton = document.getElementById("nearbyButton");

  if (nearbyButton) {
    nearbyButton.disabled = true;
    nearbyButton.textContent = "위치 확인 중...";
  }

  getCurrentPosition()
    .then(position => {
      const { latitude, longitude, accuracy } = position.coords;

      userCoords = { lat: latitude, lng: longitude };
      sortByDistance = true;

      showUserLocationOnMap(latitude, longitude, accuracy);
      applyFilters();
      scrollMapIntoViewOnMobile();

      if (nearbyButton) {
        nearbyButton.classList.add("active");
      }
    })
    .catch(error => {
      console.error("위치 정보 가져오기 실패:", error);
      alert("현재 위치를 가져올 수 없습니다. 브라우저의 위치 권한을 확인해주세요.");
    })
    .finally(() => {
      if (nearbyButton) {
        nearbyButton.disabled = false;
        nearbyButton.textContent = "📍 내 주변 대한민국명장 찾기";
      }
    });
}

function getJobType(job) {
  const text = getText(job);

  if (text.includes("제과") || text.includes("제빵")) {
    return "bakery";
  }

  if (text.includes("요리")) {
    return "cooking";
  }

  if (text.includes("자동차")) {
    return "car";
  }

  return "default";
}

function getJobEmoji(job) {
  const type = getJobType(job);

  if (type === "bakery") {
    return "🍰";
  }

  if (type === "cooking") {
    return "👨‍🍳";
  }

  if (type === "car") {
    return "🚗";
  }

  return "🏆";
}

function getJobLabel(job) {
  const type = getJobType(job);

  if (type === "bakery") {
    return "제과·제빵";
  }

  if (type === "cooking") {
    return "요리";
  }

  if (type === "car") {
    return "자동차정비";
  }

  return getText(job) || "기타";
}

function getJobDotClass(job) {
  const type = getJobType(job);

  if (type === "bakery") {
    return "bakery";
  }

  if (type === "cooking") {
    return "cooking";
  }

  if (type === "car") {
    return "car";
  }

  return "";
}


function getBusinessCategoryInfo(row) {
  const rawCategory = getField(row, [
    "사업장구분",
    "사업장 구분",
    "관계",
    "관계구분"
  ]);

  const normalized = rawCategory
    .replace(/\s+/g, "")
    .replace(/[·ㆍ,\/()]/g, "")
    .toLowerCase();

  if (
    normalized === "대한민국명장직영점" ||
    normalized === "명장직영점" ||
    normalized === "직접소유운영" ||
    normalized === "직접운영" ||
    normalized === "direct"
  ) {
    return {
      label: "직접운영",
      className: "direct"
    };
  }

  if (
    normalized === "가맹점" ||
    normalized === "기술적용" ||
    normalized === "기술적용관리" ||
    normalized === "명장관리사업장" ||
    normalized === "brand"
  ) {
    return {
      label: "기술적용",
      className: "managed"
    };
  }

  if (
    normalized === "기술전수" ||
    normalized === "대한민국명장기술전수" ||
    normalized === "명장기술전수" ||
    normalized === "기술전수및자문또는레시피사용" ||
    normalized === "기술전수자문레시피사용" ||
    normalized === "advice"
  ) {
    return {
      label: "기술전수",
      className: "transfer"
    };
  }

  if (
    normalized === "재직기업" ||
    normalized === "대한민국명장재직기업" ||
    normalized === "명장재직기업" ||
    normalized === "소속기업" ||
    normalized === "재직" ||
    normalized === "affiliation"
  ) {
    return {
      label: "재직기업",
      className: "affiliation"
    };
  }

  return {
    label: rawCategory || "미분류",
    className: "unknown"
  };
}

function makeCustomIcon(job, categoryInfo, isSelected) {
  const emoji = getJobEmoji(job);
  const selectedClass = isSelected ? "selected" : "";
  const categoryClass = escapeHtmlAttr(
    categoryInfo && categoryInfo.className ? categoryInfo.className : "unknown"
  );

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div class="marker-pin marker-category-${categoryClass} ${selectedClass}">
        <span class="emoji">${emoji}</span>
      </div>
    `,
    iconSize: [46, 54],
    iconAnchor: [23, 52],
    popupAnchor: [0, -50]
  });
}


function makeNaverDirectionsUrl(row, business, address) {
  const { lat, lng } = getRowLatLng(row);
  const destinationName = encodeURIComponent(business || address || "목적지");

  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    // 네이버지도 목적지 좌표 기반 길찾기 URL
    return `https://map.naver.com/p/directions/-/${lng},${lat},${destinationName},ADDRESS_POI/-/car?c=15.00,0,0,0,dh`;
  }

  const query = `${business || ""} ${address || ""} 길찾기`.trim();
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

// ============================================================
// Supabase 익명 이용통계
// ------------------------------------------------------------
// - 일반 이용통계에는 방문자의 이름, IP 주소, 정확한 위치를 저장하지 않습니다.
// - 날짜별 이벤트 횟수는 Supabase RPC 함수(record_map_event)에 누적합니다.
// - 검색 실행 시 검색어와 결과 건수는 별도 RPC(record_meister_search)에 저장할 수 있습니다.
// - index.html의 MEISTER_ANALYTICS_CONFIG 값이 비어 있으면 자동 비활성화됩니다.
// ============================================================

let analyticsSupabaseClient = null;
let analyticsReady = false;

function setupAnonymousAnalytics() {
  const config = window.MEISTER_ANALYTICS_CONFIG || {};
  const supabaseUrl = getText(config.supabaseUrl);
  const supabaseAnonKey = getText(config.supabaseAnonKey);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.info("익명 이용통계: Supabase 연결정보가 없어 비활성화 상태입니다.");
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.warn("익명 이용통계: Supabase 라이브러리를 불러오지 못했습니다.");
    return;
  }

  analyticsSupabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  );

  analyticsReady = true;
}

/**
 * 익명 통계 이벤트 기록
 * @param {string} eventName 허용된 통계 이벤트명
 * @param {string} targetId 개인식별정보가 아닌 내부 코드
 */
async function trackEvent(eventName, targetId = "all") {
  if (!analyticsReady || !analyticsSupabaseClient) {
    return;
  }

  const safeEventName = getText(eventName).slice(0, 50);
  const safeTargetId = getText(targetId || "all").slice(0, 50) || "all";

  if (!safeEventName) {
    return;
  }

  try {
    const { error } = await analyticsSupabaseClient.rpc("record_map_event", {
      p_event_name: safeEventName,
      p_target_id: safeTargetId
    });

    if (error) {
      console.warn("익명 이용통계 기록 실패:", error.message);
    }
  } catch (error) {
    // 통계 오류 때문에 지도 서비스가 중단되지 않도록 예외를 흡수합니다.
    console.warn("익명 이용통계 처리 오류:", error);
  }
}


/**
 * 이용자가 직접 입력한 검색어와 결과 건수를 저장합니다.
 * - 이름/IP/정확한 위치정보는 함께 저장하지 않습니다.
 * - Supabase의 record_meister_search RPC가 없거나 오류가 나더라도 지도 검색은 정상 동작합니다.
 */
async function recordSearchQuery(searchQuery, resultCount) {
  if (!analyticsReady || !analyticsSupabaseClient) {
    return;
  }

  const query = getText(searchQuery).slice(0, 100);

  if (!query) {
    return;
  }

  try {
    const { error } = await analyticsSupabaseClient.rpc("record_meister_search", {
      p_search_query: query,
      p_result_count: Math.max(0, Number(resultCount) || 0)});

    if (error) {
      console.warn("검색어 기록 실패:", error.message);
    }
  } catch (error) {
    console.warn("검색어 기록 처리 오류:", error);
  }
}


/**
 * CSV 행에서 통계용 내부 식별자를 생성합니다.
 * CSV에 ID/사업장ID 열이 있으면 그 값을 우선 사용하고,
 * 없으면 현재 행 번호를 사용합니다.
 */
function getAnalyticsTargetId(row) {
  const explicitId = getField(row, [
    "ID",
    "id",
    "사업장ID",
    "사업장 ID",
    "business_id"
  ]);

  if (explicitId) {
    return explicitId;
  }

  if (row && Number.isInteger(row.__index)) {
    return `business_${row.__index + 1}`;
  }

  return "unknown";
}

setupAnonymousAnalytics();
trackEvent("page_view", "all");

function escapeHtmlAttr(value) {
  return getText(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function shareMasterPlace(title, text, url) {
  const shareTitle = title || "대한민국명장 지도";
  const shareText = text || "대한민국명장 지도에서 확인해보세요.";
  const shareUrl = url || window.location.href;

  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl
      });
      return;
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }
      console.warn("공유 실패:", error);
    }
  }

  const copyText = `${shareTitle}\n${shareText}\n${shareUrl}`;

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(copyText);
    alert("공유 문구와 링크를 복사했습니다.");
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = copyText;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  alert("공유 문구와 링크를 복사했습니다.");
}

function makePopup(row) {
  const name = getField(row, ["성명", "성함"]);
  const job = getText(row["직종"]);
  const year = getText(row["선정년도"]);

  const business = getField(row, [
    "대표사업장명",
    "사업장명"
  ]);

  const address = getField(row, [
    "주소",
    "사업장 주소"
  ]);

  const mainMenu = getField(row, [
    "대표품목",
    "주요메뉴",
    "대표메뉴",
    "주요사업"
  ]);

  const naverPlaceLink = getField(row, [
    "네이버플레이스",
    "네이버 플레이스",
    "naver_place",
    "place_url"
  ]);

  const placeQuery = `${business || name} ${address}`.trim();
  const naverPlaceUrl = getSafeNaverUrl(naverPlaceLink, placeQuery);
  const naverDirectionsUrl = makeNaverDirectionsUrl(row, business || name, address);
  const analyticsTargetId = escapeHtmlAttr(getAnalyticsTargetId(row));
  const shareTitle = escapeHtmlAttr(business || "대한민국명장 지도");
  const shareText = escapeHtmlAttr(`${business || "사업장"} - ${name ? "대한민국명장 " + name + " · " : ""}${escapeHtml(getJobLabel(job))}${year ? " · " + year + "년 선정" : ""}`);
  const shareUrl = escapeHtmlAttr(naverPlaceUrl || window.location.href);
  const categoryInfo = getBusinessCategoryInfo(row);
  const safeCategoryClass = escapeHtmlAttr(categoryInfo && categoryInfo.className ? categoryInfo.className : "unknown");
  const safeCategoryLabel = escapeHtml(categoryInfo && categoryInfo.label ? categoryInfo.label : "미분류");
  const categoryBadge = categoryInfo
    ? `<span class="business-category-badge ${safeCategoryClass}">${safeCategoryLabel}</span>`
    : "";

  return `
    <div class="popup-card">
      <div class="popup-top">
        <span class="legend-circle ${getJobDotClass(job)} popup-icon">
          ${getJobEmoji(job)}
        </span>

        <div>
          <div class="popup-title-row">
            <div class="popup-title">
              ${escapeHtml(business || "사업장명 없음")}
            </div>
            ${categoryBadge}
          </div>

        </div>
      </div>

      <div class="popup-info-grid">
        <div class="popup-info-label">대한민국명장</div>
        <div class="popup-info-value">${escapeHtml(name || "-")}</div>

        <div class="popup-info-label">직종</div>
        <div class="popup-info-value">${escapeHtml(getJobLabel(job))}</div>

        <div class="popup-info-label">선정년도</div>
        <div class="popup-info-value">${escapeHtml(year ? year + "년" : "-")}</div>
      </div>

      <div class="popup-line">
        <b>주소</b> ${escapeHtml(address || "-")}
      </div>

      <div class="popup-line">
        <b>대표품목</b> ${escapeHtml(mainMenu || "-")}
      </div>

      <div class="popup-actions">
        <a class="popup-button popup-track-link" href="${escapeHtmlAttr(naverPlaceUrl)}" target="_blank" rel="noopener noreferrer" data-track-event="naver_place_click" data-target-id="${analyticsTargetId}">
          네이버 플레이스
        </a>

        <a class="popup-button popup-button-secondary popup-track-link" href="${escapeHtmlAttr(naverDirectionsUrl)}" target="_blank" rel="noopener noreferrer" data-track-event="directions_click" data-target-id="${analyticsTargetId}">
          길찾기
        </a>

        <button class="popup-button popup-button-share popup-share-button" type="button" data-target-id="${analyticsTargetId}" data-share-title="${shareTitle}" data-share-text="${shareText}" data-share-url="${shareUrl}">
          공유하기
        </button>
      </div>
    </div>
  `;
}

function clearMarkers() {
  markers.forEach(marker => {
    map.removeLayer(marker);
  });

  markers = [];
  markerByIndex = {};
  markerJobByIndex = {};
  markerCategoryByIndex = {};
  selectedIndex = null;
}

function showMarkers(rows) {
  clearMarkers();

  rows.forEach(row => {
    const latText = getField(row, [
      "위도",
      "lat",
      "latitude"
    ]);

    const lngText = getField(row, [
      "경도",
      "lng",
      "lon",
      "longitude"
    ]);

    const lat = parseFloat(latText);
    const lng = parseFloat(lngText);
    const job = getText(row["직종"]);
    const categoryInfo = getBusinessCategoryInfo(row);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return;
    }

    const marker = L.marker([lat, lng], {
      icon: makeCustomIcon(job, categoryInfo, false)
    })
      .addTo(map)
      .bindPopup(makePopup(row));

    marker.on("click", () => {
      trackEvent("marker_click", getAnalyticsTargetId(row));
      selectMarkerByIndex(row.__index);
    });

    markers.push(marker);
    markerByIndex[row.__index] = marker;
    markerJobByIndex[row.__index] = job;
    markerCategoryByIndex[row.__index] = categoryInfo;
  });

  document.getElementById("resultCount").textContent = markers.length;

  renderMasterList(rows);

  if (markers.length > 0) {
    const group = L.featureGroup(markers);

    map.fitBounds(group.getBounds(), {
      padding: [40, 40]
    });
  }
}

function selectMarkerByIndex(index) {
  if (selectedIndex !== null && selectedIndex !== index && markerByIndex[selectedIndex]) {
    const prevMarker = markerByIndex[selectedIndex];
    const prevJob = markerJobByIndex[selectedIndex];
    const prevCategory = markerCategoryByIndex[selectedIndex];

    prevMarker.setIcon(makeCustomIcon(prevJob, prevCategory, false));
    prevMarker.setZIndexOffset(0);
  }

  selectedIndex = index;

  const marker = markerByIndex[index];
  const job = markerJobByIndex[index];
  const categoryInfo = markerCategoryByIndex[index];

  if (marker) {
    marker.setIcon(makeCustomIcon(job, categoryInfo, true));
    marker.setZIndexOffset(1000);
  }

  updateMasterListSelection();
}

function updateMasterListSelection() {
  document.querySelectorAll(".master-item").forEach(item => {
    const itemIndex = Number(item.dataset.index);

    if (itemIndex === selectedIndex) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  });
}

function rowMatchesKeyword(row, keyword) {
  const tokens = getSearchTokens(keyword);

  if (tokens.length === 0) {
    return true;
  }

  const searchableText = getRowSearchText(row);

  // 자연어 문장에서 추출한 모든 핵심어가 해당 사업장 정보 어딘가에 포함되면 일치.
  // 대표메뉴검색용 데이터도 여기에는 포함되지만 화면에는 출력하지 않는다.
  return tokens.every(token => {
    const alternatives = getSearchAlternatives(token);
    return alternatives.some(value => searchableText.includes(value));
  });
}

const REGION_MAP = {
  "서울특별시": "서울",
  "서울": "서울",
  "부산광역시": "부산",
  "부산": "부산",
  "대구광역시": "대구",
  "대구": "대구",
  "인천광역시": "인천",
  "인천": "인천",
  "광주광역시": "광주",
  "광주": "광주",
  "대전광역시": "대전",
  "대전": "대전",
  "울산광역시": "울산",
  "울산": "울산",
  "세종특별자치시": "세종",
  "세종": "세종",
  "경기도": "경기",
  "경기": "경기",
  "강원특별자치도": "강원",
  "강원도": "강원",
  "강원": "강원",
  "충청북도": "충북",
  "충북": "충북",
  "충청남도": "충남",
  "충남": "충남",
  "전북특별자치도": "전북",
  "전라북도": "전북",
  "전북": "전북",
  "전라남도": "전남",
  "전남": "전남",
  "경상북도": "경북",
  "경북": "경북",
  "경상남도": "경남",
  "경남": "경남",
  "제주특별자치도": "제주",
  "제주도": "제주",
  "제주": "제주"
};

const REGION_ORDER = [
  "서울", "경기", "인천", "강원",
  "대전", "세종", "충남", "충북",
  "광주", "전남", "전북",
  "대구", "경북",
  "부산", "울산", "경남",
  "제주"
];

function getRegionLabel(address) {
  const token = getText(address).split(/\s+/)[0];
  return REGION_MAP[token] || "기타";
}

function rowMatchesRegionFilter(row) {
  if (activeRegionFilter === "") {
    return true;
  }

  const address = getField(row, ["주소", "사업장 주소"]);
  return getRegionLabel(address) === activeRegionFilter;
}

function rowMatchesJobFilter(row) {
  if (activeJobFilter === "") {
    return true;
  }

  const job = getText(row["직종"]);
  const jobType = getJobType(job);

  return jobType === activeJobFilter;
}

function applyFilters() {
  const keyword = getText(document.getElementById("searchInput").value).toLowerCase();

  currentRows = allRows.filter(row => {
    return rowMatchesKeyword(row, keyword) && rowMatchesJobFilter(row) && rowMatchesRegionFilter(row);
  });

  if (sortByDistance && userCoords) {
    currentRows = currentRows.slice().sort((a, b) => {
      const distanceA = getRowDistanceKm(a);
      const distanceB = getRowDistanceKm(b);

      if (distanceA === null) {
        return 1;
      }

      if (distanceB === null) {
        return -1;
      }return distanceA - distanceB;
    });
  }

  showMarkers(currentRows);
  updateLegendStyle();
}

async function searchRows() {
  const keyword = getText(document.getElementById("searchInput").value);
  const nearbyIntent = hasNearbySearchIntent(keyword);

  trackEvent("search_execute", keyword ? "with_keyword" : "empty");

  if (nearbyIntent) {
    const nearbyButton = document.getElementById("nearbyButton");

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

      if (nearbyButton) {
        nearbyButton.classList.add("active");
      }

      applyFilters();
      scrollMapIntoViewOnMobile();
      trackEvent("nearby_search_click", "natural_language");
    } catch (error) {
      console.error("자연어 위치 검색 실패:", error);
      alert(
        "현재 위치를 확인할 수 없어 주변 검색을 실행하지 못했습니다. " +
        "브라우저의 위치 권한을 허용한 뒤 다시 검색해 주세요."
      );

      if (nearbyButton) {
        nearbyButton.classList.remove("active");
      }

      return;
    } finally {
      if (nearbyButton) {
        nearbyButton.disabled = false;
        nearbyButton.textContent = "📍 내 주변 대한민국명장 찾기";
      }
    }
  } else {
    applyFilters();
  }

  trackEvent("search_result", currentRows.length > 0 ? "has_result" : "no_result");

  if (keyword) {
    recordSearchQuery(keyword, currentRows.length);
  }
}

function renderMasterList(rows) {
  const list = document.getElementById("masterList");
  list.innerHTML = "";

  const visibleRows = rows.filter(row => {
    return markerByIndex[row.__index];
  });

  if (visibleRows.length === 0) {
    list.innerHTML = `
      <div class="empty-message">
        표시할 좌표가 없습니다.
      </div>
    `;

    return;
  }

  visibleRows.forEach(row => {
    const name = getField(row, ["성명", "성함"]);
    const job = getText(row["직종"]);
    const business = getField(row, ["대표사업장명", "사업장명"]);
    const categoryInfo = getBusinessCategoryInfo(row);

    const distanceKm = sortByDistance ? getRowDistanceKm(row) : null;
    const distanceText = distanceKm === null
      ? ""
      : ` · ${distanceKm < 1 ? Math.round(distanceKm * 1000) + "m" : distanceKm.toFixed(1) + "km"}`;

    const item = document.createElement("button");
    item.className = "master-item";
    item.dataset.index = row.__index;

    if (row.__index === selectedIndex) {
      item.classList.add("selected");
    }

    item.innerHTML = `
      <span class="legend-circle business-list-icon category-${categoryInfo.className}" title="${escapeHtmlAttr(categoryInfo.label)}">
        ${getJobEmoji(job)}
      </span>

      <span>
        <span class="master-name">
          ${escapeHtml(business || "사업장명 없음")}
        </span>

        <span class="master-meta">
          ${name ? "대한민국명장 " + name + " · " : ""}${escapeHtml(getJobLabel(job))}${distanceText}
        </span>
      </span>
    `;

    item.addEventListener("click", () => {
      const marker = markerByIndex[row.__index];

      if (!marker) {
        return;
      }

      trackEvent("business_detail_click", getAnalyticsTargetId(row));
      selectMarkerByIndex(row.__index);
      scrollMapIntoViewOnMobile();

      map.setView(marker.getLatLng(), 15, {
        animate: true
      });

      marker.openPopup();
    });

    list.appendChild(item);
  });
}

function updateLegendStyle() {
  const buttons = document.querySelectorAll(".job-filter-button");

  buttons.forEach(button => {
    const jobType = button.dataset.jobFilter;

    if (activeJobFilter !== "" && jobType === activeJobFilter) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });

  const resetButton = document.getElementById("jobFilterResetButton");

  if (resetButton) {
    if (activeJobFilter === "") {
      resetButton.classList.add("active");
    } else {
      resetButton.classList.remove("active");
    }
  }
}

function setupJobFilterButtons() {
  const buttons = document.querySelectorAll(".job-filter-button");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const jobType = button.dataset.jobFilter;

      if (activeJobFilter === jobType) {
        activeJobFilter = "";
      } else {
        activeJobFilter = jobType;
      }

      trackEvent("category_filter", activeJobFilter || "all");
      applyFilters();
    });
  });

  const resetButton = document.getElementById("jobFilterResetButton");

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      activeJobFilter = "";
      trackEvent("category_filter", "all");
      applyFilters();
    });
  }

  updateLegendStyle();
}

function populateRegionOptions() {
  const select = document.getElementById("regionFilterSelect");

  if (!select) {
    return;
  }

  const presentRegions = new Set();

  allRows.forEach(row => {
    const address = getField(row, ["주소", "사업장 주소"]);
    presentRegions.add(getRegionLabel(address));
  });

  const orderedRegions = REGION_ORDER.filter(region => presentRegions.has(region));

  if (presentRegions.has("기타")) {
    orderedRegions.push("기타");
  }

  select.innerHTML = `<option value="">지역 전체</option>`;

  orderedRegions.forEach(region => {
    const option = document.createElement("option");
    option.value = region;
    option.textContent = region;
    select.appendChild(option);
  });

  select.value = activeRegionFilter;
}

function setupRegionFilterSelect() {
  const select = document.getElementById("regionFilterSelect");

  if (!select) {
    return;
  }

  select.addEventListener("change", () => {
    activeRegionFilter = select.value;
    trackEvent("region_filter", activeRegionFilter || "all");
    applyFilters();
  });
}


document.addEventListener("click", event => {
  const shareButton = event.target.closest(".popup-share-button");

  if (shareButton) {
    trackEvent("share_click", shareButton.dataset.targetId || "unknown");
    shareMasterPlace(
      shareButton.dataset.shareTitle,
      shareButton.dataset.shareText,
      shareButton.dataset.shareUrl
    );
    return;
  }

  const link = event.target.closest(".popup-track-link");

  if (!link) {
    return;
  }

  trackEvent(
    link.dataset.trackEvent,
    link.dataset.targetId || "unknown"
  );
});

document.getElementById("searchButton").addEventListener("click", () => {
  searchRows();
});

document.getElementById("resetButton").addEventListener("click", () => {
  trackEvent("reset_click", "all");
  document.getElementById("searchInput").value = "";
  activeJobFilter = "";
  activeRegionFilter = "";
  sortByDistance = false;
  userCoords = null;

  const regionSelect = document.getElementById("regionFilterSelect");

  if (regionSelect) {
    regionSelect.value = "";
  }

  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
    userLocationMarker = null;
  }

  if (userAccuracyCircle) {
    map.removeLayer(userAccuracyCircle);
    userAccuracyCircle = null;
  }

  const nearbyButton = document.getElementById("nearbyButton");

  if (nearbyButton) {
    nearbyButton.classList.remove("active");
  }

  currentRows = allRows;
  showMarkers(currentRows);
  updateLegendStyle();
});

document.getElementById("nearbyButton").addEventListener("click", () => {
  trackEvent("nearby_search_click", "all");
  findNearbyMasters();
});

document.getElementById("searchInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    searchRows();
  }
});

setupJobFilterButtons();
setupRegionFilterSelect();


function mapSupabaseBusinessRow(row, index) {
  return {
    "사업장ID": getText(row.business_id),
    "직종": getText(row.job_type),
    "성명": getText(row.master_name),
    "선정년도": row.selection_year === null || row.selection_year === undefined
      ? ""
      : String(row.selection_year),
    "대표사업장명": getText(row.business_name),
    "주소": getText(row.address),
    "대표품목": getText(row.main_item),
    // 검색 전용: 팝업/목록에는 출력하지 않는다.
    "대표메뉴검색용": Array.isArray(row.representative_menus)
      ? row.representative_menus.map(getText).filter(Boolean).join(" ")
      : getText(row.representative_menus),
    "위도": row.latitude === null || row.latitude === undefined
      ? ""
      : String(row.latitude),
    "경도": row.longitude === null || row.longitude === undefined
      ? ""
      : String(row.longitude),
    "네이버플레이스": getText(row.naver_place_url),
    "관계": getText(row.relationship_type),
    __index: index
  };
}

async function loadBusinessDataFromSupabase() {
  const config = window.MEISTER_SUPABASE_CONFIG ||
                 window.MEISTER_ANALYTICS_CONFIG ||
                 {};
  const supabaseUrl = getText(config.supabaseUrl);
  const supabaseAnonKey = getText(config.supabaseAnonKey);

  if (!supabaseUrl || !supabaseAnonKey) {
    alert(
      "Supabase 연결정보가 비어 있습니다.\n" +
      "supabase-config.js에 Project URL과 Publishable key를 입력해 주세요."
    );
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    alert("Supabase 라이브러리를 불러오지 못했습니다.");
    return;
  }

  const dataClient = analyticsSupabaseClient ||
    window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

  try {
    const { data, error } = await dataClient.rpc(
      "get_public_meister_businesses"
    );

    if (error) {
      throw error;
    }

    allRows = (data || []).map(mapSupabaseBusinessRow);
    currentRows = allRows;

    populateRegionOptions();
    showMarkers(currentRows);
    updateLegendStyle();

    console.log("Supabase 사업장 데이터 불러오기 완료:", allRows.length);
  } catch (error) {
    console.error("Supabase 사업장 데이터 불러오기 실패:", error);

    alert(
      "사업장 정보를 불러오지 못했습니다.\n\n" +
      (error.message || "Supabase 테이블과 공개 조회 함수 설정을 확인해 주세요.")
    );
  }
}

loadBusinessDataFromSupabase();


// 대한민국명장 지도 전체 페이지 공유
const pageShareButton = document.getElementById("pageShareButton");

if (pageShareButton) {
  pageShareButton.addEventListener("click", () => {
    trackEvent("share_click", "page");
    shareMasterPlace(
      "대한민국명장 지도",
      "대한민국명장의 사업장과 활동 정보를 한눈에 확인해보세요.",
      window.location.href
    );
  });
}
