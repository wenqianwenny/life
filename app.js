const storageKey = "daily-care-records-v1";
const storageBackupKey = "daily-care-records-backup-v1";
const orderStorageKey = "daily-care-medicine-order-v1";
const customMedicinesStorageKey = "daily-care-custom-medicines-v1";
const syncIdStorageKey = "daily-care-sync-id-v1";
const syncUpdatedAtStorageKey = "daily-care-sync-updated-at-v1";
const orderUpdatedAtStorageKey = "daily-care-order-updated-at-v1";
const customUpdatedAtStorageKey = "daily-care-custom-updated-at-v1";
const windowNamePrefix = "__daily_care_records__:";
const productionOrigin = "https://life-two-amber.vercel.app";
const doseOptions = ["0.25", "0.5", "1", "1.25", "1.5", "2", "3", "4"];
const customMedicineColors = ["#b7c9e3", "#d3c6e6", "#e5da92", "#e9d0b1", "#ececa8", "#7f8d67"];

const defaultMedicines = [
  {
    id: "lifespace",
    name: "Lifespace 益生菌",
    color: "#b7c9e3",
    dose: "1piece",
    doses: ["1piece", "2pieces", "skip"],
    image: "./assets/lifespace.png",
    bg: "#edf1f7",
    imageClass: "lifespace",
    imgW: "46px",
    imgH: "58px",
  },
  {
    id: "olly",
    name: "Olly 褪黑素",
    color: "#d3c6e6",
    dose: "1piece",
    doses: ["1piece", "2pieces", "skip"],
    image: "./assets/olly.png",
    bg: "#eff0f7",
    imageClass: "olly",
    imgW: "54px",
    imgH: "62px",
  },
  {
    id: "zopiclone",
    name: "右佐匹克隆",
    color: "#e5da92",
    dose: "0.25piece",
    doses: ["0.25piece", "0.5piece", "1piece", "skip"],
    image: "./image-vc.png",
    bg: "#f5f3e6",
    imageClass: "zopiclone",
  },
  {
    id: "d3k2",
    name: "D3 & K2",
    color: "#e9d0b1",
    dose: "1piece",
    doses: ["1piece", "2pieces", "skip"],
    image: "./image-D3K2.png",
    bg: "#f5f0ea",
    imageClass: "d3k2",
  },
  {
    id: "b-complex",
    name: "活性 B 族",
    color: "#7f8d67",
    dose: "1piece",
    doses: ["1piece", "2pieces", "skip"],
    image: "./image-vb.svg",
    bg: "#eef1e8",
    imageClass: "b-complex",
    imgW: "80px",
    imgH: "80px",
  },
  {
    id: "vitamin-c",
    name: "维生素 C",
    color: "#ececa8",
    dose: "1piece",
    doses: ["1piece", "2pieces", "skip"],
    image: "./image-vc.svg",
    bg: "#f5f3e6",
    imageClass: "vitamin-c",
    imgW: "80px",
    imgH: "80px",
  },
];

let customMedicines = readCustomMedicines();
let medicines = [...defaultMedicines, ...customMedicines];
medicines = applyMedicineOrder(medicines);

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let selectedDate = new Date();
let pickerYear = selectedDate.getFullYear();
let chartMonthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
let records = migrateRecords(readRecords());
window.dailyCareRecords = records;

const dateStrip = document.querySelector("#dateStrip");
const cards = document.querySelector("#homeView");
const pageTitle = document.querySelector("#pageTitle");
const monthButton = document.querySelector("#monthButton");
const monthLabel = document.querySelector("#monthLabel");
const monthPicker = document.querySelector("#monthPicker");
const pickerYearLabel = document.querySelector("#pickerYear");
const monthGrid = document.querySelector("#monthGrid");
const prevYear = document.querySelector("#prevYear");
const nextYear = document.querySelector("#nextYear");
const homeTab = document.querySelector("#homeTab");
const mineTab = document.querySelector("#mineTab");
const homeView = document.querySelector("#homeView");
const mineView = document.querySelector("#mineView");
const weeklyChart = document.querySelector("#weeklyChart");
const mineList = document.querySelector("#mineList");
const doseSheet = document.querySelector("#doseSheet");
const doseBackdrop = document.querySelector("#doseBackdrop");
const doseClose = document.querySelector("#doseClose");
const doseOptionsList = document.querySelector("#doseOptions");
const doseTitle = document.querySelector("#doseTitle");
const addSheet = document.querySelector("#addSheet");
const addBackdrop = document.querySelector("#addBackdrop");
const addClose = document.querySelector("#addClose");
const addMedicineForm = document.querySelector("#addMedicineForm");
const addImageInput = document.querySelector("#addImageInput");
const addImagePreview = document.querySelector("#addImagePreview");
const addNameInput = document.querySelector("#addNameInput");
const addDoseOptions = document.querySelector("#addDoseOptions");
const syncEndpoint = location.protocol === "file:" || location.hostname === "127.0.0.1" ? `${productionOrigin}/api/sync` : "/api/sync";
let cloudSyncId = readSyncId();
let cloudSyncTimer = null;
let cloudSyncBusy = false;
let activeDoseMedicine = null;
let pendingMedicineImage = "";
let pendingMedicineDose = "1";
let dragState = null;

