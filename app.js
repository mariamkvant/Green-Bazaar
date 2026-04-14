// === Page Navigation ===
let currentPlantId = null;
let currentCheckoutPlant = null;
let currentConvo = null;
let allListings = []; // cached from API

function showPage(page, data) {
  document.querySelectorAll("[id^='page-']").forEach(p => p.style.display = "none");
  const el = document.getElementById("page-" + page);
  if (el) el.style.display = "block";
  window.scrollTo(0, 0);
  if (page === "plant" && data) renderPlantDetail(data);
  if (page === "dashboard") renderDashboard();
  if (page === "messages") renderMessages();
  if (page === "checkout" && data) renderCheckout(data);
  if (page === "home") loadListings();
  if (page === "favorites") renderFavorites();
  if (page === "notifications") renderNotifications();
  if (page === "seller" && data) renderSellerProfile(data);
  if (page === "admin") renderAdminPage();
  if (page === "profile") renderMyProfile();
  if (page === "people") {} // static page, search is interactive
  if (page === "news") renderNewsPage();
  if (page === "support") {} // static forms
}

// === Modal Helpers ===
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

// HTML sanitizer for rendering user content
function esc(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open");
  if (e.target.dataset.close) closeModal(e.target.dataset.close);
  if (e.target.classList.contains("privacy-link")) { e.preventDefault(); openModal("privacyModal"); }
});

// === Auth UI ===
async function updateAuthUI() {
  const session = Store.getSession();
  document.getElementById("navLoggedOut").style.display = session ? "none" : "flex";
  document.getElementById("navLoggedIn").style.display = session ? "flex" : "none";
  if (session) {
    document.getElementById("navUserName").textContent = session.name;
    document.getElementById("navUserInitial").textContent = (session.name||'?')[0].toUpperCase();
    document.getElementById("navAddListing").style.display = "inline"; // All users can sell
    try {
      const [unreadMsg, unreadNotif] = await Promise.all([Store.getUnreadCount(), Store.getNotifCount()]);
      const msgBadge = document.getElementById("msgBadge");
      if (unreadMsg > 0) { msgBadge.textContent = unreadMsg; msgBadge.style.display = "inline"; } else msgBadge.style.display = "none";
      const notifBadge = document.getElementById("notifBadge");
      if (unreadNotif > 0) { notifBadge.textContent = unreadNotif; notifBadge.style.display = "inline"; } else notifBadge.style.display = "none";
      // Check admin
      try {
        const admin = await Store.checkAdmin();
        document.getElementById("navAdmin").style.display = admin.is_admin ? "inline" : "none";
      } catch { document.getElementById("navAdmin").style.display = "none"; }
    } catch {}
  }
}

// === Load & Render Listings ===
async function loadListings() {
  try {
    allListings = await Store.getListings();
    renderPlants(filterPlants());
  } catch (e) { console.error('Failed to load listings:', e); }
}

function renderPlants(list) {
  const grid = document.getElementById("plantGrid");
  const noResults = document.getElementById("noResults");
  if (list.length === 0) { grid.innerHTML = ""; noResults.style.display = "block"; return; }
  noResults.style.display = "none";
  grid.innerHTML = list.map(p => {
    const badgeClass = p.stock === "limited" ? "badge-limited" : p.stock === "preorder" ? "badge-preorder" : "badge-available";
    const badgeText = p.stock === "limited" ? "Limited Stock" : p.stock === "preorder" ? "Pre-order" : "Available";
    const rating = p.seller_rating ? `⭐ ${p.seller_rating}` : '';
    const isFav = favIds.includes(p.id);
    const verified = p.verified_seller ? '<span class="verified-badge">✓</span>' : '';
    return `
      <article class="card" style="cursor:pointer;">
        <div class="card-img-wrap" onclick="showPage('plant', ${p.id})">
          <img class="card-img" src="${p.image || 'placeholder.svg'}" alt="${p.name}" loading="lazy"
               onerror="this.src='placeholder.svg'">
          <button class="fav-btn ${isFav ? 'fav-active' : ''}" onclick="event.stopPropagation();toggleFav(${p.id})" aria-label="Favorite">${isFav ? '❤️' : '🤍'}</button>
        </div>
        <div class="card-body" onclick="showPage('plant', ${p.id})">
          <span class="card-badge ${badgeClass}">${badgeText}</span>
          ${p.best_planting ? `<span class="planting-badge">🌱 Plant: ${p.best_planting}</span>` : ''}
          <h3 class="card-title">${esc(p.name)}</h3>
          <p class="card-latin">${esc(p.latin || '')}</p>
          <p class="card-desc">${esc((p.description || '').substring(0, 100))}...</p>
          <div class="card-meta">
            <span>📏 ${p.height || ''}</span>
            <span>🌱 ${p.age || ''}</span>
            <span>📍 ${p.seller_city || ''}</span>
          </div>
          ${rating ? `<div class="card-rating">${rating} (${p.seller_review_count || 0} reviews)</div>` : ''}
          <div class="card-footer">
            <div><span class="card-price">₾${p.price}</span><span class="card-price-unit"> / ${p.unit}</span></div>
            <span class="card-seller" onclick="event.stopPropagation();showPage('seller',${p.seller_id})">by <strong>${p.seller_name || ''}${verified}</strong></span>
          </div>
        </div>
        <button class="share-btn" onclick="event.stopPropagation();shareListing(${p.id},'${(p.name||'').replace(/'/g,"\\'")}')">↗ Share</button>
      </article>`;
  }).join("");
}

let activeFilter = "all";
let favIds = [];

async function loadFavIds() {
  if (Store.isLoggedIn()) { try { favIds = await Store.getFavoriteIds(); } catch { favIds = []; } }
}

function filterPlants() {
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const sort = document.getElementById("sortSelect")?.value || "newest";
  const cityFilter = document.getElementById("filterCity")?.value || "";
  const priceFilter = document.getElementById("filterPrice")?.value || "";

  let filtered = allListings.filter(p => {
    const matchFilter = activeFilter === "all" || p.category === activeFilter;
    const matchSearch = !query || (p.name + (p.latin||'') + (p.description||'') + (p.seller_name||'') + (p.seller_city||'')).toLowerCase().includes(query);
    const matchCity = !cityFilter || (p.seller_city || '').includes(cityFilter);
    let matchPrice = true;
    if (priceFilter) { const [min, max] = priceFilter.split('-').map(Number); matchPrice = p.price >= min && p.price <= max; }
    return matchFilter && matchSearch && matchCity && matchPrice;
  });

  if (sort === "price_low") filtered.sort((a, b) => a.price - b.price);
  else if (sort === "price_high") filtered.sort((a, b) => b.price - a.price);
  else if (sort === "rating") filtered.sort((a, b) => (b.seller_rating || 0) - (a.seller_rating || 0));
  return filtered;
}

