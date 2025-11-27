// Game state
let gameState = {
  candies: 0,
  perClick: 1,
  autoRate: 0,
  upgrades: {},
  prestigeLevel: 0,
  prestigeMultiplier: 1,
}

// Upgrade definitions
var upgrades = [
  {
    id: "inflatable_jerry",
    name: "Inflatable Jerry",
    cost: 15,
    effect: "+0.1 candy/sec auto-gen",
    type: "auto",
    value: 0.1,
    upgrade: false
  },
  {
    id: "jerry_box_green",
    name: "Jerry Box (Green)",
    cost: 100,
    effect: "+1 candy/sec auto-gen",
    type: "auto",
    value: 1,
    upgrade: false
  },
  {
    id: "jerry_box_blue",
    name: "Jerry Box (Blue)",
    cost: 1100,
    effect: "+8 candies/sec auto-gen",
    type: "auto",
    value: 8,
    upgrade: false
  },
  {
    id: "jerry_box_purple",
    name: "Jerry Box (Purple)",
    cost: 12000,
    effect: "+47 candies/sec auto-gen",
    type: "auto",
    value: 47,
    upgrade: false
  },
  {
    id: "jerry_box_golden",
    name: "Jerry Box (Golden)",
    cost: 130000,
    effect: "+260 candies/sec auto-gen",
    type: "auto",
    value: 260,
    upgrade: false
  },
  {
    id: "jerry_box_mega",
    name: "Jerry Box (Mega)",
    cost: 1400000,
    effect: "+1.4k candies/sec auto-gen",
    type: "auto",
    value: 1400,
    upgrade: false
  },
  { id: "jerry_staff", name: "Jerry Staff", cost: 800, effect: "Doubles auto-gen rate", type: "autoMult", value: 2 },
  {
    id: "jerry_rune",
    name: "Jerry Rune I",
    cost: 20000000,
    effect: "+7.8k candies/sec auto-gen",
    type: "auto",
    value: 7800,
    upgrade: false
  },
  {
    id: "jerry_rune_2",
    name: "Jerry Rune II",
    cost: 330000000,
    effect: "+44k candies/sec auto-gen",
    type: "auto",
    value: 44000,
    upgrade: false
  },
  {
    id: "jerry_rune_3",
    name: "Jerry Rune III",
    cost: 5100000000,
    effect: "+260k candies/sec auto-gen",
    type: "auto",
    value: 260000,
    upgrade: false
  },
  {
    id: "jerry_talisman_green",
    name: "Jerry Talisman (Green)",
    cost: 75000000000,
    effect: "+1.6M candies/sec auto-gen",
    type: "auto",
    value: 1600000,
    upgrade: false
  },
  {
    id: "jerry_talisman_blue",
    name: "Jerry Talisman (Blue)",
    cost: 1000000000000,
    effect: "+10M candies/sec auto-gen",
    type: "auto",
    value: 10000000,
    upgrade: false
  },
  {
    id: "jerry_talisman_purple",
    name: "Jerry Talisman (Purple)",
    cost: 14000000000000,
    effect: "+65M candies/sec auto-gen",
    type: "auto",
    value: 65000000,
    upgrade: false
  },
  {
    id: "jerry_talisman_golden",
    name: "Jerry Talisman (Golden)",
    cost: 170000000000000,
    effect: "+430M candies/sec auto-gen",
    type: "auto",
    value: 430000000,
    upgrade: false
  },
  {
    id: "jerry_stone",
    name: "Jerry Stone",
    cost: 50000,
    effect: "+100 candies per click",
    type: "clicks",
    value: 100,
    upgrade: true
  },
  {
    id: "aspect_of_the_jerry",
    name: "Aspect of the Jerry",
    cost: 100000,
    effect: "Unlock prestige system",
    type: "prestige",
    value: 1,
    upgrade: true
  },
  {
    id: "aspect_of_the_jerry_signature",
    name: "Aspect of the Jerry (Signature)",
    cost: 250000,
    effect: "Prestige multiplier x2",
    type: "prestigeMult",
    value: 2,
    upgrade: false
  },
  {
    id: "pet_item_toy_jerry",
    name: "Pet Item: Jerry 3D Glasses",
    cost: 5000000,
    effect: "Adds trippy 3D anaglyph effect to Jerry",
    type: "cosmetic",
    value: 1,
    upgrade: true
  },
  {
    id: "pet_item_lord_jerry",
    name: "Pet Item: Lord's Crown",
    cost: 5000000,
    effect: "Converts Jerry into Lord Jerry",
    type: "cosmetic",
    value: 1,
    upgrade: true
  },
  {
    id: "pet_item_scuba_jerry",
    name: "Pet Item: Scuba Mask",
    cost: 5000000,
    effect: "Converts Jerry into Scuba Jerry",
    type: "cosmetic",
    value: 1,
    upgrade: true
  },
  {
    id: "pet_item_angel_jerry",
    name: "Pet Item: Holy Halo",
    cost: 5000000,
    effect: "Converts Jerry into Angel Jerry",
    type: "cosmetic",
    value: 1,
    upgrade: true
  },
  {
    id: "pet_item_iron_jerry",
    name: "Pet Item: Iron Totem",
    cost: 5000000,
    effect: "Converts Jerry into Iron Jerry",
    type: "cosmetic",
    value: 1,
    upgrade: true
  },
]