function readRecords() {
  return migrateRecords(
    parseStoredRecords(readStorage(storageKey)) ||
      parseStoredRecords(readStorage(storageBackupKey)) ||
      parseStoredRecords(readWindowNameStorage()) ||
      {},
  );
}

function writeRecords(options = {}) {
  const { markUpdated = true, sync = true } = options;
  const serialized = JSON.stringify(records);
  if (markUpdated) markSyncUpdatedAt();
  writeStorage(storageKey, serialized);
  writeStorage(storageBackupKey, serialized);
  writeWindowNameStorage(serialized);
  window.dailyCareRecords = records;
  if (sync) queueCloudSync();
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    window.dailyCareStorageFallback = window.dailyCareStorageFallback || {};
    window.dailyCareStorageFallback[key] = value;
  }
}

function readSyncId() {
  const params = new URLSearchParams(window.location.search);
  const urlSyncId = sanitizeSyncId(params.get("sync"));
  if (urlSyncId) {
    writeStorage(syncIdStorageKey, urlSyncId);
    return urlSyncId;
  }

  return sanitizeSyncId(readStorage(syncIdStorageKey));
}

function sanitizeSyncId(value) {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 96);
  return cleaned || null;
}

function getSyncUpdatedAt() {
  const value = Number(readStorage(syncUpdatedAtStorageKey));
  return Number.isFinite(value) ? value : 0;
}

function markSyncUpdatedAt() {
  const timestamp = Date.now();
  writeStorage(syncUpdatedAtStorageKey, String(timestamp));
  return timestamp;
}

function getOrderUpdatedAt() {
  const value = Number(readStorage(orderUpdatedAtStorageKey));
  return Number.isFinite(value) ? value : 0;
}

function markOrderUpdatedAt() {
  const timestamp = Date.now();
  writeStorage(orderUpdatedAtStorageKey, String(timestamp));
  return timestamp;
}

function getCustomUpdatedAt() {
  const value = Number(readStorage(customUpdatedAtStorageKey));
  return Number.isFinite(value) ? value : 0;
}

function markCustomUpdatedAt() {
  const timestamp = Date.now();
  writeStorage(customUpdatedAtStorageKey, String(timestamp));
  return timestamp;
}

function applyMedicineOrder(items) {
  const savedOrder = readMedicineOrder();
  if (!Array.isArray(savedOrder)) return items;

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = savedOrder.map((id) => byId.get(id)).filter(Boolean);
  const missing = items.filter((item) => !savedOrder.includes(item.id));
  return [...ordered, ...missing];
}

function readMedicineOrder() {
  const storedOrder = parseStoredRecords(readStorage(orderStorageKey));
  if (Array.isArray(storedOrder)) return storedOrder;

  const payload = readWindowNamePayload();
  return payload && Array.isArray(payload.order) ? payload.order : null;
}

function writeMedicineOrder(options = {}) {
  const { markUpdated = true, sync = true } = options;
  const order = medicines.map((medicine) => medicine.id);
  if (markUpdated) markOrderUpdatedAt();
  writeStorage(orderStorageKey, JSON.stringify(order));
  writeWindowNameOrder(order);
  if (sync) queueCloudSync();
}

function readCustomMedicines() {
  const stored = parseStoredRecords(readStorage(customMedicinesStorageKey));
  if (Array.isArray(stored)) return sanitizeCustomMedicines(stored);

  const payload = readWindowNamePayload();
  return payload && Array.isArray(payload.customMedicines) ? sanitizeCustomMedicines(payload.customMedicines) : [];
}

function writeCustomMedicines(options = {}) {
  const { markUpdated = true, sync = true } = options;
  if (markUpdated) markCustomUpdatedAt();
  writeStorage(customMedicinesStorageKey, JSON.stringify(customMedicines));
  writeWindowNameCustomMedicines(customMedicines);
  if (sync) queueCloudSync();
}