// === Plant Detail ===
async function renderPlantDetail(plantId) {
  currentPlantId = plantId;
  try {
    const p = await Store.getListing(plantId);
    if (!p) return;
    const reviews = p.reviews || [];
    const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
    const healthyPct = reviews.length ? Math.round(reviews.filter(r => r.condition === "healthy").length / reviews.length * 100) : 0;

    document.getElementById("plantDetail").innerHTML = `
      <div class="detail-grid">
        <div class="detail-img-wrap">
          <img src="${p.image || 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop'}" alt="${p.name}" class="detail-img" onerror="this.style.background='#e8f5e2';">
        </div>
        <div class="detail-info">
          <span class="card-badge ${p.stock === 'limited' ? 'badge-limited' : p.stock === 'preorder' ? 'badge-preorder' : 'badge-available'}">${p.stock === 'limited' ? 'Limited Stock' : p.stock === 'preorder' ? 'Pre-order' : 'Available'}</span>
          <h1>${p.name}</h1>
          <p class="card-latin">${p.latin || ''}</p>
          ${avgRating ? `<div class="detail-rating">⭐ ${avgRating}/5 from ${reviews.length} reviews ${healthyPct ? `· 🌿 ${healthyPct}% arrived healthy` : ""}</div>` : '<div class="detail-rating">No reviews yet</div>'}
          <p class="detail-desc">${p.description}</p>
          <div class="detail-specs">
            <div class="spec"><span class="spec-label">Height</span><span>${p.height || 'N/A'}</span></div>
            <div class="spec"><span class="spec-label">Age</span><span>${p.age || 'N/A'}</span></div>
            <div class="spec"><span class="spec-label">Location</span><span>📍 ${p.seller_city || ''}</span></div>
            <div class="spec"><span class="spec-label">Seller</span><span>${p.seller_name || ''}</span></div>
          </div>
          <div class="detail-price">
            <span class="card-price" style="font-size:1.6rem;">₾${p.price}</span>
            <span class="card-price-unit"> / ${p.unit}</span>
          </div>
          <div class="detail-actions">
            <button class="btn btn-primary btn-lg" onclick="handleBuyNow(${p.id})">🛒 Buy Now — Escrow Protected</button>
            <button class="btn btn-outline btn-lg" onclick="openRequestModal(${p.id}, ${p.seller_id}, '${(p.seller_name||'').replace(/'/g,"\\'")}', '${(p.name||'').replace(/'/g,"\\'")}', ${p.price})">📩 Request This Plant</button>
            <button class="btn btn-outline" onclick="handleMessageSeller(${p.id}, ${p.seller_id}, '${(p.seller_name||'').replace(/'/g,"\\'")}', '${(p.name||'').replace(/'/g,"\\'")}')">💬 Message Seller</button>
          </div>
          <div class="escrow-badge"><span>🔒</span> Payment held in escrow until you confirm delivery. 3-day inspection window.</div>
          ${(p.watering || p.sunlight || p.soil || p.frost_tolerance || p.best_planting) ? `
          <div class="care-guide">
            <h3>🌱 ${t('careGuide')}</h3>
            <div class="care-grid">
              ${p.watering ? `<div class="care-item"><span class="care-label">💧 ${t('watering')}</span><span>${p.watering}</span></div>` : ''}
              ${p.sunlight ? `<div class="care-item"><span class="care-label">☀️ ${t('sunlight')}</span><span>${p.sunlight}</span></div>` : ''}
              ${p.soil ? `<div class="care-item"><span class="care-label">🪴 ${t('soil')}</span><span>${p.soil}</span></div>` : ''}
              ${p.frost_tolerance ? `<div class="care-item"><span class="care-label">❄️ ${t('frost')}</span><span>${p.frost_tolerance}</span></div>` : ''}
              ${p.best_planting ? `<div class="care-item"><span class="care-label">📅 ${t('bestPlanting')}</span><span>${p.best_planting}</span></div>` : ''}
            </div>
          </div>` : ''}
          <div class="seller-mini" onclick="showPage('seller',${p.seller_id})" style="cursor:pointer;">
            <div class="seller-avatar-sm">${(p.seller_name||'?')[0]}</div>
            <div>
              <strong>${p.seller_name} ${p.verified_seller ? '<span class="verified-badge">✓</span>' : ''}</strong>
              <p>📍 ${p.seller_city} · ⭐ ${p.seller_rating||0} (${p.seller_review_count||0} reviews)</p>
            </div>
            <span class="link" style="margin-left:auto;">${t('viewProfile')} →</span>
          </div>
        </div>
      </div>`;

    // Fun facts
    const facts = getFunFacts(p.category);
    const factsHtml = facts.length ? `<div class="funfacts-section">
      <h2>${t('funFacts')}</h2>
      <div class="funfacts-grid">${facts.map((f, i) => `<div class="funfact-card"><span class="funfact-num">${i+1}</span><p>${f}</p></div>`).join("")}</div>
    </div>` : '';

    // Recommended products
    const recs = getRecommendedProducts(p.category);
    const recsHtml = recs.length ? `<div class="recs-products-section">
      <h2>${t('recommendedProducts')}</h2>
      <div class="recs-products-grid">${recs.map(r => `<div class="rec-product-card">
        <span class="rec-type">${r.type}</span><h4>${r.name}</h4><p>${r.desc}</p>
      </div>`).join("")}</div>
    </div>` : '';

    document.getElementById("plantDetail").innerHTML += factsHtml + recsHtml;

    const reviewsHtml = reviews.length ? reviews.map(r => `
      <div class="review-card">
        <div class="review-header">
          <span class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
          <span class="review-condition ${r.condition === 'healthy' ? 'condition-healthy' : r.condition === 'good' ? 'condition-good' : 'condition-bad'}">
            ${r.condition === 'healthy' ? '🌿 Arrived Healthy' : r.condition === 'good' ? '👍 Good' : '⚠️ Issues'}
          </span>
        </div>
        <p class="review-text">${r.comment || "No comment"}</p>
        ${r.photos ? `<div class="review-photos">${JSON.parse(r.photos).map(src => `<img src="${src}" alt="Review photo" class="review-photo">`).join("")}</div>` : ""}
        <p class="review-meta">by ${r.buyer_name} · ${new Date(r.created_at).toLocaleDateString()}</p>
      </div>`).join("") : '<p class="no-reviews">No reviews yet.</p>';
    document.getElementById("reviewsSection").innerHTML = `<h2>Reviews</h2>${reviewsHtml}`;
    // Load similar plants
    loadSimilarPlants(plantId);
  } catch (e) { console.error(e); showToast("Failed to load plant details"); }
}

// === Buy / Message ===
function handleBuyNow(plantId) {
  if (!Store.isLoggedIn()) { showToast("Please log in or register to buy"); openModal("loginModal"); return; }
  const session = Store.getSession();
  if (session.type === "seller") { showToast("Switch to a buyer account to purchase"); return; }
  showPage("checkout", plantId);
}

async function handleMessageSeller(plantId, sellerId, sellerName, plantName) {
  if (!Store.isLoggedIn()) { showToast("Please log in to message sellers"); openModal("loginModal"); return; }
  try {
    await Store.sendMessage({ receiver_id: sellerId, listing_id: plantId, body: `Hi, I'm interested in your ${plantName}. Is it still available?` });
    showToast("Message sent!");
    showPage("messages");
  } catch (e) { showToast(e.message); }
}

// === Checkout ===
async function renderCheckout(plantId) {
  try {
    const p = await Store.getListing(plantId);
    if (!p) return;
    currentCheckoutPlant = p;
    document.getElementById("checkoutSummary").innerHTML = `
      <div class="checkout-item">
        <img src="${p.image || ''}" alt="${esc(p.name)}" class="checkout-img" onerror="this.style.background='#EDE9E0';">
        <div><h3>${esc(p.name)}</h3><p class="card-latin">${esc(p.latin || '')}</p><p>📍 ${esc(p.seller_city)} · by ${esc(p.seller_name)}</p></div>
      </div>`;
    // Show seller delivery option if available
    const sellerOpt = document.getElementById("sellerDeliveryOption");
    if (p.delivery_fee !== undefined && p.delivery_fee !== null) {
      sellerOpt.style.display = "block";
      const fee = parseInt(p.delivery_fee) || 0;
      document.getElementById("sellerDeliveryLabel").textContent = `Seller Delivery ${fee > 0 ? '(+₾' + fee + ')' : '(Free)'}${p.delivery_note ? ' — ' + p.delivery_note : ''}`;
    } else {
      sellerOpt.style.display = "none";
    }
    updateOrderTotal();
    document.getElementById("checkoutBack").onclick = (e) => { e.preventDefault(); showPage("plant", plantId); };
  } catch (e) { showToast("Failed to load checkout"); }
}

function updateOrderTotal() {
  if (!currentCheckoutPlant) return;
  const p = currentCheckoutPlant;
  const delivery = document.querySelector('input[name="delivery"]:checked').value;
  let deliveryCost = 0;
  if (delivery === 'courier') deliveryCost = 10;
  else if (delivery === 'seller') deliveryCost = parseInt(p.delivery_fee) || 0;
  const serviceFee = Math.round(p.price * 0.07);
  const total = p.price + deliveryCost + serviceFee;
  document.getElementById("orderTotal").innerHTML = `
    <div class="total-row"><span>Plant price</span><span>₾${p.price}</span></div>
    <div class="total-row"><span>Delivery</span><span>${deliveryCost ? "₾" + deliveryCost : "Free"}</span></div>
    <div class="total-row"><span>Service fee (7%)</span><span>₾${serviceFee}</span></div>
    <div class="total-row total-final"><span>Total (held in escrow)</span><span>₾${total}</span></div>`;
}

document.addEventListener("change", (e) => {
  if (e.target.name === "delivery") {
    document.getElementById("deliveryAddress").style.display = e.target.value === "courier" ? "block" : "none";
    updateOrderTotal();
  }
  if (e.target.name === "payment") {
    document.getElementById("cardFields").style.display = e.target.value === "card" ? "block" : "none";
    document.getElementById("transferFields").style.display = e.target.value === "transfer" ? "block" : "none";
  }
});

