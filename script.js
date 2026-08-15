import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-database.js";

/* =========================
   FIREBASE INIT
========================= */
const firebaseConfig = {
    apiKey: "AIzaSyCC73AAM0FMnDJre7V6JM7_Jgtj0do1Fg4",
    databaseURL: "https://mrravistorebyssj-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mrravistorebyssj",
    appId: "1:149128166292:web:24d5049444e41ac0f02d81"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* =========================
   SHAWDY - CONSTANTS
========================= */
const ADMIN_1 = "94773109964";
const ADMIN_2 = "94743412102";
const OPEN_TIME = 990;   // 4:30 PM, Colombo time
const CLOSE_TIME = 1350; // 10:30 PM, Colombo time
const STORE_NAME = "SHAWDY STORE";

const topupProducts = [
    // =========================
    // DIAMONDS
    // =========================
    { id: "diamond-25", category: "diamond", name: "Diamond × 25", price: 100, image: "ASSETS/Top-Up/Diamonds/diamond-25.webp" },
    { id: "diamond-100", category: "diamond", name: "Diamond × 100", price: 330, image: "ASSETS/Top-Up/Diamonds/diamond-100.webp" },
    { id: "diamond-310", category: "diamond", name: "Diamond × 310", price: 1000, image: "ASSETS/Top-Up/Diamonds/diamond-310.webp" },
    { id: "diamond-520", category: "diamond", name: "Diamond × 520", price: 1680, image: "ASSETS/Top-Up/Diamonds/diamond-520.webp" },
    { id: "diamond-1060", category: "diamond", name: "Diamond × 1060", price: 3300, image: "ASSETS/Top-Up/Diamonds/diamond-1060.webp" },
    { id: "diamond-2180", category: "diamond", name: "Diamond × 2180", price: 6600, image: "ASSETS/Top-Up/Diamonds/diamond-2180.webp" },
    { id: "diamond-5600", category: "diamond", name: "Diamond × 5600", price: 16300, image: "ASSETS/Top-Up/Diamonds/diamond-5600.webp" },
    { id: "diamond-11500", category: "diamond", name: "Diamond × 11500", price: 33000, image: "ASSETS/Top-Up/Diamonds/diamond-11500.webp" },

    // =========================
    // MEMBERSHIP
    // =========================
    { id: "weekly-lite", category: "membership", name: "WEEKLY LITE", price: 130, image: "ASSETS/Top-Up/Memberships/weekly-lite.webp" },
    { id: "weekly", category: "membership", name: "Weekly", price: 560, image: "ASSETS/Top-Up/Memberships/weekly.webp" },
    { id: "monthly", category: "membership", name: "Monthly", price: 2800, image: "ASSETS/Top-Up/Memberships/monthly.webp" },

    // =========================
    // MEMBERSHIP PACKS
    // =========================
    { id: "little-pack", category: "membership-pack", name: "Little Pack", price: 1370, image: "ASSETS/Top-Up/Membership-Packs/little-pack.webp" },
    { id: "vip-pack", category: "membership-pack", name: "VIP PACK", price: 3340, image: "ASSETS/Top-Up/Membership-Packs/vip-pack.webp" },
    { id: "vip-special", category: "membership-pack", name: "VIP SPECIAL", price: 3460, image: "ASSETS/Top-Up/Membership-Packs/vip-special.webp" },
    { id: "big-pack", category: "membership-pack", name: "BIG PACK", price: 5020, image: "ASSETS/Top-Up/Membership-Packs/big-pack.webp" },
    { id: "super-vip", category: "membership-pack", name: "SUPER VIP", price: 6700, image: "ASSETS/Top-Up/Membership-Packs/super-vip.webp" },
    { id: "diamond-3000-pack", category: "membership-pack", name: "Diamond × 3000", price: 8380, image: "ASSETS/Top-Up/Membership-Packs/diamond-3000.webp" },
    { id: "diamond-5000-pack", category: "membership-pack", name: "Diamond × 5000", price: 13960, image: "ASSETS/Top-Up/Membership-Packs/diamond-5000.webp" },
    { id: "diamond-8000-pack", category: "membership-pack", name: "Diamond × 8000", price: 22360, image: "ASSETS/Top-Up/Membership-Packs/diamond-8000.webp" },
    { id: "diamond-10000-pack", category: "membership-pack", name: "Diamond × 10000", price: 27960, image: "ASSETS/Top-Up/Membership-Packs/diamond-10000.webp" }
];

/* =========================
   STATE + DOM CACHE
========================= */
const dom = {};
let popupOpen = false;
let pendingOrder = null;
let cooldown = false;
let firebaseBound = false;
let pendingTopupOrder = null;
let topupToastTimer = null;
const topupQuantities = new Map(topupProducts.map(product => [product.id, 0]));

function $(id) {
    if (dom[id]) return dom[id];
    dom[id] = document.getElementById(id);
    return dom[id];
}

function isMobile() {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

/* =========================
   STORE STATUS - COLOMBO TIME
========================= */
function getColomboMinutes() {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Colombo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).formatToParts(new Date());

        const hour = parseInt(parts.find(part => part.type === "hour")?.value || "0", 10);
        const minute = parseInt(parts.find(part => part.type === "minute")?.value || "0", 10);
        return (hour * 60) + minute;
    } catch (error) {
        console.error("Colombo time error:", error);
        return 0;
    }
}

