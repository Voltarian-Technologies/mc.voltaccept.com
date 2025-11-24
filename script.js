// Base64 decode and parse skin data
function getSkinUrl(skinBase64) {
  try {
    // Validate base64 string before attempting decode
    if (!skinBase64 || typeof skinBase64 !== "string") {
      return null
    }

    const decoded = atob(skinBase64)
    const skinData = JSON.parse(decoded)
    return skinData.textures?.SKIN?.url || null
  } catch (error) {
    // Silent fail - just return null without console errors
    return null
  }
}

// Get icon URL for an item
function getIconUrl(item) {
  // Method 1: Check for texture in item data
  if (item.texture) {
    return `https://mc-heads.net/head/${item.texture}`
  }

  // Method 2: Try skin data
  if (item.skin) {
    const skinUrl = getSkinUrl(item.skin)
    if (skinUrl) {
      // Extract texture ID from skin URL
      const textureMatch = skinUrl.match(/\/texture\/([a-f0-9]+)/)
      if (textureMatch && textureMatch[1]) {
        return `https://mc-heads.net/head/${textureMatch[1]}`
      }
    }
  }

  // Method 3: Use item ID for custom heads
  if (item.id) {
    // Try getting head from Skyblock item ID
    return `https://sky.shiiyu.moe/head/${item.id}`
  }

  // Method 4: Material fallback
  if (item.material) {
    const materialName = item.material.toLowerCase().replace(/_/g, "-")
    return `https://mc-heads.net/minecraft/item/${materialName}`
  }

  return null
}

// Check if item is Jerry-related
function isJerryItem(item) {
  const nameMatch = item.name && item.name.toLowerCase().includes("jerry")
  const idMatch = item.id && item.id.toUpperCase().includes("JERRY")
  return nameMatch || idMatch
}

// Create tooltip element
function createTooltip(item) {
  const tooltip = document.createElement("div")
  tooltip.className = "tooltip"

  let loreText = ""
  if (item.lore) {
    loreText = item.lore
  } else if (item.description) {
    loreText = item.description
  }

  tooltip.innerHTML = `
        <div class="tooltip-name">${item.name || "Unknown Item"}</div>
        <div class="tooltip-id">${item.id || "unknown_id"}</div>
        ${loreText ? `<div class="tooltip-lore">${loreText}</div>` : ""}
    `

  return tooltip
}

// Position tooltip near cursor
function positionTooltip(tooltip, event) {
  const padding = 20

  // Force tooltip to calculate dimensions
  tooltip.style.display = "block"
  const tooltipRect = tooltip.getBoundingClientRect()

  let x = event.clientX + padding
  let y = event.clientY + padding

  // Keep tooltip within viewport horizontally
  if (x + tooltipRect.width > window.innerWidth - 10) {
    x = event.clientX - tooltipRect.width - padding
  }

  // Ensure minimum left position
  if (x < 10) {
    x = 10
  }

  // Keep tooltip within viewport vertically
  if (y + tooltipRect.height > window.innerHeight - 10) {
    y = event.clientY - tooltipRect.height - padding
  }

  // Ensure minimum top position
  if (y < 10) {
    y = 10
  }

  tooltip.style.left = `${x}px`
  tooltip.style.top = `${y}px`
}

