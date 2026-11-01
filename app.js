/* ============================================================
   SUPABASE SOZLAMALARI
   ============================================================ */
const SUPABASE_URL  = "https://iqewvqoxjhyyecipdohv.supabase.co";
const SUPABASE_ANON = "sb_publishable_Dpjg-tDUt51x-8eLV2Limg_iLJC3wsk";

const TABLE_PRODUCTS = "products";
const TABLE_MARKUPS  = "price_markups";
const PER_PAGE = 20;

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ============================================================
   HOLAT
   ============================================================ */
const state = {
  query: "",
  activeFilters: {},     // { model: "...", type: "..." }
  page: 1,
  total: 0,
  markups: {},
  cart: [],
};

/* ============================================================
   DOM
   ============================================================ */
const dom = {
  searchInput: document.getElementById("searchInput"),
  searchBtn:   document.getElementById("searchBtn"),
  clearBtn:    document.getElementById("clearBtn"),
  grid:        document.getElementById("grid"),
  pagination:  document.getElementById("pagination"),
  resultsInfo: document.getElementById("resultsInfo"),
  loader:      document.getElementById("loader"),
  errorBox:    document.getElementById("errorBox"),
  brandBtns:   document.getElementById("brandBtns"),   // HTML'da shu id — lekin mazmuni MODELLAR
  typeBtns:    document.getElementById("typeBtns"),

  cartToggle:   document.getElementById("cartToggle"),
  cartBadge:    document.getElementById("cartBadge"),
  cartPanel:    document.getElementById("cartPanel"),
  cartBackdrop: document.getElementById("cartBackdrop"),
  cartClose:    document.getElementById("cartClose"),
  cartItems:    document.getElementById("cartItems"),
  cartTotal:    document.getElementById("cartTotal"),
  cartCheckout: document.getElementById("cartCheckout"),
  cartClear:    document.getElementById("cartClear"),
  toastWrap:    document.getElementById("toastWrap"),
};

/* ============================================================
   YORDAMCHI
   ============================================================ */
function formatPrice(n) {
  if (n === null || n === undefined || isNaN(Number(n))) return "—";
  return Number(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function showLoader(v) { dom.loader.classList.toggle("show", v); }

function showError(title, msg) {
  dom.errorBox.classList.add("show");
  dom.errorBox.innerHTML =
    `<div class="error-inner"><strong>⚠ ${esc(title)}</strong>${esc(msg)}</div>`;
}
function hideError() { dom.errorBox.classList.remove("show"); dom.errorBox.innerHTML = ""; }

function toast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  dom.toastWrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

/* ============================================================
   SAVAT — localStorage
   ============================================================ */
const CART_KEY = "zapchast_cart_v1";

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    state.cart = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(state.cart)) state.cart = [];
  } catch (e) {
    state.cart = [];
  }
}

function saveCartToStorage() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); }
  catch (e) { console.warn("localStorage xato:", e); }
}

function findInCart(id) {
  return state.cart.find((it) => String(it.id) === String(id));
}

function addToCart(product) {
  const markup = state.markups[product.type] || 0;
  const base   = Number(product.price) || 0;
  const final  = base + markup;

  const existing = findInCart(product.id);
  if (existing) {
    existing.qty += 1;
    toast(`Soni +1`, "success");
  } else {
    state.cart.push({
      id:         product.id,
      model:      product.model,
      phoneModel: product.brand || "",
      phoneBrand: product.phone || "",
      type:       product.type,
      price:      final,
      qty:        1,
    });
    toast(`Savatga qo'shildi`, "success");
  }

  saveCartToStorage();
  updateCartUI();
  updateProductButtons();
}

function removeFromCart(id) {
  state.cart = state.cart.filter((it) => String(it.id) !== String(id));
  saveCartToStorage();
  updateCartUI();
  updateProductButtons();
}

function changeQty(id, delta) {
  const it = findInCart(id);
  if (!it) return;
  it.qty += delta;
  if (it.qty <= 0) { removeFromCart(id); return; }
  saveCartToStorage();
  updateCartUI();
  updateProductButtons();
}

