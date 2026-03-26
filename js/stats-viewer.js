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
  let currentGameId = "all";
  let sortCol = null;
  let sortAsc = true;

  const COLUMNS = [
    { key: "number",           label: "#",    type: "int" },
    { key: "name",             label: "Name", type: "str" },
    { key: "gp",               label: "GP",   type: "int" },
    { key: "pts",              label: "PTS",  type: "num" },
    { key: "fg",               label: "FG",   type: "str" },
    { key: "fg_pct",           label: "FG%",  type: "num" },
    { key: "three_pt",         label: "3PT",  type: "str" },
    { key: "three_pt_pct",     label: "3PT%", type: "num" },
    { key: "ft",               label: "FT",   type: "str" },
    { key: "ft_pct",           label: "FT%",  type: "num" },
    { key: "reb",              label: "REB",  type: "num" },
    { key: "o_rebounds",       label: "OREB", type: "num" },
    { key: "d_rebounds",       label: "DREB", type: "num" },
    { key: "assists",          label: "AST",  type: "num" },
    { key: "steals",           label: "STL",  type: "num" },
    { key: "blocks",           label: "BLK",  type: "num" },
    { key: "turnovers",        label: "TO",   type: "num" },
    { key: "fouls",            label: "FLS",  type: "num" },
    { key: "jump_balls",       label: "JB",   type: "num" },
    { key: "efficiency",       label: "EFF",  type: "num" }
  ];

  // Load all games from Firestore
  async function loadGames() {
    try {
      const snapshot = await db.collection("games").get();
      allGames = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      populateGameFilter();
      renderStats();
    } catch (err) {
      console.error("Error loading games:", err);
      document.getElementById("stats-loading").style.display = "none";
      document.getElementById("no-data").style.display = "block";
    }
  }

  // Populate game filter dropdown
  function populateGameFilter() {
    const select = document.getElementById("game-filter");
    // Keep the "All Games" option
    select.innerHTML = '<option value="all">All Games</option>';

    const teamGames = allGames
      .filter(g => g.team === currentTeam)
      .sort((a, b) => (a.game_info.date > b.game_info.date ? -1 : 1));

    teamGames.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = `${formatDate(g.game_info.date)} vs ${g.game_info.opponent}`;
      select.appendChild(opt);
    });

    select.value = currentGameId === "all" ? "all" : currentGameId;
    if (select.value !== currentGameId) {
      currentGameId = "all";
      select.value = "all";
    }
  }

  // Get games for current team (including guest appearances)
  function getTeamGames() {
    return allGames.filter(g => g.team === currentTeam);
  }

  // Build player stats
  function buildPlayerStats() {
    const isAllGames = currentGameId === "all";
    const teamGames = isAllGames
      ? getTeamGames()
      : allGames.filter(g => g.id === currentGameId);

    // Build per-player aggregation
    const playerMap = {};

    // For "all games" view, also find this team's players guesting in other team's games
    const gamesToScan = isAllGames ? allGames : teamGames;

    gamesToScan.forEach(game => {
      if (!game.players) return;

      game.players.forEach(p => {
        if (!p.played) return;

        // Determine if this player belongs to the current team view
        const isHomeTeamPlayer = !p.is_guest && game.team === currentTeam;
        const isGuestOnThisTeam = p.is_guest && game.team === currentTeam;
        const isHomePlayerGuestingElsewhere = p.is_guest && p.home_team === currentTeam && isAllGames;

        if (!isHomeTeamPlayer && !isGuestOnThisTeam && !isHomePlayerGuestingElsewhere) return;

        // For single-game view, only show players in that game
        if (!isAllGames && game.id !== currentGameId) return;

        const key = `${p.number}-${p.name}`;
        if (!playerMap[key]) {
          playerMap[key] = {
            number: p.number,
            name: p.name,
            gamesPlayed: 0,
            totals: {},
            isGuest: isGuestOnThisTeam && !isAllGames
          };
          STAT_FIELDS.forEach(f => playerMap[key].totals[f] = 0);
        }

        playerMap[key].gamesPlayed++;
        if (p.stats) {
          STAT_FIELDS.forEach(f => {
            playerMap[key].totals[f] += (p.stats[f] || 0);
          });
        }
      });
    });

    // Calculate derived stats for each player
    return Object.values(playerMap).map(p => {
      const t = p.totals;
      const gp = p.gamesPlayed;
      const div = isAllGames ? gp : 1;

      const pts = t.fg_made * 2 + t.three_pt_made * 3 + t.ft_made;
      const reb = t.o_rebounds + t.d_rebounds;
      const fgPct = t.fg_attempted > 0 ? (t.fg_made / t.fg_attempted * 100) : 0;
      const threePct = t.three_pt_attempted > 0 ? (t.three_pt_made / t.three_pt_attempted * 100) : 0;
      const ftPct = t.ft_attempted > 0 ? (t.ft_made / t.ft_attempted * 100) : 0;
      const eff = pts + reb + t.assists + t.steals + t.blocks
                  - (t.fg_attempted - t.fg_made) - (t.ft_attempted - t.ft_made) - t.turnovers;

      return {
        number: p.number,
        name: p.name,
        isGuest: p.isGuest,
        gp: gp,
        pts: isAllGames ? pts / div : pts,
        fg: isAllGames
          ? `${(t.fg_made / div).toFixed(1)}/${(t.fg_attempted / div).toFixed(1)}`
          : `${t.fg_made}/${t.fg_attempted}`,
        fg_pct: fgPct,
        three_pt: isAllGames
          ? `${(t.three_pt_made / div).toFixed(1)}/${(t.three_pt_attempted / div).toFixed(1)}`
          : `${t.three_pt_made}/${t.three_pt_attempted}`,
        three_pt_pct: threePct,
        ft: isAllGames
          ? `${(t.ft_made / div).toFixed(1)}/${(t.ft_attempted / div).toFixed(1)}`
          : `${t.ft_made}/${t.ft_attempted}`,
        ft_pct: ftPct,
        reb: isAllGames ? reb / div : reb,
        o_rebounds: isAllGames ? t.o_rebounds / div : t.o_rebounds,
        d_rebounds: isAllGames ? t.d_rebounds / div : t.d_rebounds,
        assists: isAllGames ? t.assists / div : t.assists,
        steals: isAllGames ? t.steals / div : t.steals,
        blocks: isAllGames ? t.blocks / div : t.blocks,
        turnovers: isAllGames ? t.turnovers / div : t.turnovers,
        fouls: isAllGames ? t.fouls / div : t.fouls,
        jump_balls: isAllGames ? t.jump_balls / div : t.jump_balls,
        efficiency: isAllGames ? eff / div : eff,
        // Raw totals for summary
        _totalPts: pts,
        _totalReb: reb
      };
    });
  }

  // Build team summary
  function buildTeamSummary() {
    const teamGames = getTeamGames();
    if (teamGames.length === 0) return null;

    let wins = 0, losses = 0, totalScored = 0, totalAllowed = 0;
    teamGames.forEach(g => {
      const info = g.game_info;
      totalScored += info.score_te || 0;
      totalAllowed += info.score_opponent || 0;
      if ((info.score_te || 0) > (info.score_opponent || 0)) wins++;
      else losses++;
    });

    return {
      record: `${wins}-${losses}`,
      games: teamGames.length,
      avgScored: (totalScored / teamGames.length).toFixed(1),
      avgAllowed: (totalAllowed / teamGames.length).toFixed(1)
    };
  }

  // Render team summary cards
  function renderSummary() {
    const container = document.getElementById("team-summary");
    container.innerHTML = "";

    if (currentGameId !== "all") {
      // Single game: show game info
      const game = allGames.find(g => g.id === currentGameId);
      if (game) {
        const info = game.game_info;
        const won = (info.score_te || 0) > (info.score_opponent || 0);
        container.innerHTML = `
          <div class="summary-card">
            <div class="label">Date</div>
            <div class="value" style="font-size:1.1rem">${formatDate(info.date)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Opponent</div>
            <div class="value" style="font-size:1.1rem">${info.opponent}</div>
          </div>
          <div class="summary-card">
            <div class="label">Score</div>
            <div class="value" style="font-size:1.1rem; color: ${won ? '#28a745' : '#e74c3c'}">${info.score_te} - ${info.score_opponent}</div>
          </div>
          <div class="summary-card">
            <div class="label">League</div>
            <div class="value" style="font-size:1.1rem">${info.league || "—"}</div>
          </div>
        `;
      }
      return;
    }

    const summary = buildTeamSummary();
    if (!summary) return;

    container.innerHTML = `
      <div class="summary-card">
        <div class="label">Record</div>
        <div class="value">${summary.record}</div>
      </div>
      <div class="summary-card">
        <div class="label">Games</div>
        <div class="value">${summary.games}</div>
      </div>
      <div class="summary-card">
        <div class="label">Avg Scored</div>
        <div class="value">${summary.avgScored}</div>
      </div>
      <div class="summary-card">
        <div class="label">Avg Allowed</div>
        <div class="value">${summary.avgAllowed}</div>
      </div>
    `;
  }

  // Render stats table
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

    const isAllGames = currentGameId === "all";
    document.getElementById("stats-label").textContent = isAllGames
      ? "Showing per-game averages across all games (DNP games excluded)"
      : "Showing stats for a single game";

    renderSummary();
    renderHeader();

    // Sort
    if (sortCol !== null) {
      const col = COLUMNS[sortCol];
      playerStats.sort((a, b) => {
        let va = a[col.key];
        let vb = b[col.key];
        if (col.type === "str") {
          va = String(va || "");
          vb = String(vb || "");
          return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        va = Number(va) || 0;
        vb = Number(vb) || 0;
        return sortAsc ? va - vb : vb - va;
      });
    }

    const tbody = document.getElementById("stats-body");
    tbody.innerHTML = "";

    const fmt = (v) => {
      if (typeof v === "string") return v;
      if (Number.isInteger(v)) return v;
      return v.toFixed(1);
    };

    // Build team totals row
    const teamGames = getTeamGames();
    const numGames = isAllGames ? teamGames.length : 1;
    if (numGames > 0) {
      const totals = {};
      STAT_FIELDS.forEach(f => totals[f] = 0);

      // Sum raw totals across all players
      playerStats.forEach(p => {
        // For all-games view, multiply averages back to totals
        const mult = isAllGames ? p.gp : 1;
        STAT_FIELDS.forEach(f => {
          totals[f] += (p[f] || 0) * mult;
        });
      });

      // Need to get raw shooting stats from playerStats for team row
      // Recalculate from the raw totals in playerMap
      let tFGM = 0, tFGA = 0, t3PM = 0, t3PA = 0, tFTM = 0, tFTA = 0;
      let tOREB = 0, tDREB = 0, tAST = 0, tSTL = 0, tBLK = 0, tTO = 0, tFLS = 0, tJB = 0;

      // Sum from games directly for accuracy
      const gamesToSum = isAllGames ? teamGames : allGames.filter(g => g.id === currentGameId);
      gamesToSum.forEach(game => {
        if (!game.players) return;
        game.players.forEach(p => {
          if (!p.played || !p.stats) return;
          tFGM += p.stats.fg_made || 0;
          tFGA += p.stats.fg_attempted || 0;
          t3PM += p.stats.three_pt_made || 0;
          t3PA += p.stats.three_pt_attempted || 0;
          tFTM += p.stats.ft_made || 0;
          tFTA += p.stats.ft_attempted || 0;
          tOREB += p.stats.o_rebounds || 0;
          tDREB += p.stats.d_rebounds || 0;
          tAST += p.stats.assists || 0;
          tSTL += p.stats.steals || 0;
          tBLK += p.stats.blocks || 0;
          tTO += p.stats.turnovers || 0;
          tFLS += p.stats.fouls || 0;
          tJB += p.stats.jump_balls || 0;
        });
      });

      const tPTS = tFGM * 2 + t3PM * 3 + tFTM;
      const tREB = tOREB + tDREB;
      const tEFF = tPTS + tREB + tAST + tSTL + tBLK - (tFGA - tFGM) - (tFTA - tFTM) - tTO;
      const d = numGames;

      const tFGPct = tFGA > 0 ? (tFGM / tFGA * 100) : 0;
      const t3Pct = t3PA > 0 ? (t3PM / t3PA * 100) : 0;
      const tFTPct = tFTA > 0 ? (tFTM / tFTA * 100) : 0;

      const teamRow = document.createElement("tr");
      teamRow.style.fontWeight = "700";
      teamRow.style.background = "#d0e8f7";
      teamRow.style.borderBottom = "2px solid var(--navy)";
      teamRow.innerHTML = `
        <td></td>
        <td style="text-align:left; position:sticky; left:0; background:#d0e8f7; z-index:1;">TEAM</td>
        <td>${numGames}</td>
        <td>${fmt(tPTS / d)}</td>
        <td>${isAllGames ? `${(tFGM / d).toFixed(1)}/${(tFGA / d).toFixed(1)}` : `${tFGM}/${tFGA}`}</td>
        <td>${tFGPct.toFixed(1)}</td>
        <td>${isAllGames ? `${(t3PM / d).toFixed(1)}/${(t3PA / d).toFixed(1)}` : `${t3PM}/${t3PA}`}</td>
        <td>${t3Pct.toFixed(1)}</td>
        <td>${isAllGames ? `${(tFTM / d).toFixed(1)}/${(tFTA / d).toFixed(1)}` : `${tFTM}/${tFTA}`}</td>
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
    }

    playerStats.forEach((p, idx) => {
      const tr = document.createElement("tr");
      const nameCell = p.isGuest
        ? `${p.name}<span class="guest-badge">G</span>`
        : p.name;

      // TEAM row is at index 0 in tbody; player rows start at index 1
      const rowIdx = idx + 1;
      const nameBg = rowIdx % 2 === 0 ? '#E1F0FB' : '#FFFFFF';

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

  // Render table header with sort indicators
  function renderHeader() {
    const headerRow = document.getElementById("stats-header");
    headerRow.innerHTML = "";

    COLUMNS.forEach((col, i) => {
      const th = document.createElement("th");
      const arrow = sortCol === i
        ? (sortAsc ? " &#9650;" : " &#9660;")
        : "";
      th.innerHTML = `${col.label}<span class="sort-arrow">${arrow}</span>`;
      if (sortCol === i) th.classList.add("sort-active");

      th.addEventListener("click", () => {
        if (sortCol === i) {
          sortAsc = !sortAsc;
        } else {
          sortCol = i;
          sortAsc = col.type === "str"; // A-Z for text, high-to-low for numbers
        }
        renderStats();
      });

      headerRow.appendChild(th);
    });
  }

  // Team tab click
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentTeam = btn.dataset.team;
      currentGameId = "all";
      sortCol = null;
      populateGameFilter();
      renderStats();
    });
  });

  // Game filter change
  document.getElementById("game-filter").addEventListener("change", (e) => {
    currentGameId = e.target.value;
    sortCol = null;
    renderStats();
  });

});