function formatStoreTime(minutes) {
    let hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const suffix = hour >= 12 ? "PM" : "AM";
    hour %= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

function updateStoreStatus() {
    const dot = $("status-dot");
    const text = $("status-text");
    if (!dot || !text) return;

    try {
        const currentMinutes = getColomboMinutes();
        const isOpen = currentMinutes >= OPEN_TIME && currentMinutes < CLOSE_TIME;

        if (isOpen) {
            dot.style.cssText = "background:#32e58d;box-shadow:0 0 12px #32e58d";
            text.textContent = `OPEN NOW · CLOSES AT ${formatStoreTime(CLOSE_TIME)}`;
            text.style.color = "#32e58d";
        } else {
            dot.style.cssText = "background:#ff5f62;box-shadow:0 0 12px #ff5f62";
            text.textContent = `CLOSED · OPENS AT ${formatStoreTime(OPEN_TIME)}`;
            text.style.color = "#ff7779";
        }
    } catch (error) {
        console.error("Store status error:", error);
    }
}

/* =========================
   WHATSAPP SAFE ROUTER
========================= */
function openWhatsApp(number, message) {
    try {
        const encoded = encodeURIComponent(message);
        const url = isMobile()
            ? `https://wa.me/${number}?text=${encoded}`
            : `https://api.whatsapp.com/send?phone=${number}&text=${encoded}`;

        if (isMobile()) {
            window.location.href = url;
        } else {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    } catch (error) {
        console.error(error);
        alert("WhatsApp open failed");
    }
}

/* =========================
   FIREBASE COUNTERS
========================= */
async function safeIncrement(path) {
    if (!path) return;

    try {
        await runTransaction(ref(db, path), value => (value || 0) + 1);
    } catch (error) {
        console.error("Transaction failed", error);
    }
}

function bindCounter(id, path, suffix = " Sold") {
    const element = $(id);
    if (!element) return;

    onValue(ref(db, path), snapshot => {
        element.innerText = (snapshot.val() || 0) + suffix;
    });
}

function initCounters() {
    if (firebaseBound) return;
    firebaseBound = true;

    bindCounter("glory1-display", "sold_glory1");
    bindCounter("glory2-display", "sold_glory2");
    bindCounter("glory3-display", "sold_glory3");
    bindCounter("glory4-display", "sold_glory4");
    bindCounter("glory5-display", "sold_glory5");
    bindCounter("glory6-display", "sold_glory6");
    bindCounter("likes1-display", "sold_Likes1");
    bindCounter("likes2-display", "sold_Likes2");
    bindCounter("likes3-display", "sold_Likes3");
    bindCounter("sxs-display", "download_sxs", " Downloads");
}

/* =========================
   ADMIN SELECTION POPUP
========================= */
function resetPopupButtons() {
    const firstButton = $("adminBtn1");
    const secondButton = $("adminBtn2");
    if (firstButton) firstButton.disabled = false;
    if (secondButton) secondButton.disabled = false;
    cooldown = false;
}

function createPopup() {
    if ($("adminPopupWrap")) return;

    const wrap = document.createElement("div");
    wrap.id = "adminPopupWrap";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "adminTitle");

    wrap.innerHTML = `
        <div id="adminPopupBox">
            <div class="admin-modal-head">
                <button id="adminCloseBtn" type="button" aria-label="Close admin selection">×</button>
                <div id="adminTitle">Choose your admin</div>
                <div id="adminSub">Your order details will open securely in WhatsApp.</div>
            </div>

            <div class="admin-options">
                <button id="adminBtn1" class="adminBtn" type="button">
                    <img class="admin-avatar" src="ASSETS/Admins/shawdy-live.webp" alt="Shawdy admin profile" width="58" height="58">
                    <span class="admin-name"><strong>Shawdy</strong><small>Store admin 01</small></span>
                    <span class="admin-phone">077 310 9964</span>
                </button>

                <!--<button id="adminBtn2" class="adminBtn" type="button" disabled>
                    <img class="admin-avatar" src="ASSETS/Admins/minu-gaming.webp" alt="Minu admin profile" width="58" height="58">
                    <span class="admin-name"><strong>Minu</strong><small>Store admin 02</small></span>
                    <span class="admin-phone">077 000 0000</span>
                </button>-->
            </div>

            <p class="admin-safe-note">The counter updates only when you choose an admin and start the WhatsApp order.</p>
        </div>`;

    document.body.appendChild(wrap);

    const box = $("adminPopupBox");
    box.addEventListener("click", event => event.stopPropagation());
    wrap.addEventListener("click", closePopup);
    $("adminCloseBtn").addEventListener("click", closePopup);

    $("adminBtn1").addEventListener("click", event => {
        event.stopPropagation();
        handleAdmin(ADMIN_1);
    });

    $("adminBtn2")?.addEventListener("click", event => {
        event.stopPropagation();
        handleAdmin(ADMIN_2);
    });
}

function openPopup() {
    createPopup();
    resetPopupButtons();

    const popup = $("adminPopupWrap");
    const box = $("adminPopupBox");
    popup.style.display = "flex";
    requestAnimationFrame(() => box.classList.add("is-open"));
    document.body.style.overflow = "hidden";
    popupOpen = true;
    $("adminCloseBtn")?.focus();
}

function closePopup() {
    const popup = $("adminPopupWrap");
    const box = $("adminPopupBox");
    if (!popup || !box || !popupOpen) return;

    box.classList.remove("is-open");
    document.body.style.overflow = "";
    popupOpen = false;
    pendingOrder = null;

    setTimeout(() => {
        if (!popupOpen) popup.style.display = "none";
    }, 240);
}

async function handleAdmin(number) {
    if (!pendingOrder || cooldown) return;

    const order = { ...pendingOrder };
    cooldown = true;
    const firstButton = $("adminBtn1");
    const secondButton = $("adminBtn2");
    if (firstButton) firstButton.disabled = true;
    if (secondButton) secondButton.disabled = true;

    try {
        if (order.dbKey) await safeIncrement(order.dbKey);
        openWhatsApp(number, order.message);
        setTimeout(closePopup, 1200);
        setTimeout(resetPopupButtons, 6000);
    } catch (error) {
        console.error(error);
        resetPopupButtons();
        closePopup();
    }
}

/* =========================
   ORDER FUNCTIONS
========================= */
function buyGuild(squads, price) {
    const data = {
        1: ["3 Bots", "100K - 105K"],
        2: ["6 Bots", "150K - 200K"],
        3: ["9 Bots", "250K - 300K"],
        4: ["12 Bots", "300K - 350K"],
        5: ["15 Bots", "350K - 400K"],
        6: ["18 Bots", "400K - 450K"]
    }[squads] || ["N/A", "N/A"];

    pendingOrder = {
        dbKey: `sold_glory${squads}`,
        message: `${STORE_NAME}\n\nGuild Glory Order\nSquads: ${squads}\nBots: ${data[0]}\nGlory: ${data[1]}\nPrice: LKR ${price}\n\nPlease send me the payment and delivery details.`
    };

    openPopup();
}

function buyLikes(price) {
    const packages = {
        "1000": ["sold_Likes1", "7 Days Likes"],
        "2000": ["sold_Likes2", "14 Days Likes"],
        "4000": ["sold_Likes3", "28 Days Likes"]
    };

    const [dbKey = "", packageText = "Profile Likes"] = packages[price] || [];
    pendingOrder = {
        dbKey,
        message: `${STORE_NAME}\n\nProfile Likes Order\nPackage: ${packageText}\nPrice: LKR ${price}\n\nPlease send me the payment details for my Free Fire account.`
    };

    openPopup();
}

function contactNow(mode) {
    if (mode === "rare") {
        pendingOrder = {
            dbKey: "click_rare_uid",
            message: `${STORE_NAME}\n\nRare UID Request\nI want to buy a unique Free Fire UID. Please send the available options and current pricing details.`
        };
    } else {
        pendingOrder = {
            dbKey: "click_general_contact",
            message: `${STORE_NAME}\n\nHello! I am interested in your services. Can you help me with more information?`
        };
    }

    openPopup();
}

/* =========================
   DIAMOND STORE
========================= */
function formatPrice(value) {
    return `Rs. ${Number(value).toLocaleString("en-US")}`;
}

function getTopupProduct(productId) {
    return topupProducts.find(product => product.id === productId);
}

function getSelectedTopupItems() {
    return topupProducts
        .map(product => {
            const quantity = topupQuantities.get(product.id) || 0;
            return {
                ...product,
                quantity,
                lineTotal: product.price * quantity
            };
        })
        .filter(item => item.quantity > 0);
}

function createTopupCard(product) {
    const card = document.createElement("article");
    const imageSize = product.category === "diamond" ? 100 : 250;
    const imageClass = product.category === "diamond" ? " diamond-image" : "";
    card.className = "topup-card";
    card.dataset.productId = product.id;

    card.innerHTML = `
        <div class="topup-image-stage">
            <img class="topup-product-image${imageClass}" src="${product.image}" alt="${product.name} package artwork" width="${imageSize}" height="${imageSize}" loading="lazy" decoding="async">
        </div>
        <h4 class="topup-product-name">${product.name}</h4>
        <div class="topup-product-price yellow-price-glow">${formatPrice(product.price)}</div>
        <div class="topup-quantity" aria-label="Quantity for ${product.name}">
            <button class="topup-quantity-button" type="button" data-topup-action="decrease" data-product-id="${product.id}" aria-label="Decrease ${product.name} quantity" disabled>−</button>
            <output id="${product.id}-quantity" aria-live="polite">0</output>
            <button class="topup-quantity-button" type="button" data-topup-action="increase" data-product-id="${product.id}" aria-label="Increase ${product.name} quantity">+</button>
        </div>
        <div class="topup-line-total">
            <span>Line total</span>
            <strong id="${product.id}-line-total">Rs. 0</strong>
        </div>`;

    return card;
}

function renderTopupProducts() {
    const grids = {
        diamond: $("topupDiamondGrid"),
        membership: $("topupMembershipGrid"),
        "membership-pack": $("topupMembershipPackGrid")
    };

    Object.values(grids).forEach(grid => grid?.replaceChildren());
    topupProducts.forEach(product => grids[product.category]?.appendChild(createTopupCard(product)));
}

function updateTopupProductUI(productId) {
    const product = getTopupProduct(productId);
    const card = document.querySelector(`.topup-card[data-product-id="${productId}"]`);
    if (!product || !card) return;

    const quantity = topupQuantities.get(productId) || 0;
    const quantityOutput = $(`${productId}-quantity`);
    const lineTotal = $(`${productId}-line-total`);
    const decreaseButton = card.querySelector('[data-topup-action="decrease"]');

    if (quantityOutput) quantityOutput.value = quantity;
    if (lineTotal) lineTotal.textContent = formatPrice(product.price * quantity);
    if (decreaseButton) decreaseButton.disabled = quantity === 0;
    card.classList.toggle("is-selected", quantity > 0);
}

function updateTopupSummary() {
    const items = getSelectedTopupItems();
    const summaryList = $("topupSummaryList");
    const emptyState = $("topupSummaryEmpty");
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.lineTotal, 0);

    summaryList?.replaceChildren();
    items.forEach(item => {
        const row = document.createElement("li");
        row.className = "topup-summary-item";
        row.innerHTML = `
            <div>
                <strong>${item.name}</strong>
                <span>${item.quantity} × ${formatPrice(item.price)}</span>
            </div>
            <b>${formatPrice(item.lineTotal)}</b>`;
        summaryList?.appendChild(row);
    });

    if (emptyState) emptyState.hidden = items.length > 0;
    if (summaryList) summaryList.hidden = items.length === 0;
    if ($("topupTotalItems")) $("topupTotalItems").textContent = totalItems;
    if ($("topupGrandTotal")) $("topupGrandTotal").textContent = formatPrice(totalPrice);
    if ($("topupCartCount")) $("topupCartCount").textContent = `${totalItems} ${totalItems === 1 ? "item" : "items"}`;
}

