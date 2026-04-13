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

// === Contact Modal ===
function openContact(id) {
  const plant = plants.find(p => p.id === id);
  if (!plant) return;
  document.getElementById("modalTitle").textContent = `Contact about: ${plant.name}`;
  document.getElementById("modalSeller").textContent = plant.seller;
  document.getElementById("modalPhone").textContent = plant.phone;
  document.getElementById("modalLocation").textContent = plant.location;
  document.getElementById("contactModal").classList.add("open");
}

document.getElementById("modalClose").addEventListener("click", () => {
  document.getElementById("contactModal").classList.remove("open");
});
document.getElementById("contactModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
});

// === Contact Form ===
document.getElementById("contactForm").addEventListener("submit", (e) => {
  e.preventDefault();
  document.getElementById("contactModal").classList.remove("open");
  showToast("Inquiry sent! The seller will contact you soon.");
  e.target.reset();
});

// === Sell Modal ===
document.getElementById("sellBtn").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("sellModal").classList.add("open");
});
document.getElementById("footerSellLink").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("sellModal").classList.add("open");
});
document.getElementById("sellModalClose").addEventListener("click", () => {
  document.getElementById("sellModal").classList.remove("open");
});
document.getElementById("sellModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
});
document.getElementById("sellerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  document.getElementById("sellModal").classList.remove("open");
  showToast("Request submitted! We'll reach out to you shortly.");
  e.target.reset();
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
