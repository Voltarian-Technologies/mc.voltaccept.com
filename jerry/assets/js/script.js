// Global ItemENUM cache
let ItemENUM = null;

// Fetch the items.json from your website
async function loadItemEnum() {
  try {
    const res = await fetch("https://or.voltaccept.com/jerry/api/items.json"); // same-site API
    if (!res.ok) throw new Error("Failed to load ItemENUM.json");

    ItemENUM = await res.json();
    console.log("ItemENUM loaded:", ItemENUM);
  } catch (err) {
    console.error("ItemENUM fetch error:", err);
    ItemENUM = {}; // fail-safe
  }
}

// Utility: check if a given URL exists (HEAD request)
async function urlExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch (err) {
    console.error("Error checking URL:", err);
    return false;
  }
}

// Base64 decode and parse skin data to extract texture URL
function getSkinUrl(skinBase64) {
  try {
    if (!skinBase64 || typeof skinBase64 !== "string") {
      return null;
    }

    const decoded = atob(skinBase64);
    const skinData = JSON.parse(decoded);

    // Get the original texture URL from textures.minecraft.net
    const textureUrl = skinData.textures?.SKIN?.url;
    if (!textureUrl) return null;

    // Extract the texture hash (the last part of the URL)
    const hash = textureUrl.replace("http://textures.minecraft.net/texture/", "");
    if (hash) {
      // Use mc-heads.net for a reliable 2D avatar icon (64px)
      return `https://mc-heads.net/head/${hash}/64`;
    }

    return null;
  } catch (error) {
    console.error("Error decoding skin:", error);
    return null;
  }
}

// Async: get icon URL with custom asset fallback
async function getIconUrl(item) {
  if (!item) return null;

  // Method 1: Check for custom asset by ID
  if (item.id) {
    const customUrl = `https://or.voltaccept.com/jerry/assets/resources/${item.id}.png`;
    if (await urlExists(customUrl)) {
      return customUrl;
    }
  }

  // Method 2: Skin texture → mc-heads.net
  if (item.skin?.value) {
    const skinUrl = getSkinUrl(item.skin.value);
    if (skinUrl) return skinUrl;
  }

  // Method 3: Material → assets.mcasset.cloud
  if (item.material && ItemENUM && ItemENUM[item.material]) {
    return `https://assets.mcasset.cloud/1.21.8/assets/minecraft/textures/item/${ItemENUM[item.material]}.png`;
  }

  return null;
}

// Check if item is Jerry-related
function isJerryItem(item) {
  const nameMatch = item.name && item.name.toLowerCase().includes("jerry");
  const idMatch = item.id && item.id.toUpperCase().includes("JERRY");
  return nameMatch || idMatch;
}

// Create tooltip element
function createTooltip(item) {
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";

  let loreText = "";
  if (item.lore) {
    loreText = item.lore;
  } else if (item.description) {
    loreText = item.description;
  }

  tooltip.innerHTML = `
        <div class="tooltip-name">${item.name || "Unknown Item"}</div>
        <div class="tooltip-id">${item.id || "unknown_id"}</div>
        ${loreText ? `<div class="tooltip-lore">${loreText}</div>` : ""}
    `;

  return tooltip;
}

// Position tooltip near cursor
function positionTooltip(tooltip, event) {
  const padding = 20;

  tooltip.style.display = "block";
  const tooltipRect = tooltip.getBoundingClientRect();

  let x = event.clientX + padding;
  let y = event.clientY + padding;

  if (x + tooltipRect.width > window.innerWidth - 10) {
    x = event.clientX - tooltipRect.width - padding;
  }
  if (x < 10) x = 10;

  if (y + tooltipRect.height > window.innerHeight - 10) {
    y = event.clientY - tooltipRect.height - padding;
  }
  if (y < 10) y = 10;

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

// Create item card
async function createItemCard(item, index) {
  const card = document.createElement("div");
  card.className = "item-card";

  const header = document.createElement("div");
  header.className = "item-header";

  // Checkbox
  const checkboxContainer = document.createElement("div");
  checkboxContainer.className = "checkbox-container";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = `item-${index}`;
  checkbox.addEventListener("change", updateStats);

  const savedState = localStorage.getItem(`jerry-item-${item.id}`);
  if (savedState === "true") {
    checkbox.checked = true;
  }
  checkbox.addEventListener("change", () => {
    localStorage.setItem(`jerry-item-${item.id}`, checkbox.checked);
  });

  checkboxContainer.appendChild(checkbox);

  // Icon with tooltip
  const iconContainer = document.createElement("div");
  iconContainer.className = "icon-container";

  const icon = document.createElement("img");
  icon.className = "item-icon";

  // Async load icon
  const iconUrl = await getIconUrl(item);
  if (iconUrl) {
    icon.src = iconUrl;
  }

  // Tooltip
  const tooltip = createTooltip(item);
  document.body.appendChild(tooltip);

  let tooltipVisible = false;
  let tooltipTimeout = null;

  iconContainer.addEventListener("mouseenter", (e) => {
    clearTimeout(tooltipTimeout);
    tooltipVisible = true;
    tooltip.classList.add("show");
    positionTooltip(tooltip, e);
  });

  iconContainer.addEventListener("mousemove", (e) => {
    if (tooltipVisible) {
      positionTooltip(tooltip, e);
    }
  });

  iconContainer.addEventListener("mouseleave", () => {
    tooltipVisible = false;
    tooltipTimeout = setTimeout(() => {
      tooltip.classList.remove("show");
    }, 100);
  });

  iconContainer.addEventListener("touchstart", (e) => {
    e.preventDefault();
    clearTimeout(tooltipTimeout);
    tooltipVisible = !tooltipVisible;

    if (tooltipVisible) {
      tooltip.classList.add("show");
      positionTooltip(tooltip, e.touches[0]);
    } else {
      tooltip.classList.remove("show");
    }
  });

  iconContainer.appendChild(icon);

  header.appendChild(checkboxContainer);
  header.appendChild(iconContainer);

  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = item.name || "Unknown Item";

  card.appendChild(header);
  card.appendChild(name);

  return card;
}

// Update stats display
function updateStats() {
  const checkboxes = document.querySelectorAll('.item-card input[type="checkbox"]');
  const checked = Array.from(checkboxes).filter((cb) => cb.checked).length;
  const total = checkboxes.length;

  document.getElementById("checked-count").textContent = checked;
  document.getElementById("total-count").textContent = total;
}

// Fetch and display items
async function loadJerryItems() {
  const loadingEl = document.getElementById("loading");
  const errorEl = document.getElementById("error");
  const statsEl = document.getElementById("stats");
  const gridEl = document.getElementById("items-grid");

  try {
    const response = await fetch("https://api.hypixel.net/v2/resources/skyblock/items");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    const items = data.items || [];

    const jerryItems = items.filter(isJerryItem);
    if (jerryItems.length === 0) throw new Error("No Jerry items found!");

    for (let i = 0; i < jerryItems.length; i++) {
      const card = await createItemCard(jerryItems[i], i);
      gridEl.appendChild(card);
    }

    loadingEl.style.display = "none";
    statsEl.style.display = "inline-block";
    updateStats();
  } catch (error) {
    console.error("Error loading Jerry items:", error);
    loadingEl.style.display = "none";
    errorEl.textContent = `Error: ${error.message}`;
    errorEl.style.display = "inline-block";
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  await loadItemEnum();
  loadJerryItems();
});