document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentCheckoutPlant) return;
  try {
    const order = await Store.createOrder({
      listing_id: currentCheckoutPlant.id,
      delivery_method: document.querySelector('input[name="delivery"]:checked').value,
      delivery_address: document.getElementById("addressInput").value,
      payment_method: document.querySelector('input[name="payment"]:checked').value
    });
    showToast(`Order placed! Payment held in escrow.`);
    showPage("dashboard");
  } catch (e) { showToast(e.message); }
});

// === Dashboard ===
async function renderDashboard() {
  if (!Store.isLoggedIn()) { showPage("home"); return; }
  const session = Store.getSession();
  try {
    const [orders, disputes, dashStats] = await Promise.all([
      Store.getMyOrders(), Store.getMyDisputes(), Store.getDashboardStats().catch(() => null)
    ]);

    // Stats + activity header
    let headerHtml = '';
    if (dashStats) {
      headerHtml = `<div class="dash-stats-bar">
        <div class="dash-stat"><span class="stat-num">${dashStats.trust_score}/100</span><span class="stat-label">Trust</span></div>
        <div class="dash-stat"><span class="stat-num">₾${dashStats.stats.total_spent}</span><span class="stat-label">Spent</span></div>
        <div class="dash-stat"><span class="stat-num">₾${dashStats.stats.total_earned}</span><span class="stat-label">Earned</span></div>
        <div class="dash-stat"><span class="stat-num">${dashStats.stats.completed_orders}</span><span class="stat-label">Done</span></div>
        <div class="dash-stat"><span class="stat-num">${dashStats.user.rating||0}</span><span class="stat-label">Rating</span></div>
      </div>
      <div class="dash-quick-links">
        <a onclick="showPage('home')">Browse</a><a onclick="openModal('listingModal')">+ Sell</a>
        <a onclick="showPage('messages')">Messages</a><a onclick="showPage('favorites')">Favorites</a><a onclick="showPage('support')">Help</a>
      </div>
      ${dashStats.recent_activity.length ? `<details class="dash-section" open><summary>Recent Activity</summary>
        ${dashStats.recent_activity.slice(0,5).map(a => `<div class="activity-item"><span>${a.type==='order'?'Order':'Review'}: ${esc(a.plant_name)} — ${a.status}</span><small>${new Date(a.created_at).toLocaleDateString()}</small></div>`).join("")}
      </details>` : ''}
      ${dashStats.predictions.length ? `<details class="dash-section"><summary>Seller Insights</summary>
        ${dashStats.predictions.map(p => `<div class="prediction-card"><strong>${esc(p.category)}</strong><span>${p.orders} orders · ~${p.avgDaysToSell}d avg</span></div>`).join("")}
      </details>` : ''}`;
    }

    document.getElementById("dashContent").innerHTML = headerHtml;

    document.querySelectorAll(".dash-tab").forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll(".dash-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        renderDashTab(tab.dataset.tab, orders, disputes, session);
      };
    });
    renderDashTab("orders", orders, disputes, session);
  } catch (e) { console.error(e); }
}

async function renderDashTab(tab, orders, disputes, session) {
  const content = document.getElementById("dashContent");
  if (tab === "orders") {
    const buyOrders = orders.filter(o => o.buyer_id === session.id);
    if (!buyOrders.length) { content.innerHTML = '<p class="dash-empty">No orders yet. <a href="#" onclick="showPage(\'home\')">Browse plants</a></p>'; return; }
    content.innerHTML = buyOrders.map(o => renderOrderCard(o, "buyer")).join("");
  } else if (tab === "sales") {
    const sales = orders.filter(o => o.seller_id === session.id);
    if (!sales.length) { content.innerHTML = '<p class="dash-empty">No sales yet.</p>'; return; }
    content.innerHTML = sales.map(o => renderOrderCard(o, "seller")).join("");
  } else if (tab === "listings") {
    try {
      const myListings = await Store.getMyListings();
      if (!myListings.length) {
        content.innerHTML = session.type === "seller"
          ? '<p class="dash-empty">No listings yet. <a href="#" onclick="openModal(\'listingModal\')">Create your first listing</a></p>'
          : '<p class="dash-empty">Only seller accounts can create listings.</p>';
        return;
      }
      content.innerHTML = `<div class="grid">${myListings.map(l => `
        <div class="card listing-card">
          <img class="card-img" src="${l.image || 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop'}" alt="${l.name}" onerror="this.style.background='#e8f5e2';">
          <div class="card-body">
            <span class="card-badge ${l.active ? 'badge-available' : 'badge-limited'}">${l.active ? 'Active' : 'Inactive'}</span>
            <h3 class="card-title">${l.name}</h3>
            <p class="card-latin">${l.latin || ''}</p>
            <div class="card-footer"><span class="card-price">₾${l.price} <span class="card-price-unit">/ ${l.unit}</span></span></div>
            <div class="order-actions" style="margin-top:10px;">
              <button class="btn btn-outline btn-sm" onclick="openEditListing(${l.id})">✏️ Edit</button>
              <button class="btn btn-outline btn-sm" onclick="toggleListing(${l.id}, ${l.active})">${l.active ? '⏸ Deactivate' : '▶ Activate'}</button>
              <button class="btn btn-outline btn-sm" style="border-color:#7A3B2E;color:#7A3B2E;" onclick="deleteListingApi(${l.id})">🗑 Delete</button>
            </div>
          </div>
        </div>`).join("")}</div>`;
    } catch (e) { content.innerHTML = '<p class="dash-empty">Failed to load listings.</p>'; }
  } else if (tab === "disputes") {
    if (!disputes.length) { content.innerHTML = '<p class="dash-empty">No disputes. That\'s great!</p>'; return; }
    content.innerHTML = disputes.map(d => `
      <div class="order-card dispute-card">
        <div class="order-header"><span class="order-id">DSP-${d.id}</span><span class="order-status" style="background:#d32f2f">${d.status.toUpperCase()}</span></div>
        <p>Order #${d.order_id} · Reason: ${d.reason}</p><p>${d.description || ''}</p>
        <p class="order-date">Opened: ${new Date(d.created_at).toLocaleDateString()}</p>
      </div>`).join("");
  }
}

function renderOrderCard(o, role) {
  const statusColors = { paid: "#4A7C8F", accepted: "#8B9E7C", shipped: "#B8704B", delivered: "#2A4139", completed: "#2A4139", disputed: "#7A3B2E", cancelled: "#999" };
  const escrowColors = { held: "#B8704B", released: "#2A4139", refunded: "#999" };

  // Step progress tracker
  const allSteps = ['paid', 'accepted', 'shipped', 'delivered', 'completed'];
  const currentIdx = allSteps.indexOf(o.status);
  const isCancelled = o.status === 'cancelled' || o.status === 'disputed';
  const stepLabels = { paid: '💳 Paid', accepted: '✅ Accepted', shipped: '📦 Shipped', delivered: '📬 Received', completed: '🌿 Completed' };
  const stepsHtml = allSteps.map((s, i) => {
    const state = isCancelled ? 'step-cancelled' : i < currentIdx ? 'step-done' : i === currentIdx ? 'step-active' : 'step-pending';
    return `<div class="progress-step ${state}"><div class="step-dot"></div><span>${stepLabels[s]}</span></div>`;
  }).join('<div class="step-line"></div>');

  // Actions based on status + role
  let actions = "";
  if (role === "seller" && o.status === "paid") {
    actions = `<button class="btn btn-primary btn-sm" onclick="orderAction(${o.id},'accept')">✅ Accept Order</button>
               <button class="btn btn-outline btn-sm" onclick="orderAction(${o.id},'decline')">❌ Decline</button>`;
  }
  if (role === "seller" && o.status === "accepted") {
    actions = `<button class="btn btn-primary btn-sm" onclick="orderAction(${o.id},'ship')">📦 Mark as Shipped / Ready</button>`;
  }
  if (role === "buyer" && o.status === "shipped") {
    actions = `<button class="btn btn-primary btn-sm" onclick="orderAction(${o.id},'delivered')">📬 I Received the Plant</button>`;
  }
  if (role === "buyer" && o.status === "delivered") {
    const dl = o.inspection_deadline ? new Date(o.inspection_deadline) : null;
    const days = dl ? Math.max(0, Math.ceil((dl - new Date()) / 86400000)) : 3;
    actions = `<div class="inspection-notice">🔍 Inspection window: ${days} days remaining</div>
      <button class="btn btn-primary btn-sm" onclick="orderAction(${o.id},'confirm')">🌿 Plant is Healthy — Release Payment</button>
      <button class="btn btn-outline btn-sm" onclick="openDisputeModal(${o.id})">⚠️ Report Issue</button>`;
  }
  if (role === "buyer" && o.status === "completed") {
    actions = `<button class="btn btn-outline btn-sm" onclick="openReviewModal(${o.id}, ${o.listing_id}, ${o.seller_id})">⭐ Leave Review</button>`;
  }
  // Cancel option for buyer before shipping
  if (role === "buyer" && ['paid', 'accepted'].includes(o.status)) {
    actions += `<button class="btn btn-outline btn-sm" style="border-color:#7A3B2E;color:#7A3B2E;" onclick="orderAction(${o.id},'cancel')">🚫 Cancel Order</button>`;
  }
  // Nudge option
  if (!['completed', 'cancelled', 'disputed'].includes(o.status)) {
    actions += `<button class="btn btn-outline btn-sm" onclick="orderAction(${o.id},'nudge')">👋 Send Reminder</button>`;
  }

  // Status message
  const waitingFor = {
    paid: role === 'seller' ? 'Action needed: Accept or decline this order' : 'Waiting for seller to accept...',
    accepted: role === 'seller' ? 'Action needed: Ship the plant or mark as ready for pickup' : 'Seller is preparing your plant...',
    shipped: role === 'buyer' ? 'Action needed: Confirm you received the plant' : 'Waiting for buyer to confirm delivery...',
    delivered: role === 'buyer' ? 'Action needed: Inspect the plant and confirm it\'s healthy' : 'Buyer is inspecting the plant (3-day window)...',
    completed: '🎉 Order complete! Payment released.',
    cancelled: '🚫 Order cancelled.',
    disputed: '⚠️ Dispute in progress. Our team is reviewing.',
  };

  return `<div class="order-card ${isCancelled ? 'order-cancelled' : ''}">
    <div class="order-header"><span class="order-id">#${o.id}</span><div>
      <span class="order-status" style="background:${statusColors[o.status]||'#888'}">${o.status.toUpperCase()}</span>
      <span class="escrow-status" style="background:${escrowColors[o.escrow_status]||'#888'}">Escrow: ${o.escrow_status}</span>
    </div></div>
    <div class="order-body">
      <img src="${o.plant_image||''}" alt="${o.plant_name}" class="order-img" onerror="this.style.background='#EDE9E0';">
      <div><h3>${o.plant_name}</h3>
        <p>${role==="buyer" ? "Seller: "+o.seller_name : "Buyer: "+o.buyer_name}</p>
        <p>Delivery: ${o.delivery_method==="courier" ? "🚚 Courier" : "🏪 Pickup"}</p>
        <p class="order-total">Total: ₾${o.total}</p>
      </div>
    </div>
    <div class="progress-tracker">${stepsHtml}</div>
    <div class="order-waiting">${waitingFor[o.status] || ''}</div>
    <div class="order-actions">${actions}</div>
  </div>`;
}