function changeTopupQuantity(productId, delta) {
    if (!getTopupProduct(productId)) return;
    const current = topupQuantities.get(productId) || 0;
    topupQuantities.set(productId, Math.max(0, current + delta));
    updateTopupProductUI(productId);
    updateTopupSummary();
}

function showTopupToast(message) {
    const toast = $("topupToast");
    if (!toast) return;

    clearTimeout(topupToastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    topupToastTimer = setTimeout(() => toast.classList.remove("is-visible"), 4200);
}

function buildTopupOrder() {
    const items = getSelectedTopupItems();
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const playerUid = $("topupPlayerUid")?.value.trim() || "";
    const orderLines = items.map((item, index) => [
        `${index + 1}. ${item.name}`,
        `Quantity: ${item.quantity}`,
        `Price: ${formatPrice(item.price)} each`,
        `Subtotal: ${formatPrice(item.lineTotal)}`
    ].join("\n"));

    const message = [
        `💎 SHAWDY STORE`,
        `TOP-UP ORDER`,
        ``,
        `Hello, I would like to place the following order:`,
        ``,
        ...orderLines.flatMap((line, index) => index < orderLines.length - 1 ? [line, ""] : [line]),
        ``,
        `-------------------------`,
        `Total Items: ${totalQuantity}`,
        `Total Amount: ${formatPrice(totalPrice)}`,
        `Player UID: ${playerUid || "Not provided"}`,
        ``,
        `Please confirm my order.`
    ].join("\n");

    return { items, totalQuantity, totalPrice, playerUid, message };
}

function submitTopupOrder() {
    const order = buildTopupOrder();
    if (order.items.length === 0) {
        showTopupToast("Please select at least one package before ordering.");
        return;
    }

    pendingTopupOrder = order;
    pendingOrder = {
        dbKey: "click_topup_order",
        message: pendingTopupOrder.message
    };
    openPopup();
}

function initTopupStore() {
    const section = $("diamond-store");
    if (!section) return;

    renderTopupProducts();
    updateTopupSummary();

    section.addEventListener("click", event => {
        const button = event.target.closest("[data-topup-action]");
        if (!button) return;
        const delta = button.dataset.topupAction === "increase" ? 1 : -1;
        changeTopupQuantity(button.dataset.productId, delta);
    });

    $("topupOrderButton")?.addEventListener("click", submitTopupOrder);
}

function scrollToId(id) {
    const element = $(id);
    if (element) element.scrollIntoView({ behavior: "smooth" });
}

/* =========================
   MOBILE NAVIGATION
========================= */
function initMobileNavigation() {
    const toggle = $("navToggle");
    const panel = $("primaryNav");
    if (!toggle || !panel) return;

    const closeMenu = () => {
        toggle.classList.remove("is-active");
        panel.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation");
    };

    toggle.addEventListener("click", () => {
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        toggle.classList.toggle("is-active", !isOpen);
        panel.classList.toggle("is-open", !isOpen);
        toggle.setAttribute("aria-expanded", String(!isOpen));
        toggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    });

    panel.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (popupOpen) closePopup();
            closeMenu();
        }
    });
}

