(function () {
  "use strict";
  window.NS = window.NS || {};

  const $ = function (id) { return document.getElementById(id); };
  const canvas = $("game");
  const titleScreen = $("title-screen");
  const gameOverScreen = $("game-over");
  const hud = $("hud");
  const diffIndicator = $("diff-indicator");
  const scoreEl = $("score");
  const bestEl = $("best");
  const streakNum = $("streak-num");
  const perfectsNum = $("perfects-num");
  const finalScoreEl = $("final-score");
  const finalBestEl = $("final-best");
  const finalStreakEl = $("final-streak");
  const finalPerfectsEl = $("final-perfects");
  const comboFlash = $("combo-flash");
  const startBtn = $("start-btn");
  const retryBtn = $("retry-btn");
  const reviveBtn = $("revive-btn");
  const muteBtn = $("mute-btn");
  const muteIcon = $("mute-icon");
  const pauseBtn = $("pause-btn");
  const resumeBtn = $("resume-btn");
  const menuBtnPause = $("menu-btn-pause");
  const menuBtnGo = $("menu-btn-go");
  const pauseOverlay = $("pause-overlay");
  const modeBtns = document.querySelectorAll(".mode-btn");
  const targetBtn = $("target-btn");
  const targetSetScreen = $("target-set");
  const targetResultScreen = $("target-result");
  const targetDisplay = $("target-display");
  const targetPlayBtn = $("target-play-btn");
  const targetTurn = $("target-turn");
  const targetResultWinner = $("target-result-winner");
  const targetMenuBtn = $("target-menu-btn");
  const targetMenuBtn2 = $("target-menu-btn2");
  const targetResultTitle = $("target-result-title");
  const resultTarget = $("result-target");
  const resultScore = $("result-score");
  const targetRetryBtn = $("target-retry-btn");

  let comboTimer = null;
  let lastGameOver = 0;
  const GAME_OVER_COOLDOWN = 400;

  var mpMyTurn = false, mpDone = false, mpMyScore = 0, mpOppScore = 0, mpRaf = null;
  var mpLobby = $("mp-lobby"), mpWaiting = $("mp-waiting"), mpResult = $("mp-result");
  var mpHostBtn = $("mp-host-btn"), mpJoinBtn = $("mp-join-btn"), mpJoinInput = $("mp-join-input");
  var mpBackBtn = $("mp-back-btn"), mpCancelBtn = $("mp-cancel-btn"), mpError = $("mp-error");
  var mpRoomDisplay = $("mp-room-display"), mpAgainBtn = $("mp-again-btn"), mpMenuBtn = $("mp-menu-btn");
  var mpResultTitle = $("mp-result-title"), mpResultWinner = $("mp-result-winner");
  var mpMyScoreEl = $("mp-my-score"), mpOppScoreEl = $("mp-opp-score");
  var mpBtn = $("mp-btn"), mpTurnLabel = $("mp-turn-label"), mpTurnText = $("mp-turn-text"), mpOppScoreElFull = $("mp-opp-score-full");
  var mpCopyBtn = $("mp-copy-btn");
  var mpRematchStatus = $("mp-rematch-status"), mpRematchPrompt = $("mp-rematch-prompt");
  var mpRematchAccept = $("mp-rematch-accept"), mpRematchDecline = $("mp-rematch-decline");
  var rematchRequested = false;

  const game = new NS.Game(canvas, {
    onScore: function (s) {
      scoreEl.textContent = s;
      var streak = game.combo, perfects = game.totalPerfects;
      if (streakNum) {
        streakNum.textContent = streak;
        var hue = (190 + streak * 25) % 360;
        var sat = 80 + Math.min(streak * 5, 20);
        var lit = 60 + Math.min(streak * 4, 30);
        streakNum.style.color = "hsl(" + hue + "," + sat + "%," + lit + "%)";
        streakNum.style.textShadow = "0 0 " + (8 + streak * 2) + "px hsla(" + hue + "," + sat + "%," + lit + "%,.8)";
      }
      if (perfectsNum) {
        perfectsNum.textContent = perfects;
        if (perfects > 0) {
          var ph = (190 + perfects * 15) % 360;
          perfectsNum.style.color = "hsl(" + ph + ",85%,65%)";
          perfectsNum.style.textShadow = "0 0 " + (8 + Math.min(perfects, 10)) + "px hsla(" + ph + ",85%,65%,.7)";
        } else {
          perfectsNum.style.color = "";
          perfectsNum.style.textShadow = "";
        }
      }
    },
    onCombo: function (combo) {
      comboFlash.textContent = combo >= 2 ? ("PERFECT x" + combo) : "PERFECT";
      comboFlash.classList.remove("pop");
      void comboFlash.offsetWidth;
      comboFlash.classList.add("pop");
      clearTimeout(comboTimer);
      comboTimer = setTimeout(function () { comboFlash.classList.remove("pop"); }, 650);
    },
    onGameOver: function (score, best, canRevive, maxCombo, totalPerfects, longestStreak) {
      lastGameOver = Date.now();
      if (game.mode === "mp") {
        endMpGame();
        return;
      }
      finalScoreEl.textContent = score;
      finalBestEl.textContent = best;
      finalStreakEl.textContent = (maxCombo || 0) + " (BEST " + (longestStreak || 0) + ")";
      finalPerfectsEl.textContent = totalPerfects || 0;
      reviveBtn.style.display = "";
      pauseBtn.style.display = "none";
      hud.classList.remove("show");
      gameOverScreen.classList.remove("hidden");
    },
    onReturnToMenu: function () {
      hideScreens();
      pauseOverlay.classList.add("hidden");
      pauseBtn.style.display = "none";
      hud.classList.remove("show");
      titleScreen.classList.remove("hidden");
      targetSetScreen.classList.add("hidden");
      targetResultScreen.classList.add("hidden");
    },
    onTargetSet: function (score) {
      targetDisplay.textContent = score;
      if (targetTurn) targetTurn.textContent = "Player 2's turn!";
      pauseBtn.style.display = "none";
      hud.classList.remove("show");
      hideScreens();
      targetSetScreen.classList.remove("hidden");
    },
    onTargetResult: function (passed, score, target) {
      resultTarget.textContent = target;
      resultScore.textContent = score;
      if (passed) {
        targetResultTitle.textContent = "PLAYER 2 WINS!";
        targetResultTitle.className = "go-title go-result-success";
        if (targetResultWinner) targetResultWinner.textContent = "Player 2 beat the target!";
      } else {
        targetResultTitle.textContent = "PLAYER 1 WINS!";
        targetResultTitle.className = "go-title go-result-fail";
        if (targetResultWinner) targetResultWinner.textContent = "Player 2 didn't reach the target!";
      }
      pauseBtn.style.display = "none";
      hud.classList.remove("show");
      hideScreens();
      targetResultScreen.classList.remove("hidden");
    }
  });

  NS.MP.init({
    onOpen: function (code) {
      mpLobby.classList.add("hidden");
      mpRoomDisplay.textContent = code;
      mpWaiting.classList.remove("hidden");
    },
    onConnect: function () {
      mpLobby.classList.add("hidden");
      mpWaiting.classList.add("hidden");
      mpError.style.display = "none";
      mpMyTurn = NS.MP.role === "host";
      mpDone = false;
      startMpGame();
    },
    onRemoteState: function (state) {
      game.remoteState = state;
      if (!mpMyTurn) {
        if (mpOppScoreElFull) mpOppScoreElFull.textContent = state.score;
        if (mpDone && mpTurnText) mpTurnText.textContent = (NS.MP.role === "host" ? "PLAYER 2" : "PLAYER 1") + "'S TURN";
      }
    },
    onTurnEnd: function (score, combo) {
      mpOppScore = score;
      game.remoteState = null;
      if (!mpDone) {
        mpMyTurn = true;
        startMpRun();
      } else if (NS.MP.role === "host") {
        var won = mpMyScore >= mpOppScore;
        NS.MP.sendGameOver(won ? "host" : "joiner", mpMyScore, mpOppScore);
        showMpResult(won);
      }
    },
    onGameOver: function (winner, hs, js) {
      mpMyScore = NS.MP.role === "host" ? hs : js;
      mpOppScore = NS.MP.role === "host" ? js : hs;
      showMpResult(winner === (NS.MP.role === "host" ? "host" : "joiner"));
    },
    onError: function () {
      mpError.textContent = "Connection failed. Try again.";
      mpError.style.display = "block";
    },
    onRematchRequest: function () {
      if (rematchRequested) return;
      mpRematchStatus.style.display = "none";
      mpRematchPrompt.style.display = "";
      mpAgainBtn.style.display = "none";
    },
    onRematchAccept: function () {
      mpRematchPrompt.style.display = "none";
      mpRematchStatus.style.display = "none";
      mpAgainBtn.style.display = "";
      rematchRequested = false;
      mpMyTurn = NS.MP.role === "host";
      mpDone = false;
      startMpGame();
    },
    onRematchDecline: function () {
      mpRematchPrompt.style.display = "none";
      mpAgainBtn.style.display = "";
      if (rematchRequested) {
        mpRematchStatus.textContent = "Rematch declined.";
        mpRematchStatus.style.color = "#ff5f5f";
        mpRematchStatus.style.display = "";
        rematchRequested = false;
        mpAgainBtn.textContent = "REQUEST REMATCH";
      }
    },
    onDisconnect: function () {
      if (!mpResult.classList.contains("hidden")) return;
      mpError.textContent = "Opponent disconnected.";
      mpError.style.display = "block";
    }
  });

  function startMpGame() {
    hideScreens();
    mpLobby.classList.add("hidden");
    mpWaiting.classList.add("hidden");
    mpResult.classList.add("hidden");
    pauseBtn.style.display = "none";
    hud.classList.remove("show");
    if (mpMyTurn) {
      startMpRun();
    } else {
      showMpWatching();
    }
    if (!mpRaf) mpRaf = requestAnimationFrame(mpLoop);
  }

  function startMpRun() {
    NS.audio.init();
    NS.audio.start();
    game.remoteState = null;
    hideScreens();
    pauseOverlay.classList.add("hidden");
    showHud();
    showDiff();
    game.mode = "mp";
    game.newRun();
    mpTurnLabel && mpTurnLabel.classList.add("hidden");
  }

  function showMpWatching() {
    hud.classList.remove("show");
    pauseBtn.style.display = "none";
    hideScreens();
    if (mpTurnLabel) mpTurnLabel.classList.remove("hidden");
    if (mpTurnText) mpTurnText.textContent = (NS.MP.role === "joiner" ? "PLAYER 1" : "PLAYER 2") + "'S TURN";
    if (mpOppScoreElFull) mpOppScoreElFull.textContent = "0";
  }

  function mpLoop() {
    if (!NS.MP.connected) { mpRaf = null; return; }
    if (mpMyTurn && game.state === "playing") {
      NS.MP.sendState(game.getState());
    }
    mpRaf = requestAnimationFrame(mpLoop);
  }

  function endMpGame() {
    mpDone = true;
    mpMyTurn = false;
    mpMyScore = game.score;
    game.remoteState = null;
    NS.MP.sendTurnEnd(mpMyScore, game.maxCombo);
    hud.classList.remove("show");
    pauseBtn.style.display = "none";
    if (mpTurnLabel) mpTurnLabel.classList.remove("hidden");
    if (mpTurnText) mpTurnText.textContent = "Waiting for opponent...";
  }

  function showMpResult(won) {
    mpRaf = null; mpMyTurn = false;
    game.remoteState = null;
    rematchRequested = false;
    mpTurnLabel && mpTurnLabel.classList.add("hidden");
    mpRematchStatus && (mpRematchStatus.style.display = "none");
    mpRematchStatus && (mpRematchStatus.textContent = "Waiting for opponent's response...");
    mpRematchStatus && (mpRematchStatus.style.color = "");
    mpRematchPrompt && (mpRematchPrompt.style.display = "none");
    mpAgainBtn && (mpAgainBtn.style.display = "");
    mpAgainBtn && (mpAgainBtn.textContent = "REQUEST REMATCH");
    mpError && (mpError.style.display = "none");
    hud.classList.remove("show");
    pauseBtn.style.display = "none";
    hideScreens();
    mpMyScoreEl.textContent = mpMyScore;
    mpOppScoreEl.textContent = mpOppScore;
    if (won) {
      mpResultTitle.textContent = "YOU WIN!";
      mpResultTitle.className = "go-title go-result-success";
      mpResultWinner.textContent = "You beat your opponent!";
    } else {
      mpResultTitle.textContent = "YOU LOSE!";
      mpResultTitle.className = "go-title go-result-fail";
      mpResultWinner.textContent = "Opponent scored higher!";
    }
    mpResult.classList.remove("hidden");
  }

  function mpReturnToMenu() {
    NS.MP.disconnect();
    mpRaf = null;
    mpMyTurn = false; mpDone = false;
    game.remoteState = null;
    mpTurnLabel && mpTurnLabel.classList.add("hidden");
    mpLobby.classList.add("hidden");
    mpWaiting.classList.add("hidden");
    mpResult.classList.add("hidden");
    returnToMenu();
  }

  function showHud() { hud.classList.add("show"); pauseBtn.style.display = ""; }
  function hideScreens() {
    titleScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    targetSetScreen.classList.add("hidden");
    targetResultScreen.classList.add("hidden");
    mpLobby.classList.add("hidden");
    mpWaiting.classList.add("hidden");
    mpResult.classList.add("hidden");
  }

  function clearMpOverlays() {
    game.remoteState = null;
    mpTurnLabel && mpTurnLabel.classList.add("hidden");
  }

  function showDiff() {
    if (diffIndicator) diffIndicator.textContent = game.difficulty.toUpperCase() + (game.mode === "target" ? " TARGET" : "");
  }

  function startRun() {
    NS.audio.init();
    NS.audio.start();
    hideScreens();
    clearMpOverlays();
    pauseOverlay.classList.add("hidden");
    showHud();
    showDiff();
    game.mode = "normal";
    game.newRun();
  }

  function retry() {
    if (Date.now() - lastGameOver < GAME_OVER_COOLDOWN) return;
    NS.audio.click();
    startRun();
  }

  function primaryAction() {
    if (game.state === "title") { startRun(); return; }
    if (game.state === "playing") { game.drop(); return; }
    if (game.state === "paused") { togglePause(); return; }
  }

  function togglePause() {
    if (game.state === "playing") {
      game.pause();
      pauseOverlay.classList.remove("hidden");
    } else if (game.state === "paused") {
      game.resume();
      pauseOverlay.classList.add("hidden");
    }
  }

  function returnToMenu() {
    NS.audio.click();
    pauseOverlay.classList.add("hidden");
    game.returnToMenu();
  }

  function startTargetP1() {
    NS.audio.init();
    NS.audio.click();
    hideScreens();
    pauseOverlay.classList.add("hidden");
    showHud();
    showDiff();
    game.startTargetRun(1);
  }

  function startTargetP2() {
    NS.audio.init();
    NS.audio.click();
    hideScreens();
    pauseOverlay.classList.add("hidden");
    showHud();
    showDiff();
    game.startTargetRun(2);
  }

  targetBtn.addEventListener("click", function (e) { e.stopPropagation(); startTargetP1(); });
  targetPlayBtn.addEventListener("click", function (e) { e.stopPropagation(); startTargetP2(); });
  targetRetryBtn.addEventListener("click", function (e) { e.stopPropagation(); startTargetP2(); });
  targetMenuBtn.addEventListener("click", function (e) { e.stopPropagation(); returnToMenu(); });
  targetMenuBtn2.addEventListener("click", function (e) { e.stopPropagation(); returnToMenu(); });

  startBtn.addEventListener("click", function (e) { e.stopPropagation(); startRun(); });
  retryBtn.addEventListener("click", function (e) { e.stopPropagation(); retry(); });
  reviveBtn.addEventListener("click", function (e) { e.stopPropagation(); retry(); });
  pauseBtn.addEventListener("click", function (e) { e.stopPropagation(); togglePause(); });
  resumeBtn.addEventListener("click", function (e) { e.stopPropagation(); togglePause(); });
  menuBtnPause.addEventListener("click", function (e) { e.stopPropagation(); returnToMenu(); });
  menuBtnGo.addEventListener("click", function (e) { e.stopPropagation(); returnToMenu(); });

  mpBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    NS.audio.click();
    NS.MP.disconnect();
    mpRaf = null; mpMyTurn = false; mpDone = false;
    hideScreens();
    clearMpOverlays();
    pauseOverlay.classList.add("hidden");
    titleScreen.classList.add("hidden");
    mpError.style.display = "none";
    mpLobby.classList.remove("hidden");
  });
  mpHostBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    NS.audio.click();
    mpError.style.display = "none";
    var code = NS.MP.host();
    if (!code) { mpError.textContent = "Could not create room."; mpError.style.display = "block"; }
  });
  mpJoinBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    NS.audio.click();
    mpError.style.display = "none";
    var code = mpJoinInput.value.trim().toUpperCase();
    if (!code || code.length < 5) { mpError.textContent = "Enter a valid room code."; mpError.style.display = "block"; return; }
    NS.MP.join(code);
    mpJoinInput.value = "";
  });
  mpJoinInput.addEventListener("keydown", function (e) {
    if (e.code === "Enter") { e.preventDefault(); mpJoinBtn.click(); }
  });
  mpBackBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    NS.audio.click();
    mpLobby.classList.add("hidden");
    titleScreen.classList.remove("hidden");
  });
  mpCancelBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    NS.audio.click();
    NS.MP.disconnect();
    mpWaiting.classList.add("hidden");
    titleScreen.classList.remove("hidden");
  });
  mpCopyBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var code = NS.MP.roomCode;
    if (code && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(function () {
        mpCopyBtn.textContent = "COPIED!";
        setTimeout(function () { mpCopyBtn.textContent = "COPY CODE"; }, 1500);
      });
    } else if (code) {
      var ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      mpCopyBtn.textContent = "COPIED!";
      setTimeout(function () { mpCopyBtn.textContent = "COPY CODE"; }, 1500);
    }
  });
  mpAgainBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    NS.audio.click();
    rematchRequested = true;
    mpAgainBtn.style.display = "none";
    mpRematchStatus.style.display = "";
    NS.MP.sendRematchRequest();
  });
  mpRematchAccept.addEventListener("click", function (e) {
    e.stopPropagation();
    NS.audio.click();
    mpRematchPrompt.style.display = "none";
    NS.MP.sendRematchAccept();
    mpMyTurn = NS.MP.role === "host";
    mpDone = false;
    startMpGame();
  });
  mpRematchDecline.addEventListener("click", function (e) {
    e.stopPropagation();
    NS.audio.click();
    mpRematchPrompt.style.display = "none";
    mpAgainBtn.style.display = "";
    NS.MP.sendRematchDecline();
  });
  mpMenuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    NS.audio.click();
    mpReturnToMenu();
  });

  canvas.addEventListener("pointerdown", function (e) {
    if (game.mode === "mp" && !mpMyTurn) { e.preventDefault(); return; }
    if (game.state === "playing" || game.state === "paused") { e.preventDefault(); primaryAction(); }
    else if (game.state === "gameover") {
      if (game.mode === "target") {
        if (game.targetPlayer === 1) { startTargetP2(); return; }
        else { startTargetP2(); return; }
      }
      e.preventDefault(); retry();
    }
  });
  window.addEventListener("keydown", function (e) {
    if (game.mode === "mp" && !mpMyTurn) return;
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (!mpLobby.classList.contains("hidden")) return;
      if (game.state === "title") { startRun(); return; }
      if (game.state === "gameover") {
        if (game.mode === "target") {
          if (game.targetPlayer === 1) { startTargetP2(); return; }
          else { startTargetP2(); return; }
        }
        if (Date.now() - lastGameOver >= GAME_OVER_COOLDOWN) retry(); return;
      }
      primaryAction();
    } else if (e.code === "Escape") {
      e.preventDefault();
      togglePause();
    } else if (e.key === "m" || e.key === "M") {
      toggleMute();
    }
  });

  let muted = localStorage.getItem("neonstack_muted") === "true";
  NS.audio.setMuted(muted);
  muteIcon.innerHTML = muted ? "&#128263;" : "&#128266;";
  function toggleMute() {
    muted = !muted;
    NS.audio.setMuted(muted);
    localStorage.setItem("neonstack_muted", muted ? "true" : "false");
    muteIcon.innerHTML = muted ? "&#128263;" : "&#128266;";
  }
  muteBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMute(); });

  function updateBest() {
    var key = "neonstack_best_" + game.difficulty;
    var best = parseInt(localStorage.getItem(key) || "0", 10) || 0;
    bestEl.textContent = "BEST " + best;
  }

  modeBtns.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var mode = btn.getAttribute("data-mode");
      game.setDifficulty(mode);
      localStorage.setItem("neonstack_mode", mode);
      modeBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      updateBest();
    });
  });

  var validModes = ["easy", "medium", "hard"];
  var storedMode = localStorage.getItem("neonstack_mode") || "medium";
  if (validModes.indexOf(storedMode) >= 0) {
    game.setDifficulty(storedMode);
    modeBtns.forEach(function (b) {
      if (b.getAttribute("data-mode") === storedMode) b.classList.add("active");
      else b.classList.remove("active");
    });
  }

  (function initBestDisplay() { updateBest(); })();

  (function boot() {
    pauseBtn.style.display = "none";
    game.startLoop();
  })();
})();
