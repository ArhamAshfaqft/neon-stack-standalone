(function () {
  "use strict";
  window.NS = window.NS || {};

  var ws = null, roomCode = null, role = null, connected = false, remoteState = null;
  var callbacks = {};
  var reconnectTimer = null;

  var SERVER = "wss://neon-stack-server.onrender.com";
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    SERVER = "ws://localhost:3000";
  }

  function init(cb) { callbacks = cb || {}; }

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    try { ws = new WebSocket(SERVER); } catch (e) { callbacks.onError && callbacks.onError(e); return; }
    ws.onopen = function () {
      connected = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (role === "host") { ws.send(JSON.stringify({ type: "host" })); }
      else if (role === "joiner" && roomCode) { ws.send(JSON.stringify({ type: "join", room: roomCode })); }
    };
    ws.onmessage = function (e) {
      var msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      switch (msg.type) {
        case "hosted":
          roomCode = msg.room;
          callbacks.onOpen && callbacks.onOpen(roomCode);
          break;
        case "joined":
          roomCode = msg.room;
          callbacks.onConnect && callbacks.onConnect();
          break;
        case "opponent_joined":
          callbacks.onConnect && callbacks.onConnect();
          break;
        case "state":
          remoteState = msg.data;
          callbacks.onRemoteState && callbacks.onRemoteState(remoteState);
          break;
        case "turnEnd":
          callbacks.onTurnEnd && callbacks.onTurnEnd(msg.score, msg.combo);
          break;
        case "gameOver":
          callbacks.onGameOver && callbacks.onGameOver(msg.winner, msg.hs, msg.js);
          break;
        case "rematchReq":
          callbacks.onRematchRequest && callbacks.onRematchRequest();
          break;
        case "rematchAccept":
          callbacks.onRematchAccept && callbacks.onRematchAccept();
          break;
        case "rematchDecline":
          callbacks.onRematchDecline && callbacks.onRematchDecline();
          break;
        case "opponent_left":
          callbacks.onDisconnect && callbacks.onDisconnect();
          break;
        case "error":
          callbacks.onError && callbacks.onError(new Error(msg.msg));
          break;
      }
    };
    ws.onclose = function () {
      connected = false;
      if (role) { reconnectTimer = setTimeout(function () { if (role) connect(); }, 2000); }
    };
    ws.onerror = function () {};
  }

  function host() { disconnect(); role = "host"; connect(); }

  function join(code) { disconnect(); role = "joiner"; roomCode = code; connect(); }

  function send(type, data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(Object.assign({ type: type }, data)));
  }

  function sendState(state) { send("state", { data: state }); }
  function sendTurnEnd(score, combo) { send("turnEnd", { score: score, combo: combo }); }
  function sendGameOver(winner, hs, js) { send("gameOver", { winner: winner, hs: hs, js: js }); }
  function sendRematchRequest() { send("rematchReq", {}); }
  function sendRematchAccept() { send("rematchAccept", {}); }
  function sendRematchDecline() { send("rematchDecline", {}); }

  function disconnect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    connected = false; remoteState = null;
    roomCode = null; role = null;
  }

  NS.MP = {
    init: init, host: host, join: join,
    sendState: sendState, sendTurnEnd: sendTurnEnd, sendGameOver: sendGameOver,
    sendRematchRequest: sendRematchRequest,
    sendRematchAccept: sendRematchAccept,
    sendRematchDecline: sendRematchDecline,
    disconnect: disconnect,
    get connected() { return connected; },
    get role() { return role; },
    get roomCode() { return roomCode; },
    get remoteState() { return remoteState; },
    bufferedAmount: function () { return ws ? ws.bufferedAmount : 0; }
  };
})();
