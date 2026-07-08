const CSV_FILE = "mapdata.csv";

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

function getField(row, names) {
  for (const name of names) {
    const value = getText(row[name]);

    if (value !== "") {
      return value;
    }
  }

  return "";
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
        nearbyButton.textContent = "📍 내 주변 명장 찾기";
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

function makeCustomIcon(job, isSelected) {
  const type = getJobType(job);
  const emoji = getJobEmoji(job);
  const selectedClass = isSelected ? "selected" : "";

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div class="marker-pin marker-${type} ${selectedClass}">
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

function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

function escapeHtmlAttr(value) {
  return getText(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function shareMasterPlace(title, text, url) {
  const shareTitle = title || "대한민국 명장지도";
  const shareText = text || "대한민국 명장지도에서 확인해보세요.";
  const shareUrl = url || window.location.href;

  trackEvent("share_button_click", {
    business_name: shareTitle
  });

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
  const naverPlaceUrl = naverPlaceLink || `https://map.naver.com/p/search/${encodeURIComponent(placeQuery)}`;
  const naverDirectionsUrl = makeNaverDirectionsUrl(row, business || name, address);
  const trackingBusinessName = escapeHtmlAttr(business || name || "");
  const shareTitle = escapeHtmlAttr(business || "대한민국 명장지도");
  const shareText = escapeHtmlAttr(`${business || "사업장"} - ${getJobLabel(job)} ${name ? "· " + name + " 명장" : ""}`);
  const shareUrl = escapeHtmlAttr(naverPlaceUrl || window.location.href);

  return `
    <div class="popup-card">
      <div class="popup-top">
        <span class="legend-circle ${getJobDotClass(job)} popup-icon">
          ${getJobEmoji(job)}
        </span>

        <div>
          <div class="popup-title">
            ${business || "사업장명 없음"}
          </div>

          <div class="popup-sub">
            ${getJobLabel(job)} ${year ? "· " + year + "년 선정" : ""}
          </div>
        </div>
      </div>

      <div class="popup-line">
        <b>명장</b> ${name || "-"}
      </div>

      <div class="popup-line">
        <b>주소</b> ${address || "-"}
      </div>

      <div class="popup-line">
        <b>대표품목</b> ${mainMenu || "-"}
      </div>

      <div class="popup-actions">
        <a class="popup-button popup-track-link" href="${naverPlaceUrl}" target="_blank" rel="noopener" data-track-event="naver_place_click" data-business-name="${trackingBusinessName}">
          네이버 플레이스
        </a>

        <a class="popup-button popup-button-secondary popup-track-link" href="${naverDirectionsUrl}" target="_blank" rel="noopener" data-track-event="naver_directions_click" data-business-name="${trackingBusinessName}">
          길찾기
        </a>

        <button class="popup-button popup-button-share popup-share-button" type="button" data-share-title="${shareTitle}" data-share-text="${shareText}" data-share-url="${shareUrl}">
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

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return;
    }

    const marker = L.marker([lat, lng], {
      icon: makeCustomIcon(job, false)
    })
      .addTo(map)
      .bindPopup(makePopup(row));

    marker.on("click", () => {
      selectMarkerByIndex(row.__index);
    });

    markers.push(marker);
    markerByIndex[row.__index] = marker;
    markerJobByIndex[row.__index] = job;
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

    prevMarker.setIcon(makeCustomIcon(prevJob, false));
    prevMarker.setZIndexOffset(0);
  }

  selectedIndex = index;

  const marker = markerByIndex[index];
  const job = markerJobByIndex[index];

  if (marker) {
    marker.setIcon(makeCustomIcon(job, true));
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
  if (keyword === "") {
    return true;
  }

  const text = `
    ${getField(row, ["성명", "성함"])}
    ${getText(row["직종"])}
    ${getText(row["선정년도"])}
    ${getField(row, ["대표사업장명", "사업장명"])}
    ${getField(row, ["주소", "사업장 주소"])}
    ${getField(row, ["대표품목", "주요메뉴", "대표메뉴", "주요사업"])}
  `.toLowerCase();

  return text.includes(keyword);
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
      }

      return distanceA - distanceB;
    });
  }

  showMarkers(currentRows);
  updateLegendStyle();
}

function searchRows() {
  trackEvent("search", { search_term: getText(document.getElementById("searchInput").value) });
  applyFilters();
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
      <span class="legend-circle ${getJobDotClass(job)}">
        ${getJobEmoji(job)}
      </span>

      <span>
        <span class="master-name">
          ${business || "사업장명 없음"}
        </span>

        <span class="master-meta">
          ${getJobLabel(job)} · ${name || "성함 없음"}${distanceText}
        </span>
      </span>
    `;

    item.addEventListener("click", () => {
      const marker = markerByIndex[row.__index];

      if (!marker) {
        return;
      }

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

      applyFilters();
    });
  });

  const resetButton = document.getElementById("jobFilterResetButton");

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      activeJobFilter = "";
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
    applyFilters();
  });
}


document.addEventListener("click", event => {
  const shareButton = event.target.closest(".popup-share-button");

  if (shareButton) {
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

  trackEvent(link.dataset.trackEvent, {
    business_name: link.dataset.businessName || ""
  });
});

document.getElementById("searchButton").addEventListener("click", () => {
  searchRows();
});

document.getElementById("resetButton").addEventListener("click", () => {
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
  trackEvent("nearby_button_click");
  findNearbyMasters();
});

document.getElementById("searchInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    searchRows();
  }
});

setupJobFilterButtons();
setupRegionFilterSelect();

Papa.parse(CSV_FILE, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function(results) {
    allRows = results.data.map((row, index) => {
      return {
        ...row,
        __index: index
      };
    });

    currentRows = allRows;
    populateRegionOptions();
    showMarkers(currentRows);
    updateLegendStyle();

    console.log("CSV 불러오기 완료:", allRows);
  },
  error: function(error) {
    console.error("CSV 불러오기 실패:", error);

    alert(
      "CSV 파일을 불러오지 못했습니다. 파일명과 위치를 확인하세요.\n\n" +
      "필요 파일명: mapdata.csv"
    );
  }
});
