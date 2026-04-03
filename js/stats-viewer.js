document.addEventListener("DOMContentLoaded", () => {
  const STATS_PASSWORD_ENCODED = "VEUyMDMw";

  // --- Password Gate ---
  const overlay = document.getElementById("password-overlay");
  const pwInput = document.getElementById("password-input");
  const pwSubmit = document.getElementById("password-submit");
  const pwError = document.getElementById("password-error");

  function checkPassword() {
    if (btoa(pwInput.value) === STATS_PASSWORD_ENCODED) {
      overlay.style.display = "none";
      loadGames();
    } else {
      pwError.style.display = "block";
      pwInput.value = "";
      pwInput.focus();
    }
  }
  pwSubmit.addEventListener("click", checkPassword);
  pwInput.addEventListener("keydown", e => { if (e.key === "Enter") checkPassword(); });

  let allGames = [];
  let currentTeam = "White";
  let selectedGameIds = "all"; // "all" or Set<string>
  let showTotals = false;
  let sortCol = null;
  let sortAsc = true;

  const COLUMNS = [
    { key: "number",       label: "#",    type: "int" },
    { key: "name",         label: "Name", type: "str" },
    { key: "gp",           label: "GP",   type: "int" },
    { key: "pts",          label: "PTS",  type: "num" },
    { key: "fg",           label: "FG",   type: "str" },
    { key: "fg_pct",       label: "FG%",  type: "num" },
    { key: "three_pt",     label: "3PT",  type: "str" },
    { key: "three_pt_pct", label: "3PT%", type: "num" },
    { key: "ft",           label: "FT",   type: "str" },
    { key: "ft_pct",       label: "FT%",  type: "num" },
    { key: "reb",          label: "REB",  type: "num" },
    { key: "o_rebounds",   label: "OREB", type: "num" },
    { key: "d_rebounds",   label: "DREB", type: "num" },
    { key: "assists",      label: "AST",  type: "num" },
    { key: "steals",       label: "STL",  type: "num" },
    { key: "blocks",       label: "BLK",  type: "num" },
    { key: "turnovers",    label: "TO",   type: "num" },
    { key: "fouls",        label: "FLS",  type: "num" },
    { key: "jump_balls",   label: "JB",   type: "num" },
    { key: "efficiency",   label: "EFF",  type: "num" }
  ];

  // --- Data loading ---
  async function loadGames() {
    try {
      const snapshot = await db.collection("games").get();
      allGames = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderGamePicker();
      renderStats();
    } catch (err) {
      console.error("Error loading games:", err);
      document.getElementById("stats-loading").style.display = "none";
      document.getElementById("no-data").style.display = "block";
    }
  }

  function getTeamGames() {
    return allGames.filter(g => g.team === currentTeam);
  }

  function getSelectedGames() {
    const teamGames = getTeamGames();
    if (selectedGameIds === "all") return teamGames;
    return teamGames.filter(g => selectedGameIds.has(g.id));
  }

  // --- Game Picker ---
  function renderGamePicker() {
    const teamGames = getTeamGames().sort((a, b) =>
      b.game_info.date > a.game_info.date ? 1 : -1
    );
    const list = document.getElementById("game-picker-list");
    list.innerHTML = "";
    teamGames.forEach(g => {
      const label = document.createElement("label");
      label.className = "picker-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = g.id;
      cb.checked = selectedGameIds === "all" || selectedGameIds.has(g.id);
      cb.addEventListener("change", onPickerChange);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(
        " " + formatDate(g.game_info.date) + " vs " + g.game_info.opponent
      ));
      list.appendChild(label);
    });
    updatePickerButton();
  }

  function onPickerChange() {
    const checkboxes = [...document.querySelectorAll("#game-picker-list input[type=checkbox]")];
    const checked = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
    if (checked.length === 0) {
      // Don't allow empty — revert to all
      checkboxes.forEach(cb => { cb.checked = true; });
      selectedGameIds = "all";
    } else if (checked.length === checkboxes.length) {
      selectedGameIds = "all";
    } else {
      selectedGameIds = new Set(checked);
    }
    updatePickerButton();
    sortCol = null;
    renderStats();
  }

  function updatePickerButton() {
    const btn = document.getElementById("game-picker-btn");
    const total = getTeamGames().length;
    if (selectedGameIds === "all") {
      btn.textContent = "All Games (" + total + ") \u25be";
    } else {
      btn.textContent = selectedGameIds.size + " of " + total + " Games \u25be";
    }
  }

  document.getElementById("game-picker-btn").addEventListener("click", e => {
    e.stopPropagation();
    const panel = document.getElementById("game-picker-panel");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  document.getElementById("picker-select-all").addEventListener("click", () => {
    document.querySelectorAll("#game-picker-list input[type=checkbox]").forEach(cb => { cb.checked = true; });
    selectedGameIds = "all";
    updatePickerButton();
    sortCol = null;
    renderStats();
  });

  // Close picker on outside click
  document.addEventListener("click", () => {
    document.getElementById("game-picker-panel").style.display = "none";
  });
  document.getElementById("game-picker-panel").addEventListener("click", e => e.stopPropagation());

  // --- Totals Toggle ---
  document.getElementById("totals-toggle").addEventListener("click", () => {
    showTotals = !showTotals;
    const btn = document.getElementById("totals-toggle");
    btn.textContent = showTotals ? "Per Game" : "Show Totals";
    btn.classList.toggle("active", showTotals);
    renderStats();
  });

  // --- Build player stats ---
  function buildPlayerStats() {
    const isAllGames = selectedGameIds === "all";
    const selectedGames = getSelectedGames();
    // For "all games": scan both teams' games to catch cross-team guest appearances
    const gamesToScan = isAllGames ? allGames : selectedGames;
    const playerMap = {};

    gamesToScan.forEach(game => {
      if (!game.players) return;
      game.players.forEach(p => {
        if (!p.played) return;

        const isHomeTeamPlayer = !p.is_guest && game.team === currentTeam;
        const isGuestOnThisTeam = p.is_guest && game.team === currentTeam;
        const isHomePlayerGuestingElsewhere = p.is_guest && p.home_team === currentTeam && isAllGames;

        if (!isHomeTeamPlayer && !isGuestOnThisTeam && !isHomePlayerGuestingElsewhere) return;

        const key = p.number + "-" + p.name;
        if (!playerMap[key]) {
          playerMap[key] = {
            number: p.number, name: p.name, gamesPlayed: 0, totals: {},
            isGuest: isGuestOnThisTeam && selectedGames.length === 1
          };
          STAT_FIELDS.forEach(f => { playerMap[key].totals[f] = 0; });
        }
        playerMap[key].gamesPlayed++;
        if (p.stats) {
          STAT_FIELDS.forEach(f => { playerMap[key].totals[f] += (p.stats[f] || 0); });
        }
      });
    });

    return Object.values(playerMap).map(p => {
      const t = p.totals;
      const gp = p.gamesPlayed;
      const div = showTotals ? 1 : gp;

      const pts = t.fg_made * 2 + t.three_pt_made * 3 + t.ft_made;
      const reb = t.o_rebounds + t.d_rebounds;
      const fgPct = t.fg_attempted > 0 ? (t.fg_made / t.fg_attempted * 100) : 0;
      const threePct = t.three_pt_attempted > 0 ? (t.three_pt_made / t.three_pt_attempted * 100) : 0;
      const ftPct = t.ft_attempted > 0 ? (t.ft_made / t.ft_attempted * 100) : 0;
      const eff = pts + reb + t.assists + t.steals + t.blocks
                  - (t.fg_attempted - t.fg_made) - (t.ft_attempted - t.ft_made) - t.turnovers;

      // Shooting splits: show integers when totals or single game, decimals for per-game averages
      const fmtShoot = (made, att) => (showTotals || div === 1)
        ? Math.round(made / div) + "/" + Math.round(att / div)
        : (made / div).toFixed(1) + "/" + (att / div).toFixed(1);

      return {
        number: p.number, name: p.name, isGuest: p.isGuest,
        gp,
        pts: pts / div,
        fg: fmtShoot(t.fg_made, t.fg_attempted),
        fg_pct: fgPct,
        three_pt: fmtShoot(t.three_pt_made, t.three_pt_attempted),
        three_pt_pct: threePct,
        ft: fmtShoot(t.ft_made, t.ft_attempted),
        ft_pct: ftPct,
        reb: reb / div,
        o_rebounds: t.o_rebounds / div,
        d_rebounds: t.d_rebounds / div,
        assists: t.assists / div,
        steals: t.steals / div,
        blocks: t.blocks / div,
        turnovers: t.turnovers / div,
        fouls: t.fouls / div,
        jump_balls: t.jump_balls / div,
        efficiency: eff / div,
        _totalPts: pts,
        _totalReb: reb
      };
    });
  }

  // --- Summary bar ---
  function renderSummary() {
    const container = document.getElementById("team-summary");
    container.innerHTML = "";
    const selectedGames = getSelectedGames();
    if (selectedGames.length === 0) return;

    if (selectedGames.length === 1) {
      const info = selectedGames[0].game_info;
      const won = (info.score_te || 0) > (info.score_opponent || 0);
      container.innerHTML = `
        <div class="summary-card"><div class="label">Date</div><div class="value" style="font-size:1.1rem">${formatDate(info.date)}</div></div>
        <div class="summary-card"><div class="label">Opponent</div><div class="value" style="font-size:1.1rem">${info.opponent}</div></div>
        <div class="summary-card"><div class="label">Score</div><div class="value" style="font-size:1.1rem;color:${won ? '#28a745' : '#e74c3c'}">${info.score_te} - ${info.score_opponent}</div></div>
        <div class="summary-card"><div class="label">League</div><div class="value" style="font-size:1.1rem">${info.league || "—"}</div></div>
      `;
      return;
    }

    let wins = 0, losses = 0, totalScored = 0, totalAllowed = 0;
    selectedGames.forEach(g => {
      const info = g.game_info;
      totalScored += info.score_te || 0;
      totalAllowed += info.score_opponent || 0;
      if ((info.score_te || 0) > (info.score_opponent || 0)) wins++; else losses++;
    });
    container.innerHTML = `
      <div class="summary-card"><div class="label">Record</div><div class="value">${wins}-${losses}</div></div>
      <div class="summary-card"><div class="label">Games</div><div class="value">${selectedGames.length}</div></div>
      <div class="summary-card"><div class="label">Avg Scored</div><div class="value">${(totalScored / selectedGames.length).toFixed(1)}</div></div>
      <div class="summary-card"><div class="label">Avg Allowed</div><div class="value">${(totalAllowed / selectedGames.length).toFixed(1)}</div></div>
    `;
  }

  // --- Render stats table ---
  function renderStats() {
    document.getElementById("stats-loading").style.display = "none";
    const playerStats = buildPlayerStats();

    if (playerStats.length === 0) {
      document.getElementById("stats-content").style.display = "none";
      document.getElementById("no-data").style.display = "block";
      document.getElementById("team-summary").innerHTML = "";
      return;
    }

    document.getElementById("stats-content").style.display = "block";
    document.getElementById("no-data").style.display = "none";

    const selectedGames = getSelectedGames();
    const numGames = selectedGames.length;
    const isAllSelected = selectedGameIds === "all";

    let labelText;
    if (numGames === 1) {
      labelText = "Showing stats for 1 game";
    } else if (showTotals) {
      labelText = "Showing totals across " + (isAllSelected ? "all " : "") + numGames + " games";
    } else {
      labelText = "Showing per-game averages across " + (isAllSelected ? "all " : "") + numGames + " games (DNP games excluded from denominator)";
    }
    document.getElementById("stats-label").textContent = labelText;

    renderSummary();
    renderHeader();

    if (sortCol !== null) {
      const col = COLUMNS[sortCol];
      playerStats.sort((a, b) => {
        let va = a[col.key], vb = b[col.key];
        if (col.type === "str") {
          va = String(va || ""); vb = String(vb || "");
          return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        va = Number(va) || 0; vb = Number(vb) || 0;
        return sortAsc ? va - vb : vb - va;
      });
    }

    const tbody = document.getElementById("stats-body");
    tbody.innerHTML = "";

    const fmt = (v) => {
      if (typeof v === "string") return v;
      if (showTotals) return Math.round(v);
      if (Number.isInteger(v)) return v;
      return v.toFixed(1);
    };

    // Team row — sum raw stats from selected games directly
    const d = showTotals ? 1 : numGames;
    let tFGM = 0, tFGA = 0, t3PM = 0, t3PA = 0, tFTM = 0, tFTA = 0;
    let tOREB = 0, tDREB = 0, tAST = 0, tSTL = 0, tBLK = 0, tTO = 0, tFLS = 0, tJB = 0;
    selectedGames.forEach(game => {
      if (!game.players) return;
      game.players.forEach(p => {
        if (!p.played || !p.stats) return;
        tFGM  += p.stats.fg_made || 0;        tFGA  += p.stats.fg_attempted || 0;
        t3PM  += p.stats.three_pt_made || 0;   t3PA  += p.stats.three_pt_attempted || 0;
        tFTM  += p.stats.ft_made || 0;         tFTA  += p.stats.ft_attempted || 0;
        tOREB += p.stats.o_rebounds || 0;       tDREB += p.stats.d_rebounds || 0;
        tAST  += p.stats.assists || 0;          tSTL  += p.stats.steals || 0;
        tBLK  += p.stats.blocks || 0;           tTO   += p.stats.turnovers || 0;
        tFLS  += p.stats.fouls || 0;            tJB   += p.stats.jump_balls || 0;
      });
    });

    const tPTS = tFGM * 2 + t3PM * 3 + tFTM;
    const tREB = tOREB + tDREB;
    const tEFF = tPTS + tREB + tAST + tSTL + tBLK - (tFGA - tFGM) - (tFTA - tFTM) - tTO;
    const tFGPct  = tFGA > 0 ? (tFGM / tFGA * 100) : 0;
    const t3Pct   = t3PA > 0 ? (t3PM / t3PA * 100) : 0;
    const tFTPct  = tFTA > 0 ? (tFTM / tFTA * 100) : 0;

    const fmtShootTeam = (made, att) => (showTotals || d === 1)
      ? Math.round(made) + "/" + Math.round(att)
      : (made / d).toFixed(1) + "/" + (att / d).toFixed(1);

    const teamRow = document.createElement("tr");
    teamRow.style.fontWeight = "700";
    teamRow.style.background = "#d0e8f7";
    teamRow.style.borderBottom = "2px solid var(--navy)";
    teamRow.innerHTML = `
      <td></td>
      <td style="text-align:left;position:sticky;left:0;background:#d0e8f7;z-index:1;">TEAM</td>
      <td>${numGames}</td>
      <td>${fmt(tPTS / d)}</td>
      <td>${fmtShootTeam(tFGM, tFGA)}</td>
      <td>${tFGPct.toFixed(1)}</td>
      <td>${fmtShootTeam(t3PM, t3PA)}</td>
      <td>${t3Pct.toFixed(1)}</td>
      <td>${fmtShootTeam(tFTM, tFTA)}</td>
      <td>${tFTPct.toFixed(1)}</td>
      <td>${fmt(tREB / d)}</td>
      <td>${fmt(tOREB / d)}</td>
      <td>${fmt(tDREB / d)}</td>
      <td>${fmt(tAST / d)}</td>
      <td>${fmt(tSTL / d)}</td>
      <td>${fmt(tBLK / d)}</td>
      <td>${fmt(tTO / d)}</td>
      <td>${fmt(tFLS / d)}</td>
      <td>${fmt(tJB / d)}</td>
      <td>${fmt(tEFF / d)}</td>
    `;
    tbody.appendChild(teamRow);

    playerStats.forEach((p, idx) => {
      const tr = document.createElement("tr");
      const nameCell = p.isGuest ? p.name + '<span class="guest-badge">G</span>' : p.name;
      const nameBg = idx % 2 === 0 ? '#E1F0FB' : '#FFFFFF';
      tr.innerHTML = `
        <td>${p.number}</td>
        <td style="background:${nameBg}">${nameCell}</td>
        <td>${p.gp}</td>
        <td>${fmt(p.pts)}</td>
        <td>${p.fg}</td>
        <td>${p.fg_pct.toFixed(1)}</td>
        <td>${p.three_pt}</td>
        <td>${p.three_pt_pct.toFixed(1)}</td>
        <td>${p.ft}</td>
        <td>${p.ft_pct.toFixed(1)}</td>
        <td>${fmt(p.reb)}</td>
        <td>${fmt(p.o_rebounds)}</td>
        <td>${fmt(p.d_rebounds)}</td>
        <td>${fmt(p.assists)}</td>
        <td>${fmt(p.steals)}</td>
        <td>${fmt(p.blocks)}</td>
        <td>${fmt(p.turnovers)}</td>
        <td>${fmt(p.fouls)}</td>
        <td>${fmt(p.jump_balls)}</td>
        <td>${fmt(p.efficiency)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- Table header with sort ---
  function renderHeader() {
    const headerRow = document.getElementById("stats-header");
    headerRow.innerHTML = "";
    COLUMNS.forEach((col, i) => {
      const th = document.createElement("th");
      const arrow = sortCol === i ? (sortAsc ? " &#9650;" : " &#9660;") : "";
      th.innerHTML = col.label + '<span class="sort-arrow">' + arrow + "</span>";
      if (sortCol === i) th.classList.add("sort-active");
      th.addEventListener("click", () => {
        if (sortCol === i) { sortAsc = !sortAsc; } else { sortCol = i; sortAsc = col.type === "str"; }
        renderStats();
      });
      headerRow.appendChild(th);
    });
  }

  // --- Team tab ---
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentTeam = btn.dataset.team;
      selectedGameIds = "all";
      sortCol = null;
      renderGamePicker();
      renderStats();
    });
  });

});