function clearCart() {
  if (state.cart.length === 0) return;
  if (!confirm("Savatni tozalashni tasdiqlaysizmi?")) return;
  state.cart = [];
  saveCartToStorage();
  updateCartUI();
  updateProductButtons();
  toast("Savat tozalandi");
}

/* Savat UI yangilash */
function updateCartUI() {
  const totalQty = state.cart.reduce((s, it) => s + it.qty, 0);
  dom.cartBadge.textContent = totalQty;
  dom.cartBadge.classList.toggle("show", totalQty > 0);

  if (state.cart.length === 0) {
    dom.cartItems.innerHTML = `
      <div class="cart-empty">
        <span>🛒</span>
        Savat bo'sh.<br>Mahsulot qo'shish uchun "Savatga" tugmasini bosing.
      </div>`;
  } else {
    dom.cartItems.innerHTML = state.cart.map((it) => `
      <div class="cart-item">
        <div class="ci-head">
          <div class="ci-title">${esc(it.phoneModel || it.model || "—")}</div>
          <button class="ci-remove" data-action="remove" data-id="${esc(it.id)}" title="O'chirish">✕</button>
        </div>
        <div class="ci-meta">
          Kod: ${esc(it.model || "—")}
          ${it.phoneBrand ? ` · ${esc(it.phoneBrand)}` : ""}
          · ${esc(it.type || "—")}
        </div>
        <div class="ci-bottom">
          <div class="ci-qty">
            <button data-action="dec" data-id="${esc(it.id)}">−</button>
            <span>${it.qty}</span>
            <button data-action="inc" data-id="${esc(it.id)}">+</button>
          </div>
          <div class="ci-price">${formatPrice(it.price * it.qty)}</div>
        </div>
      </div>
    `).join("");

    dom.cartItems.querySelectorAll('[data-action="remove"]').forEach((b) =>
      b.addEventListener("click", () => removeFromCart(b.dataset.id))
    );
    dom.cartItems.querySelectorAll('[data-action="inc"]').forEach((b) =>
      b.addEventListener("click", () => changeQty(b.dataset.id, +1))
    );
    dom.cartItems.querySelectorAll('[data-action="dec"]').forEach((b) =>
      b.addEventListener("click", () => changeQty(b.dataset.id, -1))
    );
  }

  const total = state.cart.reduce((s, it) => s + it.price * it.qty, 0);
  dom.cartTotal.textContent = formatPrice(total);
  dom.cartCheckout.disabled = state.cart.length === 0;
}

/* Kartochkadagi tugmalarni yangilash */
function updateProductButtons() {
  dom.grid.querySelectorAll(".add-btn").forEach((btn) => {
    const id = btn.dataset.id;
    const inCart = !!findInCart(id);
    btn.classList.toggle("in-cart", inCart);
    btn.innerHTML = inCart ? "✓ Savatda" : "🛒 Savatga";
  });
  dom.grid.querySelectorAll(".card").forEach((card) => {
    const id = card.dataset.id;
    card.classList.toggle("in-cart", !!findInCart(id));
  });
}

function openCart() {
  dom.cartPanel.classList.add("show");
  dom.cartBackdrop.classList.add("show");
}
function closeCart() {
  dom.cartPanel.classList.remove("show");
  dom.cartBackdrop.classList.remove("show");
}

/* ============================================================
   USTAMALAR
   ============================================================ */
async function loadMarkups() {
  try {
    const { data, error } = await sb.from(TABLE_MARKUPS).select("type, markup");
    if (error) throw error;

    state.markups = {};
    (data || []).forEach((r) => {
      if (r.type) state.markups[r.type] = Number(r.markup) || 0;
    });
  } catch (err) {
    console.error("[markups] xato:", err);
    state.markups = {};
  }
}

/* ============================================================
   FILTRLAR
   ------------------------------------------------------------
   MODEL filtri → brand ustuni (telefon modellari: y1s, IP XS...)
   TURI  filtri → type  ustuni (Ekran, Batareya...)
   ============================================================ */