async function orderAction(orderId, action) {
  try {
    await Store.updateOrderStatus(orderId, action);
    const msgs = { ship: "Marked as shipped!", delivered: "Delivery confirmed! 3-day inspection started.", confirm: "Payment released! Please leave a review." };
    showToast(msgs[action] || "Updated!");
    renderDashboard();
  } catch (e) { showToast(e.message); }
}

// === Messages ===
async function renderMessages() {
  if (!Store.isLoggedIn()) { showPage("home"); return; }
  const session = Store.getSession();
  try {
    const convos = await Store.getConversations();
    allConversations = convos; // cache for search filtering
    const list = document.getElementById("msgList");
    const chat = document.getElementById("msgChat");
    if (!convos.length) { list.innerHTML = '<p class="msg-empty">No messages yet</p>'; chat.innerHTML = '<p class="msg-empty">Select a conversation</p>'; return; }
    list.innerHTML = convos.map((c, i) => {
      const lastMsg = c.messages[c.messages.length - 1];
      const unread = c.messages.filter(m => m.receiver_id === session.id && !m.is_read).length;
      return `<div class="msg-item ${i === 0 ? 'active' : ''}" data-idx="${i}">
        <div class="msg-item-header"><strong>${c.otherName}</strong>${unread ? `<span class="msg-unread">${unread}</span>` : ""}</div>
        <p class="msg-preview">${(lastMsg.body||'').substring(0, 50)}...</p>
        ${c.orderId ? `<span class="msg-order">Order #${c.orderId}</span>` : ""}
      </div>`;
    }).join("");
    list.querySelectorAll(".msg-item").forEach(item => {
      item.addEventListener("click", () => {
        list.querySelectorAll(".msg-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        const convo = convos[parseInt(item.dataset.idx)];
        currentConvo = convo;
        Store.markRead(convo.otherId);
        renderChat(convo, session);
      });
    });
    if (convos.length) { currentConvo = convos[0]; Store.markRead(convos[0].otherId); renderChat(convos[0], session); }
  } catch (e) { console.error(e); }
}

function renderChat(convo, session) {
  const chat = document.getElementById("msgChat");
  chat.innerHTML = `
    <div class="chat-header"><strong>${convo.otherName}</strong>${convo.orderId ? ` · Order #${convo.orderId}` : ""}</div>
    <div class="chat-messages" id="chatMessages">
      ${convo.messages.map(m => {
        let msgBody = esc(m.body);
        // Render inline photos
        msgBody = msgBody.replace(/\[photo\](.*?)\[\/photo\]/g, '<img src="$1" class="chat-msg-photo" alt="Photo">');
        return `<div class="chat-msg ${m.sender_id === session.id ? 'msg-mine' : 'msg-theirs'}">
        <p>${msgBody}</p><small>${new Date(m.created_at).toLocaleString()}</small>
      </div>`;}).join("")}
    </div>
    <form class="chat-input" id="chatForm">
      <input type="file" id="chatPhoto" accept="image/*" style="display:none;">
      <button type="button" class="btn btn-outline btn-sm chat-photo-btn" onclick="document.getElementById('chatPhoto').click()">📷</button>
      <input type="text" id="chatText" placeholder="Type a message...">
      <button type="submit" class="btn btn-primary">Send</button>
    </form>
    <div class="chat-photo-preview" id="chatPhotoPreview"></div>`;
  document.getElementById("chatMessages").scrollTop = 99999;

  // Photo preview in chat
  let chatPhotoData = null;
  document.getElementById("chatPhoto").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      chatPhotoData = e.target.result;
      document.getElementById("chatPhotoPreview").innerHTML = `
        <div class="chat-preview-wrap">
          <img src="${chatPhotoData}" alt="Photo">
          <button type="button" onclick="chatPhotoData=null;document.getElementById('chatPhotoPreview').innerHTML='';">✕</button>
        </div>`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("chatText").value.trim();
    if (!text && !chatPhotoData) return;
    try {
      let body = text;
      if (chatPhotoData) {
        body = (text ? text + '\n' : '') + `[photo]${chatPhotoData}[/photo]`;
      }
      await Store.sendMessage({ receiver_id: convo.otherId, order_id: convo.orderId, body });
      document.getElementById("chatText").value = "";
      chatPhotoData = null;
      document.getElementById("chatPhotoPreview").innerHTML = "";
      renderMessages();
    } catch (err) { showToast(err.message); }
  });
}

// === Review Modal ===
let reviewOrderId = null, reviewListingId = null, reviewSellerId = null;
function openReviewModal(orderId, listingId, sellerId) {
  reviewOrderId = orderId; reviewListingId = listingId; reviewSellerId = sellerId;
  document.getElementById("reviewOrderInfo").innerHTML = `<p>Order #${orderId}</p>`;
  document.getElementById("ratingValue").value = "0";
  document.querySelectorAll("#starRating .star").forEach(s => s.textContent = "☆");
  openModal("reviewModal");
}
document.getElementById("starRating").addEventListener("click", (e) => {
  if (!e.target.classList.contains("star")) return;
  const val = parseInt(e.target.dataset.val);
  document.getElementById("ratingValue").value = val;
  document.querySelectorAll("#starRating .star").forEach(s => { s.textContent = parseInt(s.dataset.val) <= val ? "★" : "☆"; });
});
// Review photo handling
let reviewPhotos = [];
document.getElementById("reviewPhotos").addEventListener("change", (e) => {
  const files = Array.from(e.target.files).slice(0, 3);
  reviewPhotos = [];
  const preview = document.getElementById("reviewPhotoPreview");
  preview.innerHTML = "";
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      reviewPhotos.push(ev.target.result);
      preview.innerHTML = reviewPhotos.map((src, i) => `
        <div class="photo-thumb">
          <img src="${src}" alt="Review photo ${i+1}">
          <button type="button" class="photo-remove" onclick="removeReviewPhoto(${i})">×</button>
        </div>`).join("");
    };
    reader.readAsDataURL(file);
  });
});
function removeReviewPhoto(idx) {
  reviewPhotos.splice(idx, 1);
  const preview = document.getElementById("reviewPhotoPreview");
  preview.innerHTML = reviewPhotos.map((src, i) => `
    <div class="photo-thumb">
      <img src="${src}" alt="Review photo ${i+1}">
      <button type="button" class="photo-remove" onclick="removeReviewPhoto(${i})">×</button>
    </div>`).join("");
}