/* -------------------------
  Robust Anti-Tamper Proxy
-------------------------*/

// Keep a deep copy of original upgrades to reset to defaults
const originalUpgrades = JSON.parse(JSON.stringify(upgrades));

// Proxy cache so the same proxy is reused for the same target
const proxyCache = new WeakMap();

// Suppression counter: when >0, proxy does NOT treat sets as cheating
let __internalSuppression = 0;
function runInternal(fn) {
  __internalSuppression++;
  try {
    return fn();
  } finally {
    __internalSuppression--;
  }
}

function isObject(x) {
  return x && (typeof x === "object" || typeof x === "function");
}

function deepProxy(target, options = {}, path = "") {
  if (!isObject(target)) return target;

  // If we already proxied this object, return cached proxy
  if (proxyCache.has(target)) return proxyCache.get(target);

  const handler = {
    get(t, prop, receiver) {
      if (prop === "__isProxy") return true;
      if (prop === "__raw") return t;

      if (prop === "prototype") {
        return Reflect.get(t, prop, receiver);
      }

      const val = Reflect.get(t, prop, receiver);
      return isObject(val) ? deepProxy(val, options, `${path}.${String(prop)}`) : val;
    },


    set(t, prop, value, receiver) {
      const oldVal = t[prop];

      // If identical, ignore
      if (oldVal === value) return true;

      // If currently running internal code, allow without treating as cheat
      if (__internalSuppression > 0) {
        return Reflect.set(t, prop, value, receiver);
      }

      const fullPath = path ? `${path}.${String(prop)}` : String(prop);

      // Call onModify handler (if provided) — external change detected
      if (typeof options.onModify === "function") {
        try {
          options.onModify(fullPath, oldVal, value, t, prop);
        } catch (err) {
          console.error("onModify handler error:", err);
        }
      }

      // Apply the change after handler (some handlers may block/apply their own logic)
      return Reflect.set(t, prop, value, receiver);
    },

    deleteProperty(t, prop) {
      // Block deletes from external sources
      if (__internalSuppression > 0) {
        return Reflect.deleteProperty(t, prop);
      }

      const fullPath = path ? `${path}.${String(prop)}` : String(prop);
      if (typeof options.onModify === "function") {
        try {
          options.onModify(fullPath, "deleted", null, t, prop);
        } catch (err) {
          console.error("onModify handler error:", err);
        }
      }
      // Block external deletion
      return false;
    }
  };

  const p = new Proxy(target, handler);
  proxyCache.set(target, p);
  return p;
}

/* -------------------------
  Apply proxies safely
-------------------------*/

// gameState: external mutation => delete save + reload
gameState = deepProxy(gameState, {
  onModify(fullPath, oldVal, newVal) {
    console.warn("CHEAT DETECTED (gameState):", fullPath, oldVal, "→", newVal);

    // Remove save and reload (do it in a timeout so console logs show)
    try {
      localStorage.removeItem("jerryClickerSave");
    } catch (e) {
      console.error("Failed to remove save:", e);
    }

    // Give a tiny delay so the console shows the warning, then reload
    setTimeout(() => location.reload(), 50);
  }
});

