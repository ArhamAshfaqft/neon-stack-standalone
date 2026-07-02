(function () {
  "use strict";
  window.NS = window.NS || {};

  var peer = null, conn = null, roomCode = null, role = null, connected = false, remoteState = null;
  var callbacks = {};
  var BLOCK_H = 30;

  function init(cb) {
    callbacks = cb || {};
  }

  function genCode() {
    var c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)];
    return "NEON-" + s;
  }

  function host() {
    if (peer) disconnect();
    roomCode = genCode();
    role = "host";
    var id = roomCode.toLowerCase();
    peer = new Peer(id, { host: "0.peerjs.com", port: 443, path: "/" });
    peer.on("open", function () { callbacks.onOpen && callbacks.onOpen(roomCode); });
    peer.on("connection", function (c) {
      conn = c;
      connected = true;
      conn.on("data", onMsg);
      conn.on("close", onClose);
      callbacks.onConnect && callbacks.onConnect();
    });
    peer.on("error", function (e) { console.error("PeerJS:", e); callbacks.onError && callbacks.onError(e); });
    return roomCode;
  }

  function join(code) {
    if (peer) disconnect();
    role = "joiner";
    roomCode = code;
    peer = new Peer({ host: "0.peerjs.com", port: 443, path: "/" });
    peer.on("open", function () {
      conn = peer.connect(code.toLowerCase());
      conn.on("open", function () {
        connected = true;
        conn.on("data", onMsg);
        conn.on("close", onClose);
        callbacks.onConnect && callbacks.onConnect();
      });
    });
    peer.on("error", function (e) { console.error("PeerJS:", e); callbacks.onError && callbacks.onError(e); });
  }

  function onMsg(data) {
    switch (data.t) {
      case "s":
        remoteState = data.d;
        callbacks.onRemoteState && callbacks.onRemoteState(remoteState);
        break;
      case "done":
        callbacks.onTurnEnd && callbacks.onTurnEnd(data.s, data.c);
        break;
      case "over":
        callbacks.onGameOver && callbacks.onGameOver(data.w, data.hs, data.js);
        break;
    }
  }

  function onClose() {
    connected = false;
    callbacks.onDisconnect && callbacks.onDisconnect();
  }

  function sendState(state) {
    if (!conn || !connected) return;
    conn.send({ t: "s", d: state });
  }

  function sendTurnEnd(score, maxCombo) {
    if (!conn || !connected) return;
    conn.send({ t: "done", s: score, c: maxCombo });
  }

  function sendGameOver(winner, hostScore, joinerScore) {
    if (!conn || !connected) return;
    conn.send({ t: "over", w: winner, hs: hostScore, js: joinerScore });
  }

  function disconnect() {
    if (conn) conn.close();
    if (peer) peer.destroy();
    peer = null; conn = null; connected = false; remoteState = null;
    roomCode = null; role = null;
  }

  NS.MP = {
    init: init,
    host: host,
    join: join,
    sendState: sendState,
    sendTurnEnd: sendTurnEnd,
    sendGameOver: sendGameOver,
    disconnect: disconnect,
    get connected() { return connected; },
    get role() { return role; },
    get roomCode() { return roomCode; },
    get remoteState() { return remoteState; }
  };
})();