async function loadFilters() {
  try {
    // Noёб telefon modellari (brand ustuni)
    const { data: models, error: e1 } = await sb
      .from(TABLE_PRODUCTS)
      .select("brand")
      .order("brand", { ascending: true });
    if (e1) throw e1;

    // Noёб zapchast turlari (type ustuni)
    const { data: types, error: e2 } = await sb
      .from(TABLE_PRODUCTS)
      .select("type")
      .order("type", { ascending: true });
    if (e2) throw e2;

    const uniqueModels = [...new Set(
      (models || []).map(r => r.brand).filter(v => v && v.trim() !== "")
    )].sort((a, b) => a.localeCompare(b, "uz", { sensitivity: "base" }));

    const uniqueTypes = [...new Set(
      (types || []).map(r => r.type).filter(v => v && v.trim() !== "")
    )].sort((a, b) => a.localeCompare(b, "uz", { sensitivity: "base" }));

    // brandBtns — HTML'dagi id, lekin ichida MODELLAR chiqadi
    renderFilterButtons(dom.brandBtns, "model", uniqueModels);
    renderFilterButtons(dom.typeBtns,  "type",  uniqueTypes);
  } catch (err) {
    console.error("[filters] xato:", err);
    if (dom.brandBtns) dom.brandBtns.innerHTML = `<span class="filter-loading">Yuklab bo'lmadi</span>`;
    if (dom.typeBtns)  dom.typeBtns.innerHTML  = `<span class="filter-loading">Yuklab bo'lmadi</span>`;
  }
}

function renderFilterButtons(container, ftype, values) {
  if (!container) return;
  if (!values || values.length === 0) {
    container.innerHTML = `<span class="filter-loading">Ma'lumot yo'q</span>`;
    return;
  }

  container.innerHTML = values
    .map((v) => `<button class="filter-btn" data-ftype="${esc(ftype)}" data-fval="${esc(v)}">${esc(v)}</button>`)
    .join("");

  container.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ftype = btn.dataset.ftype;
      const fval  = btn.dataset.fval;

      if (state.activeFilters[ftype] === fval) {
        delete state.activeFilters[ftype];
        btn.classList.remove("active");
      } else {
        container.querySelectorAll(`.filter-btn[data-ftype="${ftype}"]`)
          .forEach((b) => b.classList.remove("active"));
        state.activeFilters[ftype] = fval;
        btn.classList.add("active");
      }

      state.page = 1;
      fetchProducts();
    });
  });
}

/* ============================================================
   MAHSULOTLAR
   ============================================================ */
async function fetchProducts() {
  showLoader(true);
  hideError();

  const from = (state.page - 1) * PER_PAGE;
  const to   = from + PER_PAGE - 1;

  try {
    let query = sb.from(TABLE_PRODUCTS).select("*", { count: "exact" });

    /* --- Filtrlar --- */
    // MODEL filtri → brand ustuni (telefon modeli)
    if (state.activeFilters.model) {
      query = query.eq("brand", state.activeFilters.model);
    }
    // TURI filtri → type ustuni
    if (state.activeFilters.type) {
      query = query.eq("type", state.activeFilters.type);
    }

    /* --- Qidiruv --- */
    if (state.query) {
      const q = state.query.replace(/[%_\\]/g, "");
      query = query.or(
        `model.ilike.%${q}%,brand.ilike.%${q}%,phone.ilike.%${q}%,type.ilike.%${q}%`
      );
    }

    query = query.order("created_at", { ascending: false }).range(from, to);
    const { data, error, count } = await query;
    if (error) throw error;

    state.total = count || 0;
    renderProducts(data || []);
    renderPagination();
  } catch (err) {
    console.error("[products] xato:", err);
    showError("Ma'lumotlarni yuklab bo'lmadi", err.message || "Noma'lum xato");
    dom.grid.innerHTML = "";
    dom.pagination.innerHTML = "";
    dom.resultsInfo.textContent = "";
  } finally {
    showLoader(false);
  }
}

/* ============================================================
   RENDER — MAHSULOTLAR
   ============================================================ */