function sanitizeCustomMedicines(items) {
  return items
    .filter((item) => item && typeof item === "object" && item.id && item.name)
    .map((item, index) => ({
      id: String(item.id).slice(0, 96),
      name: String(item.name).trim().slice(0, 40),
      color: item.color || customMedicineColors[index % customMedicineColors.length],
      dose: normalizeDose(item.dose || "1piece"),
      image: String(item.image || ""),
      bg: item.bg || "#f8f6f4",
      imageClass: "custom",
      imgW: "80px",
      imgH: "80px",
      custom: true,
    }));
}

function readWindowNameStorage() {
  if (!window.name || !window.name.startsWith(windowNamePrefix)) return null;

  const raw = window.name.slice(windowNamePrefix.length);
  const payload = readWindowNamePayload();
  return payload && payload.records ? JSON.stringify(payload.records) : raw;
}

function writeWindowNameStorage(value) {
  const payload = readWindowNamePayload();
  const order = payload && Array.isArray(payload.order) ? payload.order : readMedicineOrder();
  const savedCustomMedicines = payload && Array.isArray(payload.customMedicines) ? payload.customMedicines : customMedicines;
  window.name = `${windowNamePrefix}${JSON.stringify({
    records: parseStoredRecords(value) || {},
    order: order || medicines.map((medicine) => medicine.id),
    customMedicines: savedCustomMedicines || [],
  })}`;
}

function writeWindowNameOrder(order) {
  const payload = readWindowNamePayload();
  const savedCustomMedicines = payload && Array.isArray(payload.customMedicines) ? payload.customMedicines : customMedicines;
  window.name = `${windowNamePrefix}${JSON.stringify({
    records,
    order,
    customMedicines: savedCustomMedicines || [],
  })}`;
}

function writeWindowNameCustomMedicines(nextCustomMedicines) {
  const payload = readWindowNamePayload();
  const order = payload && Array.isArray(payload.order) ? payload.order : medicines.map((medicine) => medicine.id);
  window.name = `${windowNamePrefix}${JSON.stringify({
    records,
    order,
    customMedicines: nextCustomMedicines,
  })}`;
}