document.getElementById("reviewForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const rating = parseInt(document.getElementById("ratingValue").value);
  if (!rating) { showToast("Please select a rating"); return; }
  const condition = document.querySelector('input[name="condition"]:checked');
  if (!condition) { showToast("Please select plant condition"); return; }
  try {
    await Store.addReview({ order_id: reviewOrderId, rating, condition: condition.value, comment: document.getElementById("reviewText").value, photos: reviewPhotos });
    closeModal("reviewModal"); showToast("Review submitted!"); reviewPhotos = []; document.getElementById("reviewPhotoPreview").innerHTML = ""; renderDashboard();
  } catch (err) { showToast(err.message); }
});

// === Dispute Modal ===
let disputeOrderId = null;
function openDisputeModal(orderId) { disputeOrderId = orderId; document.getElementById("disputeOrderInfo").innerHTML = `<p>Order #${orderId}</p>`; openModal("disputeModal"); }
document.getElementById("disputeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await Store.createDispute({
      order_id: disputeOrderId,
      reason: document.getElementById("disputeReason").value,
      description: document.getElementById("disputeDesc").value,
      requested_resolution: document.querySelector('input[name="resolution"]:checked').value
    });
    closeModal("disputeModal"); showToast("Dispute submitted. Review within 48 hours."); renderDashboard();
  } catch (err) { showToast(err.message); }
});

// === Plant Request ===
let reqPlantId = null, reqSellerId = null, reqSellerName = '', reqPlantName = '', reqPrice = 0;

function openRequestModal(plantId, sellerId, sellerName, plantName, price) {
  if (!Store.isLoggedIn()) { showToast("Please log in to send a request"); openModal("loginModal"); return; }
  reqPlantId = plantId; reqSellerId = sellerId; reqSellerName = sellerName; reqPlantName = plantName; reqPrice = price;
  document.getElementById("requestPlantInfo").innerHTML = `
    <div class="info-box"><strong>${plantName}</strong> · ₾${price} · by ${sellerName}</div>`;
  document.getElementById("reqQuantity").value = 1;
  updateRequestEstimate();
  openModal("requestModal");
}

function updateRequestEstimate() {
  const qty = parseInt(document.getElementById("reqQuantity").value) || 1;
  const subtotal = reqPrice * qty;
  const fee = Math.round(subtotal * 0.07);
  document.getElementById("requestEstimate").innerHTML = `
    <div class="info-box" style="margin-top:12px;">
      <div class="total-row"><span>Estimated: ${qty} × ₾${reqPrice}</span><span>₾${subtotal}</span></div>
      <div class="total-row"><span>Service fee (7%)</span><span>₾${fee}</span></div>
      <div class="total-row total-final"><span>Estimated total</span><span>₾${subtotal + fee}</span></div>
      <p style="font-size:0.75rem;color:#999;margin-top:6px;">Final price confirmed by seller after review.</p>
    </div>`;
}

document.getElementById("reqQuantity").addEventListener("input", updateRequestEstimate);

document.getElementById("requestForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!Store.isLoggedIn()) return;
  const qty = document.getElementById("reqQuantity").value;
  const delivery = document.getElementById("reqDelivery").value;
  const date = document.getElementById("reqDate").value;
  const message = document.getElementById("reqMessage").value;

  const body = `📩 Plant Request\n` +
    `Plant: ${reqPlantName}\n` +
    `Quantity: ${qty}\n` +
    `Delivery: ${delivery}\n` +
    `${date ? 'Preferred date: ' + date + '\n' : ''}` +
    `Message: ${message}`;

  try {
    await Store.sendMessage({ receiver_id: reqSellerId, listing_id: reqPlantId, body });
    closeModal("requestModal");
    e.target.reset();
    showToast("Request sent! The seller will review and respond.");
    showPage("messages");
  } catch (err) { showToast(err.message); }
});

// === Listing Management ===
async function toggleListing(id, currentActive) {
  try { await Store.updateListing(id, { active: !currentActive }); showToast(currentActive ? "Deactivated" : "Activated"); renderDashboard(); }
  catch (e) { showToast(e.message); }
}
async function deleteListingApi(id) {
  if (!confirm("Delete this listing?")) return;
  try { await Store.deleteListing(id); showToast("Deleted"); renderDashboard(); }
  catch (e) { showToast(e.message); }
}

// === Listing Photo Upload ===
let listingPhotos = [];
document.getElementById("listPhotos").addEventListener("change", (e) => {
  const files = Array.from(e.target.files).slice(0, 5);
  listingPhotos = [];
  const preview = document.getElementById("listingPhotoPreview");
  let loaded = 0;
  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      listingPhotos[idx] = ev.target.result;
      loaded++;
      if (loaded === files.length) {
        listingPhotos = listingPhotos.filter(Boolean);
        preview.innerHTML = listingPhotos.map((src, i) => `
          <div class="photo-thumb">
            <img src="${src}" alt="Photo ${i+1}">
            ${i === 0 ? '<span class="photo-main-badge">Main</span>' : ''}
            <button type="button" class="photo-remove" onclick="removeListingPhoto(${i})">×</button>
          </div>`).join("") + (listingPhotos.length < 5 ? `<div class="photo-add-more" onclick="document.getElementById('listPhotos').click()">+</div>` : '');
      }
    };
    reader.readAsDataURL(file);
  });
});
function removeListingPhoto(idx) {
  listingPhotos.splice(idx, 1);
  const preview = document.getElementById("listingPhotoPreview");
  preview.innerHTML = listingPhotos.map((src, i) => `
    <div class="photo-thumb">
      <img src="${src}" alt="Photo ${i+1}">
      ${i === 0 ? '<span class="photo-main-badge">Main</span>' : ''}
      <button type="button" class="photo-remove" onclick="removeListingPhoto(${i})">×</button>
    </div>`).join("") + (listingPhotos.length < 5 ? `<div class="photo-add-more" onclick="document.getElementById('listPhotos').click()">+</div>` : '');
}

// === Create Listing ===
document.getElementById("listingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const listing = await Store.createListing({
      name: document.getElementById("listName").value,
      latin: document.getElementById("listLatin").value,
      category: document.getElementById("listCategory").value,
      price: parseInt(document.getElementById("listPrice").value),
      unit: document.getElementById("listUnit").value,
      height: document.getElementById("listHeight").value,
      age: document.getElementById("listAge").value,
      stock: document.getElementById("listStock").value,
      description: document.getElementById("listDesc").value,
      image: listingPhotos.length ? listingPhotos[0] : '',
      images: listingPhotos.length ? listingPhotos : undefined,
      watering: document.getElementById("listWatering").value,
      sunlight: document.getElementById("listSunlight").value,
      soil: document.getElementById("listSoil").value,
      frost_tolerance: document.getElementById("listFrost").value,
      best_planting: document.getElementById("listBestPlanting").value,
    });
    closeModal("listingModal"); e.target.reset(); listingPhotos = [];
    document.getElementById("listingPhotoPreview").innerHTML = "";
    showToast(`"${listing.name}" is now live!`);
    loadListings();
  } catch (err) { showToast(err.message); }
});

// === Registration & Auth ===
document.getElementById("registerBuyerBtn").addEventListener("click", (e) => { e.preventDefault(); openModal("buyerModal"); });
document.getElementById("loginBtn").addEventListener("click", (e) => { e.preventDefault(); openModal("loginModal"); });
document.getElementById("switchToRegister").addEventListener("click", (e) => { e.preventDefault(); closeModal("loginModal"); openModal("buyerModal"); });
document.getElementById("logoutBtn").addEventListener("click", (e) => {
  e.preventDefault(); Store.logout(); currentConvo = null; updateAuthUI(); showPage("home"); showToast("Logged out");
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const user = await Store.login(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value);
    closeModal("loginModal"); updateAuthUI(); showToast(`Welcome back, ${user.name}!`); e.target.reset();
  } catch (err) { showToast(err.message); }
});

document.getElementById("sellerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const user = await Store.register({
      name: document.getElementById("sellerName").value, email: document.getElementById("sellerEmail").value,
      phone: document.getElementById("sellerPhone").value, city: document.getElementById("sellerCity").value,
      password: document.getElementById("sellerPassword").value, type: "seller"
    });
    closeModal("sellModal"); e.target.reset();
    updateAuthUI();
    // Show verification modal
    document.getElementById("verifyEmailDisplay").textContent = user.email;
    openModal("verifyModal");
    showToast("Check your email for a verification code!");
  } catch (err) { showToast(err.message); }
});

