document.addEventListener("DOMContentLoaded", () => {
  const PASSWORD_ENCODED = "dGVhZ2xlcw==";

  const STAT_KEYS = [
    "fg_made", "fg_attempted", "three_pt_made", "three_pt_attempted",
    "ft_made", "ft_attempted", "o_rebounds", "d_rebounds",
    "assists", "steals", "jump_balls", "blocks", "turnovers", "fouls"
  ];

  let authenticated = false;
  let guestPlayers = [];   // [{number, name}]
  let editingGameId = null; // null = new game, string = editing existing
  let allGames = [];        // cached games for edit mode

  // --- Password Gate ---
  const overlay = document.getElementById("password-overlay");
  const pwInput = document.getElementById("password-input");
  const pwSubmit = document.getElementById("password-submit");
  const pwError = document.getElementById("password-error");

  function checkPassword() {
    if (btoa(pwInput.value) === PASSWORD_ENCODED) {
      authenticated = true;
      overlay.style.display = "none";
      document.getElementById("entry-content").style.display = "block";
      renderTable();
      loadAllGames();
    } else {
      pwError.style.display = "block";
      pwInput.value = "";
      pwInput.focus();
    }
  }
  pwSubmit.addEventListener("click", checkPassword);
  pwInput.addEventListener("keydown", e => { if (e.key === "Enter") checkPassword(); });

  // Default date
  document.getElementById("game-date").value = new Date().toISOString().split("T")[0];

  // --- Helpers ---
  function getTeam() { return document.getElementById("team-select").value; }
  function getOtherTeam() { return getTeam() === "White" ? "Blue" : "White"; }

  // --- Mode Tabs (New / Edit) ---
  const modeNew = document.getElementById("mode-new");
  const modeEdit = document.getElementById("mode-edit");
  const editControls = document.getElementById("edit-controls");

  modeNew.addEventListener("click", () => {
    modeNew.classList.add("active");
    modeEdit.classList.remove("active");
    editControls.style.display = "none";
    document.getElementById("delete-game-btn").style.display = "none";
    editingGameId = null;
    resetForm();
  });

  modeEdit.addEventListener("click", () => {
    modeEdit.classList.add("active");
    modeNew.classList.remove("active");
    editControls.style.display = "flex";
    populateEditDropdown();
  });

  // --- Load all games for edit dropdown ---
  async function loadAllGames() {
    try {
      const snapshot = await db.collection("games").get();
      allGames = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.error("Error loading games:", err);
    }
  }

  function populateEditDropdown() {
    const select = document.getElementById("edit-game-select");
    select.innerHTML = '<option value="">Select a game...</option>';

    const sorted = [...allGames].sort((a, b) =>
      (b.game_info?.date || "").localeCompare(a.game_info?.date || "")
    );

    sorted.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.id;
      const info = g.game_info || {};
      opt.textContent = `${info.date || "?"} — Team ${g.team} vs ${info.opponent || "?"} (${info.score_te ?? "?"}-${info.score_opponent ?? "?"})`;
      select.appendChild(opt);
    });
  }

  // Load selected game into the form
  document.getElementById("load-game-btn").addEventListener("click", () => {
    const gameId = document.getElementById("edit-game-select").value;
    if (!gameId) return;

    const game = allGames.find(g => g.id === gameId);
    if (!game) return;

    editingGameId = gameId;
    document.getElementById("delete-game-btn").style.display = "inline-block";

    // Fill game info
    document.getElementById("team-select").value = game.team;
    const info = game.game_info || {};
    document.getElementById("game-date").value = info.date || "";
    document.getElementById("opponent").value = info.opponent || "";
    document.getElementById("league").value = info.league || "";
    document.getElementById("score-te").value = info.score_te ?? "";
    document.getElementById("score-opponent").value = info.score_opponent ?? "";

    // Identify guest players
    guestPlayers = [];
    if (game.players) {
      game.players.forEach(p => {
        if (p.is_guest) {
          guestPlayers.push({ number: p.number, name: p.name });
        }
      });
    }

    renderTable();

    // Fill in stat values from the loaded game
    if (game.players) {
      game.players.forEach(p => {
        const row = document.querySelector(`tr[data-number="${p.number}"]`);
        if (!row) return;

        if (!p.played) {
          const btn = row.querySelector(".dnp-btn");
          if (btn) { btn.click(); }
          return;
        }

        if (p.stats) {
          STAT_KEYS.forEach(key => {
            const input = row.querySelector(`input[data-stat="${key}"]`);
            if (input) input.value = p.stats[key] || 0;
          });
        }
      });
      updateTotals();
    }

    document.getElementById("save-btn").textContent = "Update Game";
  });

  // Delete game
  document.getElementById("delete-game-btn").addEventListener("click", async () => {
    if (!editingGameId) return;
    if (!confirm("Are you sure you want to delete this game? This cannot be undone.")) return;

    try {
      await db.collection("games").doc(editingGameId).delete();
      allGames = allGames.filter(g => g.id !== editingGameId);
      editingGameId = null;
      resetForm();
      populateEditDropdown();
      alert("Game deleted.");
    } catch (err) {
      console.error("Error deleting game:", err);
      alert("Error deleting game: " + err.message);
    }
  });

  // --- Render Spreadsheet Table ---
  function renderTable() {
    const tbody = document.getElementById("entry-body");
    tbody.innerHTML = "";

    const team = getTeam();
    const players = TEAMS[team].players;

    players.forEach(p => addPlayerRow(p, false));
    guestPlayers.forEach(gp => addPlayerRow(gp, true));

    populateGuestDropdown();
    updateTotals();
  }

  function addPlayerRow(player, isGuest) {
    const tbody = document.getElementById("entry-body");
    const tr = document.createElement("tr");
    tr.dataset.number = player.number;
    tr.dataset.name = player.name;
    tr.dataset.guest = isGuest ? "true" : "false";
    if (isGuest) {
      tr.classList.add("guest-row");
      tr.dataset.homeTeam = getOtherTeam();
    }

    // Number
    const tdNum = document.createElement("td");
    tdNum.className = "player-num";
    tdNum.textContent = player.number;
    tr.appendChild(tdNum);

    // Name
    const tdName = document.createElement("td");
    tdName.className = "player-name";
    tdName.textContent = player.name;
    if (isGuest) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-guest-btn";
      removeBtn.textContent = "x";
      removeBtn.title = "Remove guest";
      removeBtn.addEventListener("click", () => {
        guestPlayers = guestPlayers.filter(g => g.number !== player.number);
        tr.remove();
        populateGuestDropdown();
        updateTotals();
      });
      tdName.appendChild(removeBtn);
    }
    tr.appendChild(tdName);

    // Stat inputs
    STAT_KEYS.forEach(key => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "99";
      input.value = "0";
      input.dataset.stat = key;
      input.addEventListener("input", updateTotals);
      td.appendChild(input);
      tr.appendChild(td);
    });

    // DNP toggle
    const tdDnp = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "dnp-btn";
    btn.textContent = "Active";
    btn.addEventListener("click", () => {
      const isDnp = tr.classList.toggle("dnp-row");
      btn.classList.toggle("is-dnp", isDnp);
      btn.textContent = isDnp ? "DNP" : "Active";
      tr.querySelectorAll('input[type="number"]').forEach(inp => {
        inp.disabled = isDnp;
        if (isDnp) inp.value = "0";
      });
      updateTotals();
    });
    tdDnp.appendChild(btn);
    tr.appendChild(tdDnp);

    tbody.appendChild(tr);
  }

  function updateTotals() {
    const tfoot = document.getElementById("entry-foot");
    tfoot.innerHTML = "";
    const tr = document.createElement("tr");
    tr.className = "totals-row";

    const tdBlank = document.createElement("td");
    tr.appendChild(tdBlank);
    const tdLabel = document.createElement("td");
    tdLabel.className = "player-name";
    tdLabel.textContent = "Totals";
    tdLabel.style.position = "static";
    tr.appendChild(tdLabel);

    STAT_KEYS.forEach(key => {
      const td = document.createElement("td");
      let total = 0;
      document.querySelectorAll(`#entry-body tr:not(.dnp-row) input[data-stat="${key}"]`).forEach(inp => {
        total += parseInt(inp.value) || 0;
      });
      td.textContent = total;
      tr.appendChild(td);
    });

    const tdEmpty = document.createElement("td");
    tr.appendChild(tdEmpty);
    tfoot.appendChild(tr);
  }

  // --- Guest Player Controls ---
  function populateGuestDropdown() {
    const select = document.getElementById("guest-select");
    const otherTeam = getOtherTeam();
    const existingNums = guestPlayers.map(g => g.number);

    select.innerHTML = '<option value="">Select a player from the other team...</option>';
    TEAMS[otherTeam].players.forEach(p => {
      if (!existingNums.includes(p.number)) {
        const opt = document.createElement("option");
        opt.value = p.number;
        opt.textContent = `#${p.number} ${p.name}`;
        select.appendChild(opt);
      }
    });
  }

  document.getElementById("add-guest-btn").addEventListener("click", () => {
    const select = document.getElementById("guest-select");
    const val = select.value;
    if (!val) return;

    const otherTeam = getOtherTeam();
    const player = TEAMS[otherTeam].players.find(p => p.number === parseInt(val));
    if (!player) return;

    guestPlayers.push({ number: player.number, name: player.name });
    addPlayerRow(player, true);
    populateGuestDropdown();
    updateTotals();
  });

  // Team change: re-render
  document.getElementById("team-select").addEventListener("change", () => {
    guestPlayers = [];
    editingGameId = null;
    document.getElementById("save-btn").textContent = "Save Game";
    document.getElementById("delete-game-btn").style.display = "none";
    renderTable();
  });

  // --- Save Game ---
  document.getElementById("save-btn").addEventListener("click", async () => {
    if (!authenticated) return;

    const team = getTeam();
    const date = document.getElementById("game-date").value;
    const opponent = document.getElementById("opponent").value.trim();
    const league = document.getElementById("league").value.trim();
    const scoreTe = parseInt(document.getElementById("score-te").value) || 0;
    const scoreOpp = parseInt(document.getElementById("score-opponent").value) || 0;

    if (!date || !opponent) {
      alert("Please fill in the date and opponent fields.");
      return;
    }

    // Build players array from table rows
    const rows = document.querySelectorAll("#entry-body tr");
    const players = [];

    rows.forEach(tr => {
      const isDnp = tr.classList.contains("dnp-row");
      const playerObj = {
        number: parseInt(tr.dataset.number),
        name: tr.dataset.name,
        played: !isDnp,
        is_guest: tr.dataset.guest === "true"
      };

      if (playerObj.is_guest) {
        playerObj.home_team = tr.dataset.homeTeam;
      }

      if (!isDnp) {
        const stats = {};
        tr.querySelectorAll("[data-stat]").forEach(inp => {
          stats[inp.dataset.stat] = parseInt(inp.value) || 0;
        });
        playerObj.stats = stats;
      }

      players.push(playerObj);
    });

    const gameData = {
      team,
      game_info: {
        date, opponent, league,
        score_te: scoreTe,
        score_opponent: scoreOpp
      },
      players
    };

    try {
      const saveBtn = document.getElementById("save-btn");
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      if (editingGameId) {
        await db.collection("games").doc(editingGameId).set(gameData);
        // Update local cache
        const idx = allGames.findIndex(g => g.id === editingGameId);
        if (idx >= 0) allGames[idx] = { id: editingGameId, ...gameData };
      } else {
        const docRef = await db.collection("games").add(gameData);
        allGames.push({ id: docRef.id, ...gameData });
      }

      document.getElementById("success-message").style.display = "block";
      saveBtn.style.display = "none";
    } catch (err) {
      console.error("Error saving game:", err);
      alert("Error saving game: " + err.message);
      const saveBtn = document.getElementById("save-btn");
      saveBtn.disabled = false;
      saveBtn.textContent = editingGameId ? "Update Game" : "Save Game";
    }
  });

  // Enter another
  document.getElementById("enter-another").addEventListener("click", (e) => {
    e.preventDefault();
    resetForm();
    window.scrollTo(0, 0);
  });

  function resetForm() {
    document.getElementById("success-message").style.display = "none";
    const saveBtn = document.getElementById("save-btn");
    saveBtn.style.display = "inline-block";
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Game";

    editingGameId = null;
    document.getElementById("delete-game-btn").style.display = "none";
    document.getElementById("opponent").value = "";
    document.getElementById("league").value = "";
    document.getElementById("score-te").value = "";
    document.getElementById("score-opponent").value = "";
    document.getElementById("game-date").value = new Date().toISOString().split("T")[0];

    guestPlayers = [];
    renderTable();
  }

  // --- Import JSON ---
  document.getElementById("import-json-btn").addEventListener("click", () => {
    const raw = document.getElementById("json-import").value.trim();
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      applyImportData(data);
      document.getElementById("json-import").value = "";
      alert("JSON imported! Review the form and click Save.");
    } catch (err) {
      alert("Invalid JSON. Please check the format and try again.");
    }
  });

  function applyImportData(data) {
    if (data.game_info) {
      if (data.game_info.date) document.getElementById("game-date").value = data.game_info.date;
      if (data.game_info.opponent) document.getElementById("opponent").value = data.game_info.opponent;
      if (data.game_info.league) document.getElementById("league").value = data.game_info.league;
      if (data.game_info.score_te != null) document.getElementById("score-te").value = data.game_info.score_te;
      if (data.game_info.score_opponent != null) document.getElementById("score-opponent").value = data.game_info.score_opponent;
    }

    if (data.team) {
      document.getElementById("team-select").value = data.team;
      guestPlayers = [];
      renderTable();
    }

    const playersData = data.players || data;
    if (!Array.isArray(playersData)) return;

    playersData.forEach(p => {
      const num = p.number || p.jersey_number;
      if (num == null) return;

      const row = document.querySelector(`tr[data-number="${num}"]`);
      if (!row) return;

      if (p.played === false || p.dnp) {
        const btn = row.querySelector(".dnp-btn");
        if (btn && !row.classList.contains("dnp-row")) btn.click();
        return;
      }

      const stats = p.stats || p;
      row.querySelectorAll("[data-stat]").forEach(inp => {
        const key = inp.dataset.stat;
        if (stats[key] != null) inp.value = stats[key];
      });
    });
    updateTotals();
  }
});