function readWindowNamePayload() {
  if (!window.name || !window.name.startsWith(windowNamePrefix)) return null;

  try {
    const parsed = JSON.parse(window.name.slice(windowNamePrefix.length));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseStoredRecords(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function migrateRecords(source) {
  Object.values(source).forEach((day) => {
    Object.values(day).forEach((record) => {
      if (record.dose === "1/2piece") record.dose = "0.5piece";
      if (record.dose === "1/4piece") record.dose = "0.25piece";
    });
  });
  return source;
}

function getCloudPayload() {
  return {
    records,
    order: medicines.map((medicine) => medicine.id),
    customMedicines,
    updatedAt: getSyncUpdatedAt(),
    orderUpdatedAt: getOrderUpdatedAt(),
    customUpdatedAt: getCustomUpdatedAt(),
  };
}

async function fetchCloudPayload() {
  if (!cloudSyncId) return null;

  const response = await fetch(`${syncEndpoint}?key=${encodeURIComponent(cloudSyncId)}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Sync pull failed: ${response.status}`);

  const payload = await response.json();
  return payload && typeof payload === "object" ? payload : null;
}

async function saveCloudPayload(payload) {
  if (!cloudSyncId) return;

  const response = await fetch(`${syncEndpoint}?key=${encodeURIComponent(cloudSyncId)}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error(`Sync push failed: ${response.status}`);
}

function applyCloudPayload(payload) {
  if (!payload || typeof payload !== "object") return false;

  let changed = false;
  const remoteCustomUpdatedAt = Number(payload.customUpdatedAt) || 0;
  if (Array.isArray(payload.customMedicines) && remoteCustomUpdatedAt > getCustomUpdatedAt()) {
    customMedicines = sanitizeCustomMedicines(payload.customMedicines);
    medicines = applyMedicineOrder([...defaultMedicines, ...customMedicines]);
    writeStorage(customUpdatedAtStorageKey, String(remoteCustomUpdatedAt));
    writeCustomMedicines({ markUpdated: false, sync: false });
    changed = true;
  }

  const remoteUpdatedAt = Number(payload.updatedAt) || 0;
  if (payload.records && remoteUpdatedAt > getSyncUpdatedAt()) {
    records = migrateRecords(payload.records);
    writeStorage(syncUpdatedAtStorageKey, String(remoteUpdatedAt));
    writeRecords({ markUpdated: false, sync: false });
    changed = true;
  }

  const remoteOrderUpdatedAt = Number(payload.orderUpdatedAt) || 0;
  if (Array.isArray(payload.order) && remoteOrderUpdatedAt > getOrderUpdatedAt()) {
    const byId = new Map(medicines.map((medicine) => [medicine.id, medicine]));
    const ordered = payload.order.map((id) => byId.get(id)).filter(Boolean);
    const missing = medicines.filter((medicine) => !payload.order.includes(medicine.id));
    medicines = [...ordered, ...missing];
    writeStorage(orderUpdatedAtStorageKey, String(remoteOrderUpdatedAt));
    writeMedicineOrder({ markUpdated: false, sync: false });
    changed = true;
  }

  if (changed) {
    renderCards();
    renderSummary();
    renderMine();
  }

  return changed;
}

async function initCloudSync() {
  if (!cloudSyncId) return;

  try {
    if (Object.keys(records).length && !getSyncUpdatedAt()) markSyncUpdatedAt();
    if (!getOrderUpdatedAt()) markOrderUpdatedAt();
    if (customMedicines.length && !getCustomUpdatedAt()) markCustomUpdatedAt();

    const remotePayload = await fetchCloudPayload();
    const changed = applyCloudPayload(remotePayload);
    if (!remotePayload || changed || getSyncUpdatedAt() >= (Number(remotePayload.updatedAt) || 0)) {
      await saveCloudPayload(getCloudPayload());
    }
  } catch (error) {
    console.warn(error);
  }
}

function queueCloudSync() {
  if (!cloudSyncId || cloudSyncBusy) return;

  window.clearTimeout(cloudSyncTimer);
  cloudSyncTimer = window.setTimeout(async () => {
    cloudSyncBusy = true;
    try {
      await saveCloudPayload(getCloudPayload());
    } catch (error) {
      console.warn(error);
    } finally {
      cloudSyncBusy = false;
    }
  }, 450);
}

function formatDose(value) {
  return `${value}piece`;
}

function normalizeDose(value) {
  const amount = String(Number.parseFloat(String(value || "").replace("piece", "")));
  return formatDose(doseOptions.includes(amount) ? amount : "1");
}

function displayDose(value) {
  return String(value || "").replace("piece", "");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function doseAmount(dose) {
  const amount = Number.parseFloat(String(dose || "").replace("piece", ""));
  return Number.isFinite(amount) && amount > 0 ? amount : 1;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRecordDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return `${monthNames[month - 1]} ${day}, ${year}`;
}

function isSameDate(left, right) {
  return dateKey(left) === dateKey(right);
}

function getDayRecord(medId) {
  const day = dateKey(selectedDate);
  if (!records[day]) records[day] = {};
  if (!records[day][medId]) records[day][medId] = {};
  return records[day][medId];
}

function peekDayRecord(medId) {
  const day = records[dateKey(selectedDate)];
  return day && day[medId] ? day[medId] : {};
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function setSelectedMonth(year, monthIndex) {
  const day = Math.min(selectedDate.getDate(), daysInMonth(year, monthIndex));
  selectedDate = new Date(year, monthIndex, day);
  pickerYear = year;
}

function renderDates() {
  monthLabel.textContent = monthNames[selectedDate.getMonth()];
  dateStrip.innerHTML = "";

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const selectedDay = selectedDate.getDate();
  const days = daysInMonth(year, month);

  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month, day);
    const dayLabel = isSameDate(date, new Date()) ? "Today" : weekdays[date.getDay()];
    const button = document.createElement("button");
    button.className = `date-pill${day === selectedDay ? " active" : ""}`;
    button.type = "button";
    button.setAttribute("aria-label", `${monthNames[date.getMonth()]} ${date.getDate()}, ${weekdays[date.getDay()]}`);
    button.innerHTML = `
      <span class="date-number">${date.getDate()}</span>
      <span class="date-day">${dayLabel}</span>
    `;
    button.addEventListener("click", () => {
      selectedDate = date;
      render();
    });
    dateStrip.append(button);
  }

  requestAnimationFrame(() => {
    const activeDate = dateStrip.querySelector(".date-pill.active");
    if (!activeDate) return;

    const targetLeft = activeDate.offsetLeft + activeDate.offsetWidth / 2 - dateStrip.clientWidth / 2;
    dateStrip.scrollTo({ left: targetLeft, behavior: "auto" });
  });
}

function renderMonthPicker() {
  pickerYearLabel.textContent = String(pickerYear);
  monthGrid.innerHTML = "";

  monthNames.forEach((month, monthIndex) => {
    const button = document.createElement("button");
    const isActive = pickerYear === selectedDate.getFullYear() && monthIndex === selectedDate.getMonth();
    button.className = `month-option${isActive ? " active" : ""}`;
    button.type = "button";
    button.textContent = month;
    button.setAttribute("aria-label", `${month} ${pickerYear}`);
    button.addEventListener("click", () => {
      setSelectedMonth(pickerYear, monthIndex);
      monthPicker.hidden = true;
      render();
    });
    monthGrid.append(button);
  });
}

function renderCards() {
  cards.innerHTML = "";

  medicines.forEach((medicine) => {
    const record = peekDayRecord(medicine.id);
    const dose = record.dose || medicine.dose;
    const safeName = escapeHtml(medicine.name);
    const article = document.createElement("article");
    article.className = `med-card${record.done ? " done" : ""}`;
    article.dataset.medId = medicine.id;
    article.style.setProperty("--card-bg", medicine.bg);
    if (medicine.imgW) article.style.setProperty("--img-w", medicine.imgW);
    if (medicine.imgH) article.style.setProperty("--img-h", medicine.imgH);

    article.innerHTML = `
      <div class="image-box ${medicine.imageClass}">
        <img src="${medicine.image}" alt="${safeName}" />
      </div>
      <div class="med-copy">
        <div class="med-name"><span class="med-name-text">${safeName}</span></div>
        <button class="dose-button" type="button" aria-label="Change dose for ${safeName}">
          <span>${dose}</span>
          <span class="tiny-chevron"></span>
        </button>
      </div>
      <button class="check-button${record.done ? " done" : ""}" type="button" aria-label="Mark ${safeName} as taken">
        <img
          src="${record.done ? "./Property 1=compete.svg" : "./Property 1=Default.svg"}"
          alt=""
          aria-hidden="true"
        />
      </button>
    `;

    const doseButton = article.querySelector(".dose-button");
    doseButton.addEventListener("click", () => {
      openDoseSheet(medicine);
    });

    const checkButton = article.querySelector(".check-button");
    checkButton.addEventListener("click", () => {
      const nextRecord = getDayRecord(medicine.id);
      nextRecord.done = !nextRecord.done;
      if (!nextRecord.dose) nextRecord.dose = medicine.dose;
      nextRecord.updatedAt = Date.now();

      const icon = checkButton.querySelector("img");
      article.classList.toggle("done", nextRecord.done);
      checkButton.classList.toggle("done", nextRecord.done);
      icon.src = nextRecord.done ? "./Property 1=compete.svg" : "./Property 1=Default.svg";

      writeRecords();
      renderSummary();
      renderMine();
    });

    setupCardReorder(article);
    cards.append(article);
  });

  const addButton = document.createElement("button");
  addButton.className = "add-card";
  addButton.type = "button";
  addButton.setAttribute("aria-label", "Add medication");
  addButton.innerHTML = `
    <span class="add-icon" aria-hidden="true"></span>
    <span>添加</span>
  `;
  addButton.addEventListener("click", openAddSheet);
  cards.append(addButton);
}

function setupCardReorder(card) {
  let pressTimer = null;
  let startX = 0;
  let startY = 0;

  card.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest("button")) return;

    startX = event.clientX;
    startY = event.clientY;
    pressTimer = window.setTimeout(() => {
      startCardDrag(card, event);
    }, 400);
  });

  card.addEventListener("pointermove", (event) => {
    if (!pressTimer) return;
    const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (moved > 8) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
  });

  card.addEventListener("pointerup", () => {
    if (!pressTimer) return;
    window.clearTimeout(pressTimer);
    pressTimer = null;
  });

  card.addEventListener("pointercancel", () => {
    if (!pressTimer) return;
    window.clearTimeout(pressTimer);
    pressTimer = null;
  });
}

function startCardDrag(card, event) {
  const rect = card.getBoundingClientRect();
  const placeholder = document.createElement("div");
  placeholder.className = "med-card-placeholder";
  placeholder.style.height = `${rect.height}px`;
  cards.insertBefore(placeholder, card);

  dragState = {
    card,
    placeholder,
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };

  card.classList.add("dragging");
  card.style.left = `${rect.left}px`;
  card.style.top = `${rect.top}px`;
  card.style.width = `${rect.width}px`;
  card.style.height = `${rect.height}px`;
  card.setPointerCapture(event.pointerId);

  window.addEventListener("pointermove", moveDraggedCard);
  window.addEventListener("pointerup", finishCardDrag);
  window.addEventListener("pointercancel", finishCardDrag);
}

function moveDraggedCard(event) {
  if (!dragState) return;
  event.preventDefault();

  const { card, placeholder, offsetX, offsetY } = dragState;
  card.style.left = `${event.clientX - offsetX}px`;
  card.style.top = `${event.clientY - offsetY}px`;

  autoScrollCards(event.clientY);

  const siblings = [...cards.querySelectorAll(".med-card:not(.dragging)")];
  const target = siblings.find((item) => {
    const box = item.getBoundingClientRect();
    return event.clientY < box.top + box.height / 2;
  });

  if (target) {
    movePlaceholderBefore(target);
    return;
  }

  const addCard = cards.querySelector(".add-card");
  movePlaceholderBefore(addCard);
}

function movePlaceholderBefore(target) {
  if (!dragState || dragState.placeholder.nextElementSibling === target) return;

  animateCardReflow(() => {
    cards.insertBefore(dragState.placeholder, target);
  });
}

function animateCardReflow(mutator) {
  const items = [...cards.querySelectorAll(".med-card:not(.dragging), .add-card")];
  const firstRects = new Map(items.map((item) => [item, item.getBoundingClientRect()]));

  mutator();

  items.forEach((item) => {
    const first = firstRects.get(item);
    const last = item.getBoundingClientRect();
    const deltaX = first.left - last.left;
    const deltaY = first.top - last.top;

    if (!deltaX && !deltaY) return;

    item.classList.remove("reordering");
    item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    requestAnimationFrame(() => {
      item.classList.add("reordering");
      item.style.transform = "";
    });

    item.addEventListener(
      "transitionend",
      () => {
        item.classList.remove("reordering");
      },
      { once: true },
    );
  });
}

function autoScrollCards(pointerY) {
  const box = cards.getBoundingClientRect();
  const edge = 72;

  if (pointerY < box.top + edge) {
    cards.scrollTop -= 8;
  } else if (pointerY > box.bottom - edge) {
    cards.scrollTop += 8;
  }
}

function finishCardDrag() {
  if (!dragState) return;

  const { card, placeholder, pointerId } = dragState;
  placeholder.replaceWith(card);
  card.classList.remove("dragging");
  card.style.left = "";
  card.style.top = "";
  card.style.width = "";
  card.style.height = "";

  try {
    card.releasePointerCapture(pointerId);
  } catch {
    // Pointer capture can already be released by the browser.
  }

  window.removeEventListener("pointermove", moveDraggedCard);
  window.removeEventListener("pointerup", finishCardDrag);
  window.removeEventListener("pointercancel", finishCardDrag);
  dragState = null;

  updateMedicineOrderFromDom();
}

function updateMedicineOrderFromDom() {
  const orderedIds = [...cards.querySelectorAll(".med-card")].map((card) => card.dataset.medId);
  const byId = new Map(medicines.map((medicine) => [medicine.id, medicine]));
  medicines = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  writeMedicineOrder();
  renderMine();
}

function openDoseSheet(medicine) {
  activeDoseMedicine = medicine;
  const record = peekDayRecord(medicine.id);
  const currentDose = record.dose || medicine.dose;
  doseTitle.textContent = medicine.name;
  doseOptionsList.innerHTML = "";

  doseOptions.forEach((option) => {
    const optionText = formatDose(option);
    const button = document.createElement("button");
    button.className = `dose-option${optionText === currentDose ? " active" : ""}`;
    button.type = "button";
    button.textContent = option;
    button.setAttribute("aria-label", `${medicine.name} ${optionText}`);
    button.addEventListener("click", () => {
      const nextRecord = getDayRecord(medicine.id);
      nextRecord.dose = optionText;
      nextRecord.updatedAt = Date.now();
      writeRecords();
      closeDoseSheet();
      renderCards();
      renderMine();
    });
    doseOptionsList.append(button);
  });

  doseSheet.hidden = false;
}

function closeDoseSheet() {
  doseSheet.hidden = true;
  activeDoseMedicine = null;
}

function renderAddDoseOptions() {
  if (!addDoseOptions) return;

  addDoseOptions.innerHTML = "";
  doseOptions.forEach((option) => {
    const button = document.createElement("button");
    button.className = `dose-option${option === pendingMedicineDose ? " active" : ""}`;
    button.type = "button";
    button.textContent = option;
    button.setAttribute("aria-label", `默认剂量 ${option}piece`);
    button.addEventListener("click", () => {
      pendingMedicineDose = option;
      renderAddDoseOptions();
    });
    addDoseOptions.append(button);
  });
}

function openAddSheet() {
  if (!addSheet || !addMedicineForm || !addImagePreview) return;

  pendingMedicineDose = "1";
  pendingMedicineImage = "";
  addMedicineForm.reset();
  addImagePreview.classList.remove("has-image");
  addImagePreview.style.backgroundImage = "";
  renderAddDoseOptions();
  addSheet.hidden = false;
}

function closeAddSheet() {
  if (!addSheet) return;

  addSheet.hidden = true;
}

function createCustomMedicine(name, image, dose) {
  const index = customMedicines.length;
  return {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    color: customMedicineColors[index % customMedicineColors.length],
    dose: formatDose(dose || "1"),
    image,
    bg: "#f8f6f4",
    imageClass: "custom",
    imgW: "80px",
    imgH: "80px",
    custom: true,
  };
}

function addCustomMedicine(event) {
  event.preventDefault();
  if (!addNameInput) return;

  const name = addNameInput.value.trim();
  if (!name || !pendingMedicineImage) return;

  const medicine = createCustomMedicine(name.slice(0, 40), pendingMedicineImage, pendingMedicineDose);
  customMedicines.push(medicine);
  medicines.push(medicine);
  writeCustomMedicines();
  writeMedicineOrder();
  closeAddSheet();
  renderCards();
  renderMine();
}

function renderSummary() {
  const summaryCount = document.querySelector("#summaryCount");
  if (!summaryCount) return;

  const total = Object.values(records).reduce((sum, day) => {
    return sum + Object.values(day).filter((record) => record.done).length;
  }, 0);
  summaryCount.textContent = String(total);
}

function getMedicineStats(medicine) {
  const completedDates = Object.keys(records)
    .filter((key) => records[key] && records[key][medicine.id] && records[key][medicine.id].done)
    .sort();
  const lastDate = completedDates.length ? completedDates[completedDates.length - 1] : null;

  let streak = 0;
  const cursor = new Date();
  while (completedDates.includes(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const recent = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = dateKey(date);
    recent.push({
      label: isSameDate(date, new Date()) ? "T" : weekdays[date.getDay()].slice(0, 1),
      done: records[key] && records[key][medicine.id] && records[key][medicine.id].done,
    });
  }

  return {
    total: completedDates.length,
    lastDate,
    streak,
    recent,
  };
}

function getChartMonthDays() {
  const days = [];
  const year = chartMonthDate.getFullYear();
  const month = chartMonthDate.getMonth();
  const count = daysInMonth(year, month);

  for (let day = 1; day <= count; day += 1) {
    days.push(new Date(year, month, day));
  }

  return days;
}

function shiftChartMonth(delta) {
  chartMonthDate = new Date(chartMonthDate.getFullYear(), chartMonthDate.getMonth() + delta, 1);
  renderMine();
}

function renderMonthlyChart() {
  weeklyChart.innerHTML = "";

  const header = document.createElement("div");
  header.className = "chart-header";

  const title = document.createElement("h2");
  title.className = "chart-title";
  title.textContent = "Usage";

  const monthSwitch = document.createElement("div");
  monthSwitch.className = "chart-month-switch";

  const prevButton = document.createElement("button");
  prevButton.className = "chart-month-button";
  prevButton.type = "button";
  prevButton.setAttribute("aria-label", "Previous month");
  prevButton.innerHTML = `<span class="arrow-left" aria-hidden="true"></span>`;
  prevButton.addEventListener("click", () => shiftChartMonth(-1));

  const monthText = document.createElement("span");
  monthText.className = "chart-month-label";
  monthText.textContent = monthNames[chartMonthDate.getMonth()];

  const nextButton = document.createElement("button");
  nextButton.className = "chart-month-button";
  nextButton.type = "button";
  nextButton.setAttribute("aria-label", "Next month");
  nextButton.innerHTML = `<span class="arrow-right" aria-hidden="true"></span>`;
  nextButton.addEventListener("click", () => shiftChartMonth(1));

  monthSwitch.append(prevButton, monthText, nextButton);
  header.append(title, monthSwitch);

  const days = getChartMonthDays();
  const dayStacks = days.map((date) => {
    const key = dateKey(date);
    const dayRecord = records[key] || {};
    const entries = medicines
      .filter((medicine) => dayRecord[medicine.id] && dayRecord[medicine.id].done)
      .map((medicine) => ({
        medicine,
        amount: doseAmount(dayRecord[medicine.id].dose || medicine.dose),
      }));
    const total = entries.reduce((sum, entry) => sum + entry.amount, 0);

    return { date, key, entries, total };
  });
  const maxTotal = Math.max(
    1,
    ...dayStacks.map((day) => day.total),
  );

  const scroll = document.createElement("div");
  scroll.className = "chart-scroll";

  const bars = document.createElement("div");
  bars.className = "chart-bars";

  dayStacks.forEach(({ date, key, entries, total }) => {
    const column = document.createElement("div");
    column.className = `chart-day${isSameDate(date, new Date()) ? " today" : ""}`;
    column.setAttribute("aria-label", `${formatRecordDate(key)} ${total} total dose`);

    const bar = document.createElement("div");
    bar.className = "chart-bar";
    bar.style.height = total ? `${Math.max(18, (total / maxTotal) * 182)}px` : "0px";

    entries.forEach(({ medicine, amount }) => {
      const segment = document.createElement("span");
      segment.className = "chart-segment";
      segment.style.background = medicine.color;
      segment.style.flexGrow = String(amount);
      segment.title = `${medicine.name} ${amount}`;
      bar.append(segment);
    });

    const label = document.createElement("span");
    label.className = "chart-label";
    label.textContent = String(date.getDate()).padStart(2, "0");

    column.append(bar, label);
    bars.append(column);
  });

  scroll.append(bars);
  weeklyChart.append(header, scroll);

  requestAnimationFrame(() => {
    const todayColumn = weeklyChart.querySelector(".chart-day.today");
    if (!todayColumn) return;

    scroll.scrollLeft = Math.max(0, todayColumn.offsetLeft + todayColumn.offsetWidth - scroll.clientWidth);
    requestAnimationFrame(() => {
      const scrollRect = scroll.getBoundingClientRect();
      const todayRect = todayColumn.getBoundingClientRect();
      scroll.scrollLeft += todayRect.right - scrollRect.right;
    });
  });
}

function renderMine() {
  renderMonthlyChart();
  mineList.innerHTML = "";

  medicines.forEach((medicine) => {
    const stats = getMedicineStats(medicine);
    const safeName = escapeHtml(medicine.name);
    const item = document.createElement("article");
    item.className = "mine-card";
    item.style.setProperty("--card-bg", medicine.bg);
    if (medicine.imgW) item.style.setProperty("--img-w", medicine.imgW);
    if (medicine.imgH) item.style.setProperty("--img-h", medicine.imgH);

    item.innerHTML = `
      <div class="mine-head">
        <div class="image-box ${medicine.imageClass}">
          <img src="${medicine.image}" alt="${safeName}" />
        </div>
        <div class="mine-copy">
          <h2>${safeName}</h2>
          <p>${stats.lastDate ? `Last taken ${formatRecordDate(stats.lastDate)}` : "No records yet"}</p>
        </div>
      </div>
      <div class="mine-stats">
        <div>
          <strong>${stats.total}</strong>
          <span>Total</span>
        </div>
        <div>
          <strong>${stats.streak}</strong>
          <span>Streak</span>
        </div>
      </div>
    `;

    mineList.append(item);
  });
}

function showTab(tab) {
  const isHome = tab === "home";
  pageTitle.textContent = isHome ? "Daily Care" : "Mine";
  homeTab.classList.toggle("active", isHome);
  mineTab.classList.toggle("active", !isHome);
  monthButton.hidden = !isHome;
  dateStrip.hidden = !isHome;
  monthPicker.hidden = true;
  homeView.hidden = !isHome;
  mineView.hidden = isHome;
  renderSummary();
  if (!isHome) renderMine();
}

function render() {
  renderDates();
  renderMonthPicker();
  renderCards();
  renderSummary();
  renderMine();
}

monthButton.addEventListener("click", () => {
  pickerYear = selectedDate.getFullYear();
  monthPicker.hidden = !monthPicker.hidden;
  renderMonthPicker();
});

prevYear.addEventListener("click", () => {
  pickerYear -= 1;
  renderMonthPicker();
});

nextYear.addEventListener("click", () => {
  pickerYear += 1;
  renderMonthPicker();
});

document.addEventListener("click", (event) => {
  if (monthPicker.hidden) return;
  if (monthPicker.contains(event.target) || monthButton.contains(event.target)) return;
  monthPicker.hidden = true;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    monthPicker.hidden = true;
    closeDoseSheet();
    closeAddSheet();
  }
});

homeTab.addEventListener("click", () => showTab("home"));
mineTab.addEventListener("click", () => showTab("mine"));
doseBackdrop.addEventListener("click", closeDoseSheet);
doseClose.addEventListener("click", closeDoseSheet);
addBackdrop?.addEventListener("click", closeAddSheet);
addClose?.addEventListener("click", closeAddSheet);
addMedicineForm?.addEventListener("submit", addCustomMedicine);
addImageInput?.addEventListener("change", () => {
  const file = addImageInput.files && addImageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    pendingMedicineImage = String(reader.result || "");
    addImagePreview?.classList.add("has-image");
    if (addImagePreview) addImagePreview.style.backgroundImage = `url("${pendingMedicineImage}")`;
  });
  reader.readAsDataURL(file);
});
function clearStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    if (window.dailyCareStorageFallback) delete window.dailyCareStorageFallback[key];
  }
}

window.addEventListener("pageshow", () => {
  records = migrateRecords(readRecords());
  customMedicines = readCustomMedicines();
  medicines = applyMedicineOrder([...defaultMedicines, ...customMedicines]);
  writeRecords({ markUpdated: false, sync: false });
  window.dailyCareRecords = records;
  renderCards();
  renderSummary();
  renderMine();
  initCloudSync();
});

try {
  writeRecords({ markUpdated: false, sync: false });
  render();
  initCloudSync();
} catch (error) {
  cards.innerHTML = `<p class="load-error">Unable to load records. Refresh once or clear local records.</p>`;
  console.error(error);
}