document.getElementById("buyerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const user = await Store.register({
      name: document.getElementById("regBuyerName").value, email: document.getElementById("regBuyerEmail").value,
      phone: document.getElementById("regBuyerPhone").value, city: document.getElementById("regBuyerCity").value,
      password: document.getElementById("regBuyerPassword").value, type: "buyer"
    });
    closeModal("buyerModal"); e.target.reset();
    updateAuthUI();
    document.getElementById("verifyEmailDisplay").textContent = user.email;
    openModal("verifyModal");
    showToast("Check your email for a verification code!");
  } catch (err) { showToast(err.message); }
});

// Email verification form
document.getElementById("verifyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await Store.verifyEmail(document.getElementById("verifyCode").value);
    closeModal("verifyModal");
    // Refresh session
    const profile = await Store.getProfile();
    localStorage.setItem('gb_session', JSON.stringify(profile));
    updateAuthUI();
    showToast("Email verified! Welcome to მწვანე ბაზარი 🌿");
  } catch (err) { showToast(err.message); }
});

document.getElementById("resendCode").addEventListener("click", async (e) => {
  e.preventDefault();
  try { await Store.resendVerify(); showToast("New code sent!"); } catch (err) { showToast(err.message); }
});

// === Filter & Search ===
document.querySelectorAll(".tag").forEach(tag => {
  tag.addEventListener("click", () => {
    document.querySelectorAll(".tag").forEach(t => t.classList.remove("active"));
    tag.classList.add("active");
    activeFilter = tag.dataset.filter;
    renderPlants(filterPlants());
  });
});
document.getElementById("searchInput").addEventListener("input", () => renderPlants(filterPlants()));
document.getElementById("searchBtn").addEventListener("click", () => renderPlants(filterPlants()));

// === Profile Edit ===
async function openProfileEdit() {
  if (!Store.isLoggedIn()) return;
  try {
    const profile = await Store.getProfile();
    document.getElementById("profName").value = profile.name || '';
    document.getElementById("profPhone").value = profile.phone || '';
    document.getElementById("profCity").value = profile.city || '';
    document.getElementById("profBio").value = profile.bio || '';
    openModal("profileModal");
  } catch (e) { showToast("Failed to load profile"); }
}

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await Store.updateProfile({
      name: document.getElementById("profName").value,
      phone: document.getElementById("profPhone").value,
      city: document.getElementById("profCity").value,
      bio: document.getElementById("profBio").value,
    });
    closeModal("profileModal");
    updateAuthUI();
    showToast("Profile updated!");
  } catch (err) { showToast(err.message); }
});

document.getElementById("passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await Store.changePassword({
      currentPassword: document.getElementById("profCurrentPw").value,
      newPassword: document.getElementById("profNewPw").value,
    });
    closeModal("profileModal");
    showToast("Password updated!");
    e.target.reset();
  } catch (err) { showToast(err.message); }
});

// === Edit Listing ===
let editingListingId = null;
async function openEditListing(id) {
  try {
    const l = await Store.getListing(id);
    editingListingId = id;
    document.getElementById("editListId").value = id;
    document.getElementById("editListName").value = l.name || '';
    document.getElementById("editListLatin").value = l.latin || '';
    document.getElementById("editListCategory").value = l.category || 'thuja';
    document.getElementById("editListPrice").value = l.price || '';
    document.getElementById("editListUnit").value = l.unit || 'per plant';
    document.getElementById("editListHeight").value = l.height || '';
    document.getElementById("editListAge").value = l.age || '';
    document.getElementById("editListStock").value = l.stock || 'available';
    document.getElementById("editListDesc").value = l.description || '';
    document.getElementById("editListImage").value = l.image || '';
    openModal("editListingModal");
  } catch (e) { showToast("Failed to load listing"); }
}

document.getElementById("editListingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await Store.updateListing(editingListingId, {
      name: document.getElementById("editListName").value,
      latin: document.getElementById("editListLatin").value,
      category: document.getElementById("editListCategory").value,
      price: parseInt(document.getElementById("editListPrice").value),
      unit: document.getElementById("editListUnit").value,
      height: document.getElementById("editListHeight").value,
      age: document.getElementById("editListAge").value,
      stock: document.getElementById("editListStock").value,
      description: document.getElementById("editListDesc").value,
      image: document.getElementById("editListImage").value,
    });
    closeModal("editListingModal");
    showToast("Listing updated!");
    renderDashboard();
    loadListings();
  } catch (err) { showToast(err.message); }
});

// === Language Toggle ===
function switchLang(lang) {
  setLang(lang);
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');
  // Update sort/filter options
  const sortSel = document.getElementById("sortSelect");
  if (sortSel) { sortSel.options[0].text = t('sortNewest'); sortSel.options[1].text = t('sortPriceLow'); sortSel.options[2].text = t('sortPriceHigh'); sortSel.options[3].text = t('sortRating'); }
  const citySel = document.getElementById("filterCity");
  if (citySel) citySel.options[0].text = t('filterCity');
  const priceSel = document.getElementById("filterPrice");
  if (priceSel) priceSel.options[0].text = t('filterPriceRange');
}

function toggleLang() { switchLang(getLang() === 'en' ? 'ka' : getLang() === 'ka' ? 'fr' : 'en'); }

// === Favorites ===
async function toggleFav(listingId) {
  if (!Store.isLoggedIn()) { showToast("Log in to save favorites"); openModal("loginModal"); return; }
  try {
    if (favIds.includes(listingId)) {
      await Store.removeFavorite(listingId);
      favIds = favIds.filter(id => id !== listingId);
      showToast("Removed from favorites");
    } else {
      await Store.addFavorite(listingId);
      favIds.push(listingId);
      showToast("Added to favorites ❤️");
    }
    renderPlants(filterPlants());
  } catch (e) { showToast(e.message); }
}

async function renderFavorites() {
  if (!Store.isLoggedIn()) { showPage("home"); return; }
  try {
    const favs = await Store.getFavorites();
    const grid = document.getElementById("favGrid");
    const empty = document.getElementById("favEmpty");
    if (!favs.length) { grid.innerHTML = ""; empty.style.display = "block"; return; }
    empty.style.display = "none";
    grid.innerHTML = favs.map(f => `
      <div class="card" style="cursor:pointer;" onclick="showPage('plant',${f.listing_id})">
        <img class="card-img" src="${f.image||''}" alt="${f.name}" onerror="this.style.background='#EDE9E0';">
        <div class="card-body">
          <h3 class="card-title">${f.name}</h3><p class="card-latin">${f.latin||''}</p>
          <div class="card-footer"><span class="card-price">₾${f.price}</span><span class="card-seller">by ${f.seller_name}</span></div>
        </div>
      </div>`).join("");
  } catch (e) { console.error(e); }
}