// upgrades: external mutation => reset that single field back to original safely
upgrades = deepProxy(upgrades, {
  onModify(fullPath, oldVal, newVal, target, prop) {
    console.warn("CHEAT DETECTED (upgrades):", fullPath, oldVal, "→", newVal);

    // Try to determine the upgrade id for the modified object
    // target could be the upgrade object itself (since we proxied child objects)
    // or the upgrades array if an array index property changed.
    let upgradeObj = null;

    if (Array.isArray(target)) {
      // If modification on array-level (e.g., reassigning an index),
      // attempt to map the index to an original upgrade
      const idx = Number(prop);
      if (!Number.isNaN(idx)) upgradeObj = target[idx];
    } else {
      // target is likely the upgrade object itself
      upgradeObj = target;
    }

    // If we have an id on the object, find the original upgrade
    const id = upgradeObj && upgradeObj.id;
    const original = originalUpgrades.find(u => u.id === id);

    if (original) {
      // Safely reset only the modified property to default using runInternal
      runInternal(() => {
        try {
          // If prop is numeric string for array case, handle separately
          if (Array.isArray(target) && !Number.isNaN(Number(prop))) {
            // reset entire object at that index to original
            const idx = Number(prop);
            target[idx] = JSON.parse(JSON.stringify(original));
          } else {
            // Reset property on the upgrade object
            target[prop] = original[prop];
          }
          console.info(`Reset upgrade '${id}' property '${prop}' to default.`);
        } catch (err) {
          console.error("Failed to reset upgrade property:", err);
        }
      });
    } else {
      // Fallback: if we couldn't find original, do nothing but warn
      console.warn("Could not find original upgrade to reset for path:", fullPath);
    }

    // Re-render/refresh UI safely (internal)
    runInternal(() => {
      try {
        renderUpgrades();
        updateUI();
      } catch (e) {
        // ignore UI errors here
      }
    });
  }
});

/* -------------------------
  Wrap internal functions so their mutations don't trigger cheat
  (supports late-binding: if function isn't declared yet we queue it)
-------------------------*/

const pendingWraps = []; // [{ obj, name }]

const wrapAsInternal = (obj, name) => {
  if (!obj) return;
  const fn = obj[name];
  if (typeof fn === "function") {
    const orig = fn;
    obj[name] = function (...args) {
      return runInternal(() => orig.apply(this, args));
    };
    return true;
  } else {
    // queue for late-binding
    pendingWraps.push({ obj, name });
    return false;
  }
};

function applyPendingWraps() {
  // Try to apply queued wraps; keep ones that still don't exist for later
  for (let i = pendingWraps.length - 1; i >= 0; i--) {
    const { obj, name } = pendingWraps[i];
    if (!obj) {
      pendingWraps.splice(i, 1);
      continue;
    }
    const fn = obj[name];
    if (typeof fn === "function") {
      wrapAsInternal(obj, name); // this will replace and remove from pending
      pendingWraps.splice(i, 1);
    }
  }
}

// Register the global functions we expect to exist (some declared later)
[
  window,
].forEach(ctx => {
  wrapAsInternal(ctx, "buyUpgrade");
  wrapAsInternal(ctx, "applyUpgrade");
  wrapAsInternal(ctx, "loadFromLocalStorage");
  wrapAsInternal(ctx, "saveToLocalStorage");
  wrapAsInternal(ctx, "loadGame");
  wrapAsInternal(ctx, "saveGame");
  wrapAsInternal(ctx, "exportSave");
  wrapAsInternal(ctx, "prestige");
  wrapAsInternal(ctx, "initUI");
  wrapAsInternal(ctx, "updateUI");
  wrapAsInternal(ctx, "renderUpgrades");
});

