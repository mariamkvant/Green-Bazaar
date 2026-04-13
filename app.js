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
}

// === Modal Helpers ===
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
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
    document.getElementById("navAddListing").style.display = session.type === "seller" ? "inline" : "none";
    try {
      const unread = await Store.getUnreadCount();
      const badge = document.getElementById("msgBadge");
      if (unread > 0) { badge.textContent = unread; badge.style.display = "inline"; }
      else badge.style.display = "none";
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
    return `
      <article class="card" onclick="showPage('plant', ${p.id})" style="cursor:pointer;">
        <img class="card-img" src="${p.image || 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop'}" alt="${p.name}" loading="lazy"
             onerror="this.style.background='#e8f5e2';this.alt='Image unavailable';">
        <div class="card-body">
          <span class="card-badge ${badgeClass}">${badgeText}</span>
          <h3 class="card-title">${p.name}</h3>
          <p class="card-latin">${p.latin || ''}</p>
          <p class="card-desc">${(p.description || '').substring(0, 100)}...</p>
          <div class="card-meta">
            <span>📏 ${p.height || ''}</span>
            <span>🌱 ${p.age || ''}</span>
            <span>📍 ${p.seller_city || ''}</span>
          </div>
          ${rating ? `<div class="card-rating">${rating} (${p.seller_review_count || 0} reviews)</div>` : ''}
          <div class="card-footer">
            <div><span class="card-price">₾${p.price}</span><span class="card-price-unit"> / ${p.unit}</span></div>
            <span class="card-seller">by <strong>${p.seller_name || ''}</strong></span>
          </div>
        </div>
      </article>`;
  }).join("");
}

let activeFilter = "all";
function filterPlants() {
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  return allListings.filter(p => {
    const matchFilter = activeFilter === "all" || p.category === activeFilter;
    const matchSearch = !query || (p.name + p.latin + p.description + p.seller_name + p.seller_city).toLowerCase().includes(query);
    return matchFilter && matchSearch;
  });
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
        </div>
      </div>`;

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
        <img src="${p.image || ''}" alt="${p.name}" class="checkout-img" onerror="this.style.background='#e8f5e2';">
        <div><h3>${p.name}</h3><p class="card-latin">${p.latin || ''}</p><p>📍 ${p.seller_city} · by ${p.seller_name}</p></div>
      </div>`;
    updateOrderTotal();
    document.getElementById("checkoutBack").onclick = (e) => { e.preventDefault(); showPage("plant", plantId); };
  } catch (e) { showToast("Failed to load checkout"); }
}

function updateOrderTotal() {
  if (!currentCheckoutPlant) return;
  const p = currentCheckoutPlant;
  const delivery = document.querySelector('input[name="delivery"]:checked').value;
  const deliveryCost = delivery === "courier" ? 10 : 0;
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
    const [orders, disputes] = await Promise.all([Store.getMyOrders(), Store.getMyDisputes()]);
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
              <button class="btn btn-outline btn-sm" onclick="toggleListing(${l.id}, ${l.active})">${l.active ? '⏸ Deactivate' : '▶ Activate'}</button>
              <button class="btn btn-outline btn-sm" style="border-color:#d32f2f;color:#d32f2f;" onclick="deleteListingApi(${l.id})">🗑 Delete</button>
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
      ${convo.messages.map(m => `<div class="chat-msg ${m.sender_id === session.id ? 'msg-mine' : 'msg-theirs'}">
        <p>${m.body}</p><small>${new Date(m.created_at).toLocaleString()}</small>
      </div>`).join("")}
    </div>
    <form class="chat-input" id="chatForm"><input type="text" id="chatText" placeholder="Type a message..." required><button type="submit" class="btn btn-primary">Send</button></form>`;
  document.getElementById("chatMessages").scrollTop = 99999;
  document.getElementById("chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("chatText").value.trim();
    if (!text) return;
    try {
      await Store.sendMessage({ receiver_id: convo.otherId, order_id: convo.orderId, body: text });
      document.getElementById("chatText").value = "";
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
      image: document.getElementById("listImage").value
    });
    closeModal("listingModal"); e.target.reset();
    showToast(`"${listing.name}" is now live!`);
    loadListings();
  } catch (err) { showToast(err.message); }
});

// === Registration & Auth ===
document.getElementById("sellBtn").addEventListener("click", (e) => { e.preventDefault(); openModal("sellModal"); });
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
    closeModal("sellModal"); updateAuthUI(); showToast(`Welcome, ${user.name}! 🌿`); e.target.reset();
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
    closeModal("buyerModal"); updateAuthUI(); showToast(`Welcome, ${user.name}! 🌿`); e.target.reset();
  } catch (err) { showToast(err.message); }
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

// === Mobile Menu ===
document.getElementById("mobileMenuBtn").addEventListener("click", () => { document.getElementById("mainNav").classList.toggle("open"); });

// === Toast ===
function showToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) { toast = document.createElement("div"); toast.className = "toast"; document.body.appendChild(toast); }
  toast.textContent = msg; toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

// === Init ===
updateAuthUI();
loadListings();