// === Notifications ===
async function renderNotifications() {
  if (!Store.isLoggedIn()) { showPage("home"); return; }
  try {
    const notifs = await Store.getNotifications();
    const list = document.getElementById("notifList");
    const empty = document.getElementById("notifEmpty");
    if (!notifs.length) { list.innerHTML = ""; empty.style.display = "block"; return; }
    empty.style.display = "none";
    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'notif-unread'}" onclick="${n.link ? `showPage('${n.link}')` : ''}">
        <div class="notif-title">${n.title}</div>
        <div class="notif-body">${n.body}</div>
        <div class="notif-time">${new Date(n.created_at).toLocaleString()}</div>
      </div>`).join("");
  } catch (e) { console.error(e); }
}

async function markAllNotifsRead() {
  try { await Store.markNotifsRead(); showToast("All marked as read"); updateAuthUI(); renderNotifications(); } catch {}
}

// === Seller Profile ===
async function renderSellerProfile(sellerId) {
  try {
    const s = await Store.getSellerProfile(sellerId);
    const joined = new Date(s.created_at).toLocaleDateString();
    const verified = s.verified_seller ? '<span class="verified-badge-lg">✓ Verified Grower</span>' : '';
    document.getElementById("sellerProfileContent").innerHTML = `
      <div class="seller-profile-header">
        <div class="seller-avatar">${(s.name||'?')[0].toUpperCase()}</div>
        <div>
          <h1>${s.name} ${verified}</h1>
          <p>📍 ${s.city || ''} · Member since ${joined}</p>
          <p>⭐ ${s.rating || 0}/5 from ${s.review_count || 0} reviews · ${s.completed_orders || 0} completed orders</p>
          ${s.bio ? `<p class="seller-bio">${s.bio}</p>` : ''}
        </div>
      </div>
      <h2 style="margin:24px 0 12px;">Listings (${s.listings.length})</h2>
      <div class="grid">${s.listings.map(l => `
        <div class="card" style="cursor:pointer;" onclick="showPage('plant',${l.id})">
          <img class="card-img" src="${l.image||''}" alt="${l.name}" onerror="this.style.background='#EDE9E0';">
          <div class="card-body">
            <h3 class="card-title">${l.name}</h3><p class="card-latin">${l.latin||''}</p>
            <div class="card-footer"><span class="card-price">₾${l.price}</span></div>
          </div>
        </div>`).join("") || '<p class="dash-empty">No active listings</p>'}</div>
      <h2 style="margin:24px 0 12px;">Reviews (${s.reviews.length})</h2>
      ${s.reviews.map(r => `
        <div class="review-card">
          <div class="review-header"><span class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</span><span>${r.plant_name}</span></div>
          <p class="review-text">${r.comment||'No comment'}</p>
          <p class="review-meta">by ${r.buyer_name} · ${new Date(r.created_at).toLocaleDateString()}</p>
        </div>`).join("") || '<p class="dash-empty">No reviews yet</p>'}`;
  } catch (e) { console.error(e); showToast("Failed to load profile"); }
}

// === Share Listing ===
function shareListing(id, name) {
  const url = window.location.origin + '?plant=' + id;
  if (navigator.share) {
    navigator.share({ title: name + ' — მწვანე ბაზარი', url });
  } else {
    navigator.clipboard.writeText(url).then(() => showToast(t('copyLink')));
  }
}

// === Mobile Menu ===
document.getElementById("mobileMenuBtn").addEventListener("click", () => { document.getElementById("mainNav").classList.toggle("open"); });

// === Toast ===
function showToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) { toast = document.createElement("div"); toast.className = "toast"; document.body.appendChild(toast); }
  toast.textContent = msg; toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

// === My Profile Page (Boomerang-style) ===
let allConversations = []; // cached for filtering

function filterConversations() {
  const q = (document.getElementById("msgSearchInput")?.value || '').toLowerCase();
  const list = document.getElementById("msgList");
  if (!allConversations.length) return;
  const filtered = q ? allConversations.filter(c => c.otherName.toLowerCase().includes(q)) : allConversations;
  list.innerHTML = filtered.length ? filtered.map((c, i) => {
    const lastMsg = c.messages[c.messages.length - 1];
    return `<div class="msg-item" data-idx="${i}" onclick="selectConvo(${i})">
      <div class="msg-item-header"><strong>${esc(c.otherName)}</strong></div>
      <p class="msg-preview">${esc((lastMsg.body||'').substring(0, 50))}...</p>
    </div>`;
  }).join("") : '<p class="msg-empty">No matching conversations</p>';
}

function selectConvo(idx) {
  const session = Store.getSession();
  const convo = allConversations[idx];
  if (!convo || !session) return;
  currentConvo = convo;
  Store.markRead(convo.otherId);
  renderChat(convo, session);
}

// People search
let peopleSearchTimeout;
function searchPeople() {
  clearTimeout(peopleSearchTimeout);
  const q = document.getElementById("peopleSearchInput")?.value || '';
  if (q.length < 2) { document.getElementById("peopleGrid").innerHTML = ''; document.getElementById("peopleEmpty").style.display = "block"; return; }
  peopleSearchTimeout = setTimeout(async () => {
    try {
      const users = await Store.searchUsers(q);
      document.getElementById("peopleEmpty").style.display = users.length ? "none" : "block";
      document.getElementById("peopleGrid").innerHTML = users.map(u => `
        <div class="card" onclick="showPage('seller',${u.id})" style="cursor:pointer;">
          <div class="card-body" style="padding:16px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div class="seller-avatar-sm">${(u.name||'?')[0]}</div>
              <div>
                <h3 class="card-title">${esc(u.name)} ${u.verified_seller ? '<span class="verified-badge">✓</span>' : ''}</h3>
                <p class="card-latin">${esc(u.city||'')} · ${u.type}</p>
              </div>
            </div>
            <div class="card-footer" style="border:none;padding-top:4px;">
              <span class="card-rating">⭐ ${u.rating||0} (${u.review_count||0})</span>
            </div>
          </div>
        </div>`).join("");
    } catch {}
  }, 300);
}

async function renderMyProfile() {
  if (!Store.isLoggedIn()) { showPage("home"); return; }
  try {
    const p = await Store.getProfile();
    const s = p.stats || {};
    document.getElementById("profileCard").innerHTML = `
      <div class="prof-header">
        <div class="prof-avatar">${(p.name||'?')[0].toUpperCase()}</div>
        <div class="prof-info">
          <h2>${esc(p.name)} ${p.verified ? '<span class="prof-verified" title="Email verified">✓</span>' : '<span class="prof-unverified">Unverified</span>'}
            ${p.verified_seller ? '<span class="verified-badge-lg">Verified Grower</span>' : ''}</h2>
          <p>${esc(p.email)}</p>
          <p>${esc(p.city || '')} · ${p.type === 'seller' ? 'Seller' : 'Buyer'} · Joined ${new Date(p.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      <div class="prof-stats">
        <div class="prof-stat"><span class="stat-num">${s.orders_bought || 0}</span><span class="stat-label">Purchased</span></div>
        <div class="prof-stat"><span class="stat-num">${s.orders_sold || 0}</span><span class="stat-label">Sold</span></div>
        <div class="prof-stat"><span class="stat-num">${s.active_listings || 0}</span><span class="stat-label">Listings</span></div>
        <div class="prof-stat"><span class="stat-num">${s.favorites || 0}</span><span class="stat-label">Favorites</span></div>
        <div class="prof-stat"><span class="stat-num">${p.rating || 0}</span><span class="stat-label">Rating</span></div>
      </div>
      ${p.bio ? `<p class="prof-bio">${esc(p.bio)}</p>` : ''}`;

    document.getElementById("profileMenu").innerHTML = `
      <div class="prof-menu-list">
        <a class="prof-menu-item" onclick="showPage('dashboard')"><span>Dashboard</span><span>→</span></a>
        <a class="prof-menu-item" onclick="showPage('messages')"><span>Messages</span><span>→</span></a>
        <a class="prof-menu-item" onclick="showPage('favorites')"><span>Favorites</span><span>→</span></a>
        <a class="prof-menu-item" onclick="showPage('notifications')"><span>Notifications</span><span>→</span></a>
        <a class="prof-menu-item" onclick="openProfileEdit()"><span>Edit Profile</span><span>→</span></a>
        ${p.is_admin ? '<a class="prof-menu-item" onclick="showPage(\'admin\')"><span>Admin Dashboard</span><span>→</span></a>' : ''}
      </div>
      <button class="btn btn-full" style="background:transparent;color:#7A3B2E;border:1px solid #EDE9E0;margin-top:16px;" onclick="Store.logout();updateAuthUI();showPage('home');showToast('Logged out');">Log Out</button>`;
  } catch (e) { showToast("Failed to load profile"); }
}

// === Forgot Password ===
document.getElementById("forgotPwLink").addEventListener("click", (e) => {
  e.preventDefault(); closeModal("loginModal"); openModal("forgotPwModal");
});

let forgotEmail = '';
document.getElementById("forgotForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  forgotEmail = document.getElementById("forgotEmail").value;
  try {
    await Store.forgotPassword(forgotEmail);
    document.getElementById("forgotStep1").style.display = "none";
    document.getElementById("forgotStep2").style.display = "block";
    showToast("Reset code sent to your email!");
  } catch (err) { showToast(err.message); }
});

document.getElementById("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api('POST', '/api/users/reset-password', {
      email: forgotEmail,
      code: document.getElementById("resetCode").value,
      newPassword: document.getElementById("resetNewPw").value,
    });
    closeModal("forgotPwModal");
    document.getElementById("forgotStep1").style.display = "block";
    document.getElementById("forgotStep2").style.display = "none";
    showToast("Password reset! You can now log in.");
    openModal("loginModal");
  } catch (err) { showToast(err.message); }
});

// === Admin Page ===
async function renderAdminPage() {
  if (!Store.isLoggedIn()) { showPage("home"); return; }
  try {
    const stats = await Store.getAdminStats();
    document.getElementById("adminStats").innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-num">${stats.total_users}</span><span class="stat-label">Users</span></div>
        <div class="stat-card"><span class="stat-num">${stats.sellers}</span><span class="stat-label">Sellers</span></div>
        <div class="stat-card"><span class="stat-num">${stats.buyers}</span><span class="stat-label">Buyers</span></div>
        <div class="stat-card"><span class="stat-num">${stats.active_listings}</span><span class="stat-label">Listings</span></div>
        <div class="stat-card"><span class="stat-num">${stats.total_orders}</span><span class="stat-label">Orders</span></div>
        <div class="stat-card"><span class="stat-num">${stats.completed_orders}</span><span class="stat-label">Completed</span></div>
        <div class="stat-card"><span class="stat-num">₾${stats.platform_revenue}</span><span class="stat-label">Revenue (fees)</span></div>
        <div class="stat-card"><span class="stat-num">${stats.avg_rating}</span><span class="stat-label">Avg Rating</span></div>
        <div class="stat-card"><span class="stat-num">${stats.new_users_week}</span><span class="stat-label">New (7d)</span></div>
        <div class="stat-card"><span class="stat-num">${stats.open_disputes}</span><span class="stat-label">Open Disputes</span></div>
        <div class="stat-card"><span class="stat-num">${stats.total_messages}</span><span class="stat-label">Messages</span></div>
        <div class="stat-card"><span class="stat-num">${stats.total_reviews}</span><span class="stat-label">Reviews</span></div>
      </div>`;
    loadAdminTab('users');
  } catch (e) { showToast("Admin access required"); showPage("home"); }
}

async function loadAdminTab(tab) {
  const content = document.getElementById("adminContent");
  document.querySelectorAll(".admin-tabs .dash-tab").forEach(t => t.classList.remove("active"));
  event.target?.classList.add("active");

  if (tab === 'users') {
    const users = await Store.getAdminUsers();
    content.innerHTML = `<table class="admin-table">
      <thead><tr><th>Name</th><th>Email</th><th>Type</th><th>City</th><th>Verified</th><th>Rating</th><th>Actions</th></tr></thead>
      <tbody>${users.map(u => `<tr>
        <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.type}</td><td>${esc(u.city||'')}</td>
        <td>${u.verified ? '<span class="email-verified-icon" title="Email verified">✓</span>' : '<span class="email-unverified">✗</span>'}</td>
        <td>${u.rating||0} (${u.review_count||0})</td>
        <td>${!u.verified ? `<button class="btn btn-sm btn-primary" onclick="adminVerify(${u.id})">Verify</button>` : ''}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  } else if (tab === 'disputes') {
    const disputes = await Store.getAdminDisputes();
    content.innerHTML = disputes.length ? disputes.map(d => `
      <div class="order-card dispute-card">
        <div class="order-header"><span class="order-id">DSP-${d.id}</span><span class="order-status" style="background:${d.status==='open'?'#B8704B':'#8B9E7C'}">${d.status}</span></div>
        <p><strong>${esc(d.buyer_name)}</strong> vs <strong>${esc(d.seller_name)}</strong> — ${esc(d.plant_name)}</p>
        <p>Reason: ${esc(d.reason)}</p><p>${esc(d.description||'')}</p>
        ${d.status === 'open' ? `<div class="order-actions">
          <button class="btn btn-sm btn-primary" onclick="adminResolve(${d.id},'refund')">Refund Buyer</button>
          <button class="btn btn-sm btn-outline" style="border-color:#2A4139;color:#2A4139;" onclick="adminResolve(${d.id},'release')">Release to Seller</button>
        </div>` : ''}
      </div>`).join("") : '<p class="dash-empty">No disputes</p>';
  }
}