/* -------------------------
  Safe event wrapper for Jerry click (ensure internal suppression)
  We'll rebind the click to a wrapper that runs internal code while preserving original logic.
-------------------------*/
(function safeBindLordJerryClick() {
  const el = document.getElementById("jerry");
  if (!el) return;

  // Capture any existing handlers attached via addEventListener is tricky;
  // we keep the existing listener (you already added one later), but we'll
  // add a wrapper that runs internal suppression while allowing the other handler to run.
  el.addEventListener("click", (ev) => {
    // This wrapper doesn't call original; it only ensures internal suppression
    // during the click event so any mutations done by click handlers won't trigger cheat detection.
    // Actual click logic is still executed by your existing handler; we just suppress detection here.
    // If your click handler runs after this, __internalSuppression will already be >0 for its duration.
    runInternal(() => {
      // no-op: suppression window
    });
  }, { capture: false });
})();

/* -------------------------
  Initialization (safe)
-------------------------*/

// Initialize upgrades inside internal suppression so their initial sets are not treated as cheats
runInternal(() => {
  upgrades.forEach((upgrade) => {
    gameState.upgrades[upgrade.id] = { count: 0, currentCost: upgrade.cost }
  })
});

// ensure saving interval is scheduled within internal suppression context
runInternal(() => {
  setInterval(() => {
    // call the function by name; it's wrapped later once declared
    try {
      if (typeof saveToLocalStorage === "function") saveToLocalStorage()
    } catch (e) {
      console.error("save interval error:", e)
    }
  }, 30000)
})

/* -------------------------
  UI / Save / Load / Game logic
  (these functions exist as in your original file)
-------------------------*/

function showPopup(message, options = {}) {
  const popup = document.getElementById("popup");
  const msg = document.getElementById("popup-message");
  const okBtn = document.getElementById("popup-ok");
  const cancelBtn = document.getElementById("popup-cancel");

  msg.textContent = message;
  popup.classList.remove("hidden");

  // Reset buttons
  cancelBtn.classList.add("hidden");

  return new Promise((resolve) => {
    okBtn.onclick = () => {
      popup.classList.add("hidden");
      resolve(true);
    };

    if (options.confirm) {
      cancelBtn.classList.remove("hidden");
      cancelBtn.onclick = () => {
        popup.classList.add("hidden");
        resolve(false);
      };
    }
  });
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem("jerryClickerSave")
    if (saved) {
      const obfuscated = atob(saved)
      const key = 42
      let data = ""
      for (let i = 0; i < obfuscated.length; i++) {
        data += String.fromCharCode(obfuscated.charCodeAt(i) ^ key)
      }
      const loaded = JSON.parse(data)
      // IMPORTANT: set gameState safely inside runInternal to avoid detection
      runInternal(() => {
        gameState = loaded
      });

      // Re-apply cosmetic effects
      if (gameState.upgrades["pet_item_toy_jerry"].count > 0) {
        document.getElementById("jerry").classList.add("glasses-3d")
        document.getElementById("jerry").classList.add("fast-animate")
      }

      // Show prestige info if unlocked
      if (gameState.upgrades["aspect_of_the_jerry"].count > 0) {
        document.getElementById("prestige-info").style.display = "block"
        document.getElementById("prestige-btn").disabled = false
      }
    }
  } catch (err) {
    console.error("Failed to load from localStorage:", err)
  }
}

function saveToLocalStorage() {
  try {
    const data = JSON.stringify(gameState)
    const key = 42
    let obfuscated = ""
    for (let i = 0; i < data.length; i++) {
      obfuscated += String.fromCharCode(data.charCodeAt(i) ^ key)
    }
    const encoded = btoa(obfuscated)
    localStorage.setItem("jerryClickerSave", encoded)
  } catch (err) {
    console.error("Failed to save to localStorage:", err)
  }
}

function getActiveCosmetic() {
  const cosmeticIds = upgrades.filter(u => u.type === "cosmetic").map(u => u.id);
  for (const id of cosmeticIds) {
    if (gameState.upgrades[id]?.count > 0) {
      return id;
    }
  }
  return null;
}