function renderProducts(items) {
  if (!items || items.length === 0) {
    dom.grid.innerHTML = `<div class="empty"><span>🔍</span>Hech qanday mahsulot topilmadi.</div>`;
    dom.resultsInfo.textContent = "0 ta natija";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
  dom.resultsInfo.textContent =
    `Jami ${state.total} ta natija — ${state.page}-sahifa (${totalPages} sahifadan)`;

  dom.grid.innerHTML = items.map((p) => {
    const markup = state.markups[p.type] || 0;
    const base   = Number(p.price) || 0;
    const final  = base + markup;

    // Bazada: brand = telefon modeli, phone = telefon markasi
    const phoneModel = p.brand || "";
    const phoneBrand = p.phone || "";
    const title = phoneModel.trim() !== "" ? phoneModel : (p.model || "—");
    const inCart = !!findInCart(p.id);

    return `
      <div class="card ${inCart ? "in-cart" : ""}" data-id="${esc(p.id)}">
        <div class="model">${esc(title)}</div>
        <div class="row"><span class="k">Zapchast kodi:</span><span class="v">${esc(p.model || "—")}</span></div>
        <div class="row"><span class="k">Telefon markasi:</span><span class="v brands">${esc(phoneBrand || "—")}</span></div>
        <div class="row"><span class="k">Telefon modeli:</span><span class="v">${esc(phoneModel || "—")}</span></div>
        <div class="row"><span class="k">Zapchast turi:</span><span class="v"><span class="type-tag">${esc(p.type || "—")}</span></span></div>

        <div class="price">
          <div class="price-main">${formatPrice(final)}</div>
          
        </div>

        <button class="add-btn ${inCart ? "in-cart" : ""}" data-id="${esc(p.id)}">
          ${inCart ? "✓ Savatda" : "🛒 Savatga"}
        </button>
      </div>
    `;
  }).join("");

  dom.grid.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const product = items.find((x) => String(x.id) === String(id));
      if (product) addToCart(product);
    });
  });
}

/* ============================================================
   PAGINATION
   ============================================================ */
function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE));
  dom.pagination.innerHTML = "";
  if (totalPages <= 1) return;

  const addBtn = (label, page, disabled = false, active = false) => {
    const b = document.createElement("button");
    b.className = "page-btn" + (active ? " active" : "");
    b.textContent = label;
    b.disabled = disabled;
    if (!disabled && !active) {
      b.onclick = () => {
        state.page = page;
        fetchProducts();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    }
    dom.pagination.appendChild(b);
  };

  const addDots = () => {
    const s = document.createElement("span");
    s.className = "page-dots";
    s.textContent = "…";
    dom.pagination.appendChild(s);
  };

  addBtn("«", state.page - 1, state.page === 1);

  const pages = [];
  const cur = state.page;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - cur) <= 2) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }
  pages.forEach((p) => p === "..." ? addDots() : addBtn(p, p, false, p === cur));

  addBtn("»", state.page + 1, state.page === totalPages);
}

/* ============================================================
   HODISALAR
   ============================================================ */
dom.cartToggle.addEventListener("click", openCart);
dom.cartClose.addEventListener("click", closeCart);
dom.cartBackdrop.addEventListener("click", closeCart);
dom.cartClear.addEventListener("click", clearCart);

dom.cartCheckout.addEventListener("click", () => {
  if (state.cart.length === 0) return;
  const total = state.cart.reduce((s, it) => s + it.price * it.qty, 0);
  const qty   = state.cart.reduce((s, it) => s + it.qty, 0);
  toast(`✅ Buyurtma qabul qilindi: ${qty} ta · ${formatPrice(total)}`, "success");
  setTimeout(() => {
    state.cart = [];
    saveCartToStorage();
    updateCartUI();
    updateProductButtons();
    closeCart();
  }, 800);
});

dom.searchBtn.addEventListener("click", () => {
  state.query = dom.searchInput.value.trim();
  state.page = 1;
  fetchProducts();
});
dom.searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    state.query = dom.searchInput.value.trim();
    state.page = 1;
    fetchProducts();
  }
});
let debounceTimer;
dom.searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    state.query = dom.searchInput.value.trim();
    state.page = 1;
    fetchProducts();
  }, 350);
});

dom.clearBtn.addEventListener("click", () => {
  state.activeFilters = {};
  state.query = "";
  dom.searchInput.value = "";
  document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  state.page = 1;
  fetchProducts();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCart();
});

/* ============================================================
   ISHGA TUSHIRISH
   ============================================================ */
async function init() {
  loadCartFromStorage();
  updateCartUI();

  await loadMarkups();
  await Promise.all([loadFilters(), fetchProducts()]);

  updateProductButtons();
}

init();