async function adminVerify(userId) {
  try { await Store.adminVerifyUser(userId); showToast("User verified"); loadAdminTab('users'); } catch (e) { showToast(e.message); }
}
async function adminResolve(disputeId, resolution) {
  try { await Store.resolveDispute(disputeId, resolution); showToast("Dispute resolved"); loadAdminTab('disputes'); } catch (e) { showToast(e.message); }
}

// === News Page ===
async function renderNewsPage() {
  const articles = [
    { title: "Best Plants to Grow in Georgian Climate 2026", desc: "A comprehensive guide to plants that thrive in Georgia's diverse climate zones, from the Black Sea coast to the Caucasus mountains.", date: "April 2026", tag: "Guide", img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=250&fit=crop" },
    { title: "Thuja Care: Common Mistakes to Avoid", desc: "Overwatering, wrong soil pH, and planting too deep are the top 3 reasons Thuja plants fail. Here's how to avoid them.", date: "April 2026", tag: "Care Tips", img: "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=400&h=250&fit=crop" },
    { title: "How to Start a Plant Nursery Business in Georgia", desc: "From permits to pricing, everything you need to know about turning your garden into a profitable nursery business.", date: "March 2026", tag: "Business", img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400&h=250&fit=crop" },
    { title: "Spring Planting Calendar for Georgian Gardeners", desc: "Month-by-month guide: what to plant, when to prune, and how to prepare your garden for the growing season.", date: "March 2026", tag: "Seasonal", img: "https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=400&h=250&fit=crop" },
    { title: "Organic Pest Control for Fruit Trees", desc: "Natural methods to protect your pomegranate, fig, and grape vines from common Georgian pests without chemicals.", date: "February 2026", tag: "Care Tips", img: "https://images.unsplash.com/photo-1567331711402-509c12c41959?w=400&h=250&fit=crop" },
    { title: "The Rise of Urban Gardening in Tbilisi", desc: "How apartment dwellers in Tbilisi are transforming balconies and rooftops into thriving green spaces.", date: "February 2026", tag: "Trends", img: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400&h=250&fit=crop" },
  ];
  document.getElementById("newsGrid").innerHTML = articles.map(a => `
    <article class="news-card">
      <img src="${a.img}" alt="${esc(a.title)}" class="news-img" onerror="this.style.background='#EDE9E0';">
      <div class="news-body">
        <span class="news-tag">${a.tag}</span>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.desc)}</p>
        <span class="news-date">${a.date}</span>
      </div>
    </article>`).join("");
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const dd = document.getElementById("userDropdown");
  const btn = document.getElementById("userMenuBtn");
  if (dd && !dd.contains(e.target) && !btn?.contains(e.target)) dd.classList.remove("open");
});

// === Init ===
updateAuthUI();
loadFavIds();
loadListings();
loadRecommendations();
// Apply saved language
const savedLang = getLang();
document.getElementById("langToggle").value = savedLang;
if (savedLang !== 'en') {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
}

// === Recommendations ===
async function loadRecommendations() {
  try {
    // Seasonal
    const seasonal = await Store.getSeasonal();
    if (seasonal.plants && seasonal.plants.length) {
      document.getElementById("seasonalMonth").textContent = `Plants ideal for planting in ${seasonal.month}`;
      document.getElementById("seasonalGrid").innerHTML = seasonal.plants.map(p => renderMiniCard(p)).join("");
    } else {
      document.getElementById("seasonal-recs").style.display = "none";
    }
    // Popular
    const popular = await Store.getPopular();
    if (popular.length) {
      document.getElementById("popularGrid").innerHTML = popular.map(p => renderMiniCard(p)).join("");
    } else {
      document.getElementById("popular-recs").style.display = "none";
    }
    // For You
    if (Store.isLoggedIn()) {
      const forYou = await Store.getForYou();
      if (forYou.length) {
        document.getElementById("foryou-recs").style.display = "block";
        document.getElementById("foryouGrid").innerHTML = forYou.map(p => renderMiniCard(p)).join("");
      }
    }
  } catch (e) { console.log('Recs:', e.message); }
}

function renderMiniCard(p) {
  return `<div class="card" onclick="showPage('plant',${p.id})" style="cursor:pointer;">
    <img class="card-img" src="${p.image || ''}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.background='#EDE9E0';this.alt='Image';">
    <div class="card-body">
      <h3 class="card-title">${esc(p.name)}</h3>
      <div class="card-footer" style="border:none;padding-top:4px;">
        <span class="card-price">₾${p.price}</span>
        <span class="card-seller">${esc(p.seller_name || '')}</span>
      </div>
    </div>
  </div>`;
}

async function loadSimilarPlants(listingId) {
  try {
    // Remove any existing similar section first
    const existing = document.querySelector('.similar-section');
    if (existing) existing.remove();
    const similar = await Store.getSimilar(listingId);
    if (similar.length) {
      document.getElementById("reviewsSection").insertAdjacentHTML('beforebegin',
        `<div class="similar-section"><h2>${t('similarPlants')}</h2><div class="grid grid-scroll">${similar.map(p => renderMiniCard(p)).join("")}</div></div>`);
    }
  } catch {}
}