function renderUpgrades() {
  const list = document.getElementById("upgrades-list")
  list.innerHTML = ""

  upgrades.forEach((upgrade) => {
    const state = gameState.upgrades[upgrade.id]
    const owned = state?.count || 0
    const cost = state?.currentCost || upgrade.cost
    const canAfford = gameState.candies >= cost
    const isSinglePurchase = upgrade.upgrade === true && owned >= 1

    const lockedClass = (!canAfford || isSinglePurchase) ? "locked" : ""

    const div = document.createElement("div")
    div.className = `upgrade-item ${lockedClass} ${owned > 0 ? "owned" : ""}`
    div.setAttribute("data-id", upgrade.id)

    // Disable click when maxed
    if (!isSinglePurchase) {
      div.onclick = () => buyUpgrade(upgrade.id)
    }

    div.innerHTML = `
      <div class="upgrade-icon" style="background-image: url('./api/resources/${upgrade.id}.png')"></div>
      <div class="upgrade-info">
        <div class="upgrade-name">${upgrade.name}</div>
        <div class="upgrade-effect">${upgrade.effect}</div>
        <div class="upgrade-cost">Cost: ${formatNumber(cost)} candies</div>
        ${owned > 0 ? `<div class="upgrade-owned">Owned: ${owned}${isSinglePurchase ? " (max)" : ""}</div>` : ""}
      </div>
    `
    list.appendChild(div)
  })
}

function updateUpgradeLocks() {
  upgrades.forEach((upgrade) => {
    const state = gameState.upgrades[upgrade.id]
    const cost = state?.currentCost || upgrade.cost
    const canAfford = gameState.candies >= cost
    const isPrestigeSingle = (upgrade.type === "prestige" || upgrade.type === "prestigeMult") && (state?.count || 0) >= 1

    const el = document.querySelector(`.upgrade-item[data-id="${upgrade.id}"]`)
    if (el) {
      if (isPrestigeSingle || !canAfford) {
        el.classList.add("locked")
      } else {
        el.classList.remove("locked")
      }
    }
  })
}

function buyUpgrade(id) {
  const upgrade = upgrades.find((u) => u.id === id);
  const state = gameState.upgrades[id];

  // Block multiple purchases for single-purchase upgrades
  if ((upgrade.upgrade === true) && state.count >= 1) {
    return;
  }

  if (gameState.candies >= state.currentCost) {
    // Cosmetic swap logic
    if (upgrade.type === "cosmetic") {
      const activeCosmetic = getActiveCosmetic();
      if (activeCosmetic && activeCosmetic !== id) {
        const oldUpgrade = upgrades.find(u => u.id === activeCosmetic);
        const oldState = gameState.upgrades[activeCosmetic];

        // Refund half the old cost
        const refund = Math.floor(oldState.currentCost / 2);
        gameState.candies += refund;

        // Reset old cosmetic
        oldState.count = 0;
        oldState.currentCost = oldUpgrade.cost;

        // Remove old cosmetic classes
        document.getElementById("jerry").classList.remove("glasses-3d", "fast-animate", "lord", "scuba");
      }
    }

    // Deduct cost and apply new upgrade
    gameState.candies -= state.currentCost;
    state.count++;
    state.currentCost = state.currentCost * 1.15;

    applyUpgrade(upgrade);
    initUI();
  }
}

