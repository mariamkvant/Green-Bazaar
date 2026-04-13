// === Render Plant Cards ===
function renderPlants(list) {
  const grid = document.getElementById("plantGrid");
  const noResults = document.getElementById("noResults");

  if (list.length === 0) {
    grid.innerHTML = "";
    noResults.style.display = "block";
    return;
  }
  noResults.style.display = "none";

  grid.innerHTML = list.map(p => {
    const badgeClass = p.stock === "limited" ? "badge-limited" : p.stock === "preorder" ? "badge-preorder" : "badge-available";
    const badgeText = p.stock === "limited" ? "Limited Stock" : p.stock === "preorder" ? "Pre-order" : "Available";
    return `
      <article class="card">
        <img class="card-img" src="${p.image}" alt="${p.name}" loading="lazy"
             onerror="this.style.background='#e8f5e2';this.alt='Image unavailable';">
        <div class="card-body">
          <span class="card-badge ${badgeClass}">${badgeText}</span>
          <h3 class="card-title">${p.name}</h3>
          <p class="card-latin">${p.latin}</p>
          <p class="card-desc">${p.description}</p>
          <div class="card-meta">
            <span>📏 ${p.height}</span>
            <span>🌱 ${p.age}</span>
            <span>📍 ${p.location}</span>
          </div>
          <div class="card-footer">
            <div>
              <span class="card-price">₾${p.price}</span>
              <span class="card-price-unit"> / ${p.unit}</span>
            </div>
            <button class="btn btn-outline" onclick="openContact(${p.id})">Contact Seller</button>
          </div>
          <p class="card-seller" style="margin-top:8px;">Sold by <strong>${p.seller}</strong></p>
        </div>
      </article>`;
  }).join("");
}

// === Filter & Search ===
let activeFilter = "all";

function filterPlants() {
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  return plants.filter(p => {
    const matchFilter = activeFilter === "all" || p.tags.includes(activeFilter);
    const matchSearch = !query ||
      p.name.toLowerCase().includes(query) ||
      p.latin.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.seller.toLowerCase().includes(query) ||
      p.location.toLowerCase().includes(query);
    return matchFilter && matchSearch;
  });
}

// === Tag Filters ===
document.querySelectorAll(".tag").forEach(tag => {
  tag.addEventListener("click", () => {
    document.querySelectorAll(".tag").forEach(t => t.classList.remove("active"));
    tag.classList.add("active");
    activeFilter = tag.dataset.filter;
    renderPlants(filterPlants());
  });
});

// === Search ===
document.getElementById("searchInput").addEventListener("input", () => renderPlants(filterPlants()));
document.getElementById("searchBtn").addEventListener("click", () => renderPlants(filterPlants()));

// === Modal Helpers ===
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

function setupModal(modalId, closeId) {
  document.getElementById(closeId).addEventListener("click", () => closeModal(modalId));
  document.getElementById(modalId).addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal(modalId);
  });
}

setupModal("contactModal", "modalClose");
setupModal("sellModal", "sellModalClose");
setupModal("buyerModal", "buyerModalClose");
setupModal("verifyModal", "verifyModalClose");
setupModal("privacyModal", "privacyModalClose");

// === Contact Modal ===
function openContact(id) {
  const plant = plants.find(p => p.id === id);
  if (!plant) return;
  document.getElementById("modalTitle").textContent = `Contact about: ${plant.name}`;
  document.getElementById("modalSeller").textContent = plant.seller;
  document.getElementById("modalPhone").textContent = plant.phone;
  document.getElementById("modalLocation").textContent = plant.location;
  openModal("contactModal");
}

document.getElementById("contactForm").addEventListener("submit", (e) => {
  e.preventDefault();
  closeModal("contactModal");
  showToast("Inquiry sent! The seller will contact you soon.");
  e.target.reset();
});

// === Seller Registration ===
let pendingVerificationEmail = "";
let pendingVerificationType = "";

document.getElementById("sellBtn").addEventListener("click", (e) => {
  e.preventDefault();
  openModal("sellModal");
});
document.getElementById("footerSellLink").addEventListener("click", (e) => {
  e.preventDefault();
  openModal("sellModal");
});

document.getElementById("sellerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("sellerEmail").value;
  pendingVerificationEmail = email;
  pendingVerificationType = "seller";
  closeModal("sellModal");
  document.getElementById("verifyEmailDisplay").textContent = email;
  openModal("verifyModal");
});

// === Buyer Registration ===
document.getElementById("registerBuyerBtn").addEventListener("click", (e) => {
  e.preventDefault();
  openModal("buyerModal");
});

document.getElementById("buyerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("regBuyerEmail").value;
  pendingVerificationEmail = email;
  pendingVerificationType = "buyer";
  closeModal("buyerModal");
  document.getElementById("verifyEmailDisplay").textContent = email;
  openModal("verifyModal");
});

// === Email Verification ===
document.getElementById("verifyForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = document.getElementById("verifyCode").value;
  // Simulate verification (in production, validate against backend)
  if (code.length === 6) {
    closeModal("verifyModal");
    const type = pendingVerificationType === "seller" ? "Seller" : "Buyer";
    showToast(`${type} account verified! Welcome to მწვანე ბაზარი 🌿`);
    document.getElementById("verifyCode").value = "";
    // Reset the registration form
    if (pendingVerificationType === "seller") {
      document.getElementById("sellerForm").reset();
    } else {
      document.getElementById("buyerForm").reset();
    }
    pendingVerificationEmail = "";
    pendingVerificationType = "";
  }
});

document.getElementById("resendCode").addEventListener("click", (e) => {
  e.preventDefault();
  showToast(`Verification code resent to ${pendingVerificationEmail}`);
});

// === Privacy Policy ===
document.querySelectorAll("#sellerPrivacyLink, #buyerPrivacyLink, #footerPrivacyLink").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    openModal("privacyModal");
  });
});

// === Mobile Menu ===
document.getElementById("mobileMenuBtn").addEventListener("click", () => {
  document.querySelector(".nav").classList.toggle("open");
});

// === Toast ===
function showToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// === Init ===
renderPlants(plants);