/* =========================
   RESPONSIVE CAROUSEL
========================= */
function initPremiumBannerCarousel() {
    const track = $("carouselTrack");
    const dotContainer = $("carouselDots");
    const previousButton = $("carouselPrev");
    const nextButton = $("carouselNext");
    const slides = track?.querySelectorAll(".carousel-slide") || [];
    if (!track || !dotContainer || slides.length === 0) return;

    let currentIndex = 0;
    let carouselInterval;
    let startX = 0;
    const intervalTime = 5000;

    dotContainer.replaceChildren();
    slides.forEach((_, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel-dot";
        dot.setAttribute("aria-label", `Show highlight ${index + 1}`);
        if (index === 0) dot.classList.add("active");
        dot.addEventListener("click", () => {
            goToSlide(index);
            resetAutoplay();
        });
        dotContainer.appendChild(dot);
    });

    const dots = dotContainer.querySelectorAll(".carousel-dot");

    function updateCarousel() {
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        dots.forEach((dot, index) => {
            dot.classList.toggle("active", index === currentIndex);
            dot.setAttribute("aria-current", index === currentIndex ? "true" : "false");
        });
    }

    function goToSlide(index) {
        currentIndex = (index + slides.length) % slides.length;
        updateCarousel();
    }

    function nextSlide() {
        goToSlide(currentIndex + 1);
    }

    function previousSlide() {
        goToSlide(currentIndex - 1);
    }

    function startAutoplay() {
        clearInterval(carouselInterval);
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            carouselInterval = setInterval(nextSlide, intervalTime);
        }
    }

    function resetAutoplay() {
        startAutoplay();
    }

    previousButton?.addEventListener("click", () => {
        previousSlide();
        resetAutoplay();
    });

    nextButton?.addEventListener("click", () => {
        nextSlide();
        resetAutoplay();
    });

    track.addEventListener("touchstart", event => {
        startX = event.touches[0].clientX;
    }, { passive: true });

    track.addEventListener("touchend", event => {
        const distance = startX - event.changedTouches[0].clientX;
        if (Math.abs(distance) < 50) return;
        distance > 0 ? nextSlide() : previousSlide();
        resetAutoplay();
    }, { passive: true });

    track.addEventListener("mouseenter", () => clearInterval(carouselInterval));
    track.addEventListener("mouseleave", startAutoplay);
    document.addEventListener("visibilitychange", () => {
        document.hidden ? clearInterval(carouselInterval) : startAutoplay();
    });

    updateCarousel();
    startAutoplay();
}

/* =========================
   EXISTING SOCIAL ROUTERS
========================= */
window.socialRedirect = (type, url) => {
    try {
        if (isMobile()) window.location.href = url;
        else window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
        console.error(type + " redirect failed:", error);
    }
};

window.whatsappRedirect = (type, id) => {
    try {
        const url = type === "channel"
            ? `https://whatsapp.com/channel/${id}`
            : `https://chat.whatsapp.com/${id}`;

        if (isMobile()) window.location.href = url;
        else window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
        console.error("WhatsApp redirect failed:", error);
    }
};

/* =========================
   INIT + GLOBAL EXPORTS
========================= */
window.addEventListener("DOMContentLoaded", () => {
    updateStoreStatus();
    setInterval(updateStoreStatus, 30000);
    initCounters();
    initTopupStore();
    createPopup();
    initMobileNavigation();
    initPremiumBannerCarousel();
});

window.buyGuild = buyGuild;
window.buyLikes = buyLikes;
window.contactNow = contactNow;
window.scrollToId = scrollToId;
window.getTopupOrderPreview = buildTopupOrder;