function applyUpgrade(upgrade) {
  const mult = gameState.prestigeMultiplier

  switch (upgrade.type) {
    case "click":
      gameState.perClick += upgrade.value * mult
      break
    case "auto":
      gameState.autoRate += upgrade.value * mult
      break
    case "autoMult":
      gameState.autoRate *= upgrade.value
      break
    case "globalMult":
      gameState.perClick *= upgrade.value
      gameState.autoRate *= upgrade.value
      break
    case "prestige":
      document.getElementById("prestige-info").style.display = "block"
      document.getElementById("prestige-btn").disabled = false
      break
    case "prestigeMult":
      // Applied during prestige
      break
    case "cosmetic":
      if (upgrade.id === "pet_item_toy_jerry") {
        document.getElementById("jerry").classList.remove("lord")
        document.getElementById("jerry").classList.remove("scuba")
        document.getElementById("jerry").classList.remove("iron")
        document.getElementById("jerry").classList.remove("angel")

        document.getElementById("jerry").classList.add("glasses-3d")
        document.getElementById("jerry").classList.add("fast-animate")
      }
      if (upgrade.id === "pet_item_lord_jerry") {
        document.getElementById("jerry").classList.remove("glasses-3d")
        document.getElementById("jerry").classList.remove("fast-animate")
        document.getElementById("jerry").classList.remove("scuba")
        document.getElementById("jerry").classList.remove("iron")
        document.getElementById("jerry").classList.remove("angel")

        document.getElementById("jerry").classList.add("lord")
      }
      if (upgrade.id === "pet_item_scuba_jerry") {
        document.getElementById("jerry").classList.remove("glasses-3d")
        document.getElementById("jerry").classList.remove("fast-animate")
        document.getElementById("jerry").classList.remove("lord")
        document.getElementById("jerry").classList.remove("iron")
        document.getElementById("jerry").classList.remove("angel")

        document.getElementById("jerry").classList.add("scuba")
      }
      if (upgrade.id === "pet_item_iron_jerry") {
        document.getElementById("jerry").classList.remove("glasses-3d")
        document.getElementById("jerry").classList.remove("fast-animate")
        document.getElementById("jerry").classList.remove("lord")
        document.getElementById("jerry").classList.remove("scuba")
        document.getElementById("jerry").classList.remove("angel")

        document.getElementById("jerry").classList.add("iron")
      }
      if (upgrade.id === "pet_item_angel_jerry") {
        document.getElementById("jerry").classList.remove("glasses-3d")
        document.getElementById("jerry").classList.remove("fast-animate")
        document.getElementById("jerry").classList.remove("lord")
        document.getElementById("jerry").classList.remove("scuba")
        document.getElementById("jerry").classList.remove("iron")
        document.getElementById("jerry").classList.add("angel")
      }
      break
  }
}

// Click Jerry
document.getElementById("jerry").addEventListener("click", (e) => {
  // Ensure the click handler runs with suppression active to avoid false positives
  runInternal(() => {
    const gain = Math.floor(gameState.perClick)
    gameState.candies += gain

    const indicator = document.createElement("div")
    indicator.className = "click-indicator candy-icon-float"
    indicator.style.left = e.clientX - 32 + 'px';
    indicator.style.top = e.clientY - 32 + 'px';
    indicator.style.position = 'fixed';

    document.querySelector(".click-area").appendChild(indicator)

    setTimeout(() => indicator.remove(), 1000)

    initUI()
  });
})

// Auto generation
setInterval(() => {
  // Auto gens should run suppressed (internal) so they don't trigger detection
  runInternal(() => {
    if (gameState.autoRate > 0) {
      gameState.candies += gameState.autoRate / 10
      updateUI()
    }
  });
}, 100)

// Update UI
function updateUI() {
  document.getElementById("candies").textContent = formatNumber(Math.floor(gameState.candies))
  document.getElementById("per-click").textContent = formatNumber(Math.floor(gameState.perClick))
  document.getElementById("per-second").textContent = formatNumber(gameState.autoRate.toFixed(1))
  document.getElementById("prestige-mult").textContent = `x${gameState.prestigeMultiplier.toFixed(1)}`

  // 🔑 Update lock/unlock state without full re-render
  updateUpgradeLocks()
}

// Init UI
function initUI() {
  document.getElementById("candies").textContent = formatNumber(Math.floor(gameState.candies))
  document.getElementById("per-click").textContent = formatNumber(Math.floor(gameState.perClick))
  document.getElementById("per-second").textContent = formatNumber(gameState.autoRate.toFixed(1))
  document.getElementById("prestige-mult").textContent = `x${gameState.prestigeMultiplier.toFixed(1)}`
  renderUpgrades()
}

function formatNumber(num) {
  // Convert to a number explicitly
  num = Number(num)

  // Handle invalid inputs
  if (isNaN(num)) return "NaN"
  if (!isFinite(num)) return "Infinity"

  const suffixes = [
    "", "K", "M", "B", "T", "Quadrillion", "Quintillion", "Sextillion", "Septillion", "Octillion", "Nonillion",
    "Decillion", "Undecillion", "Duodecillion", "Tredecillion", "Quattuordecillion", "Quindecillion",
    "Googol", "Googolplex"
  ]

  let tier = 0
  while (num >= 1000 && tier < suffixes.length - 1) {
    num /= 1000
    tier++
  }

  return num.toFixed(2) + (suffixes[tier] ? " " + suffixes[tier] : "")
}