// Create item card
function createItemCard(item, index) {
  const card = document.createElement("div")
  card.className = "item-card"

  const header = document.createElement("div")
  header.className = "item-header"

  // Checkbox
  const checkboxContainer = document.createElement("div")
  checkboxContainer.className = "checkbox-container"

  const checkbox = document.createElement("input")
  checkbox.type = "checkbox"
  checkbox.id = `item-${index}`
  checkbox.addEventListener("change", updateStats)

  // Load saved state
  const savedState = localStorage.getItem(`jerry-item-${item.id}`)
  if (savedState === "true") {
    checkbox.checked = true
  }

  // Save state on change
  checkbox.addEventListener("change", () => {
    localStorage.setItem(`jerry-item-${item.id}`, checkbox.checked)
  })

  checkboxContainer.appendChild(checkbox)

  // Icon with tooltip
  const iconContainer = document.createElement("div")
  iconContainer.className = "icon-container"

  const icon = document.createElement("img")
  icon.className = "item-icon"

  const iconUrls = []

  if (item.texture) {
    iconUrls.push(`https://mc-heads.net/head/${item.texture}`)
  }

  if (item.skin) {
    const skinUrl = getSkinUrl(item.skin)
    if (skinUrl) {
      const textureMatch = skinUrl.match(/\/texture\/([a-f0-9]+)/)
      if (textureMatch && textureMatch[1]) {
        iconUrls.push(`https://mc-heads.net/head/${textureMatch[1]}`)
      }
    }
  }

  if (item.id) {
    iconUrls.push(`https://sky.shiiyu.moe/head/${item.id}`)
  }

  if (item.material) {
    const materialName = item.material.toLowerCase().replace(/_/g, "-")
    iconUrls.push(`https://mc-heads.net/minecraft/item/${materialName}`)
  }

  let currentUrlIndex = 0

  const tryNextUrl = () => {
    if (currentUrlIndex < iconUrls.length) {
      icon.src = iconUrls[currentUrlIndex]
      currentUrlIndex++
    } else {
      // Final fallback - question mark placeholder
      icon.src =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect fill='%23333' width='64' height='64'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='32' font-family='Arial'%3E?%3C/text%3E%3C/svg%3E"
    }
  }

  icon.onerror = tryNextUrl

  // Start loading first URL
  if (iconUrls.length > 0) {
    tryNextUrl()
  } else {
    icon.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect fill='%23333' width='64' height='64'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='32' font-family='Arial'%3E?%3C/text%3E%3C/svg%3E"
  }

  // Create and attach tooltip
  const tooltip = createTooltip(item)
  document.body.appendChild(tooltip)

  let tooltipVisible = false
  let tooltipTimeout = null

  iconContainer.addEventListener("mouseenter", (e) => {
    clearTimeout(tooltipTimeout)
    tooltipVisible = true
    tooltip.classList.add("show")
    positionTooltip(tooltip, e)
  })

  iconContainer.addEventListener("mousemove", (e) => {
    if (tooltipVisible) {
      positionTooltip(tooltip, e)
    }
  })

  iconContainer.addEventListener("mouseleave", () => {
    tooltipVisible = false
    // Small delay before hiding to prevent flicker
    tooltipTimeout = setTimeout(() => {
      tooltip.classList.remove("show")
    }, 100)
  })

  iconContainer.addEventListener("touchstart", (e) => {
    e.preventDefault()
    clearTimeout(tooltipTimeout)
    tooltipVisible = !tooltipVisible

    if (tooltipVisible) {
      tooltip.classList.add("show")
      positionTooltip(tooltip, e.touches[0])
    } else {
      tooltip.classList.remove("show")
    }
  })

  iconContainer.appendChild(icon)

  header.appendChild(checkboxContainer)
  header.appendChild(iconContainer)

  // Item name
  const name = document.createElement("div")
  name.className = "item-name"
  name.textContent = item.name || "Unknown Item"

  card.appendChild(header)
  card.appendChild(name)

  return card
}

// Update stats display
function updateStats() {
  const checkboxes = document.querySelectorAll('.item-card input[type="checkbox"]')
  const checked = Array.from(checkboxes).filter((cb) => cb.checked).length
  const total = checkboxes.length

  document.getElementById("checked-count").textContent = checked
  document.getElementById("total-count").textContent = total
}

// Fetch and display items
async function loadJerryItems() {
  const loadingEl = document.getElementById("loading")
  const errorEl = document.getElementById("error")
  const statsEl = document.getElementById("stats")
  const gridEl = document.getElementById("items-grid")

  try {
    const response = await fetch("https://api.hypixel.net/resources/skyblock/items")

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const items = data.items || []

    // Filter Jerry items
    const jerryItems = items.filter(isJerryItem)

    if (jerryItems.length === 0) {
      throw new Error("No Jerry items found!")
    }

    // Display items
    jerryItems.forEach((item, index) => {
      const card = createItemCard(item, index)
      gridEl.appendChild(card)
    })

    // Show stats
    loadingEl.style.display = "none"
    statsEl.style.display = "inline-block"
    updateStats()
  } catch (error) {
    console.error("Error loading Jerry items:", error)
    loadingEl.style.display = "none"
    errorEl.textContent = `Error: ${error.message}`
    errorEl.style.display = "inline-block"
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", loadJerryItems)