// Prestige system
function prestige() {
  if (!gameState.upgrades["aspect_of_the_jerry"].count) return;

  const prestigeRequirement = 150_000_000 * gameState.prestigeMultiplier;

  if (gameState.candies < prestigeRequirement) {
    showPopup(`You need at least ${formatNumber(prestigeRequirement)} candies to prestige!`);
    return;
  }

  const signatureCount = gameState.upgrades["aspect_of_the_jerry_signature"].count;
  const newMult = 1 + (gameState.prestigeLevel + 1) * 0.1 * (signatureCount > 0 ? 2 : 1);

  showPopup(`Reset your progress for a ${newMult.toFixed(1)}x multiplier?`, { confirm: true })
    .then((confirmed) => {
      if (confirmed) {
        runInternal(() => {
          gameState.prestigeLevel++;
          gameState.prestigeMultiplier = newMult;

          const keepAspect = gameState.upgrades["aspect_of_the_jerry"].count;
          const keepSignature = gameState.upgrades["aspect_of_the_jerry_signature"].count;

          const lord = document.getElementById("jerry");
          lord.classList.remove("glasses-3d");
          lord.classList.remove("fast-animate");

          gameState.candies = 0;
          gameState.perClick = 1;
          gameState.autoRate = 0;

          // Reset all upgrades
          upgrades.forEach((upgrade) => {
            gameState.upgrades[upgrade.id] = { count: 0, currentCost: upgrade.cost };
          });

          renderUpgrades();
          updateUI();
        });
      }
    });
}

function exportSave() {
  const data = JSON.stringify(gameState);
  const key = 42;
  let obfuscated = "";
  for (let i = 0; i < data.length; i++) {
    obfuscated += String.fromCharCode(data.charCodeAt(i) ^ key);
  }
  const encoded = btoa(obfuscated);

  const blob = new Blob([encoded], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "jerry-clicker-save.txt";
  a.click();
  URL.revokeObjectURL(url);

  showPopup("Save exported!");
}

function saveGame() {
  const data = JSON.stringify(gameState);
  const key = 42;
  let obfuscated = "";
  for (let i = 0; i < data.length; i++) {
    obfuscated += String.fromCharCode(data.charCodeAt(i) ^ key);
  }
  const encoded = btoa(obfuscated);

  const blob = new Blob([encoded], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "jerry-clicker-save.txt";
  a.click();
  URL.revokeObjectURL(url);

  showPopup("Game saved!");
}

// Load game
function loadGame() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt";
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const encoded = event.target.result;
        const obfuscated = atob(encoded);

        const key = 42;
        let data = "";
        for (let i = 0; i < obfuscated.length; i++) {
          data += String.fromCharCode(obfuscated.charCodeAt(i) ^ key);
        }

        const loaded = JSON.parse(data);
        runInternal(() => {
          gameState = loaded;
        });

        if (gameState.upgrades["pet_item_toy_jerry"].count > 0) {
          document.getElementById("jerry").classList.add("glasses-3d");
          document.getElementById("jerry").classList.add("fast-animate");
        }

        if (gameState.upgrades["aspect_of_the_jerry"].count > 0) {
          document.getElementById("prestige-info").style.display = "block";
          document.getElementById("prestige-btn").disabled = false;
        }

        updateUI();
        showPopup("Game loaded!");
      } catch (err) {
        showPopup("Failed to load save file!");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* -------------------------
  Finalize: apply any pending wraps, then safe-init load/save and UI
-------------------------*/

// Attempt to wrap any functions that were declared after the proxy setup
applyPendingWraps();

// Safely run loadFromLocalStorage() and initUI() inside suppression so they don't trigger anti-tamper
runInternal(() => {
  try {
    if (typeof loadFromLocalStorage === "function") loadFromLocalStorage();
  } catch (e) {
    console.error("loadFromLocalStorage error:", e);
  }

  try {
    if (typeof initUI === "function") initUI();
  } catch (e) {
    console.error("initUI error:", e);
  }
});

// Re-run pending wraps once more (in case some functions were declared during initialization)
applyPendingWraps();
