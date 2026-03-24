const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Create the HTTP server and attach Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allows your React app to connect from any port
    methods: ["GET", "POST"]
  }
});

// This object will hold the live data for every kid currently playing
const players = {};

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // 1. Handle joining the game
  socket.on('join', (data) => {
    players[socket.id] = {
      id: socket.id,
      name: data.name || 'Anonymous',
      color: data.color || '#f4a0b0',
      creatureType: data.creatureType || 'cat',
      // Start them near the center of the island
      position: { x: (Math.random() - 0.5) * 10, y: 1, z: (Math.random() - 0.5) * 10 },
      rotation: { x: 0, y: 0, z: 0 },
      isMoving: false,
      isSwimming: false
    };
    
    console.log(`🏝️ ${players[socket.id].name} joined the island!`);
    
    // Welcome the new player and send them the current state of everyone else
    socket.emit('currentPlayers', players);
    
    // Tell everyone else that a new player arrived
    socket.broadcast.emit('playerJoined', players[socket.id]);
  });

  // 2. Handle movement
  socket.on('move', (transformData) => {
    if (players[socket.id]) {
      players[socket.id].position = transformData.position;
      players[socket.id].rotation = transformData.rotation;
      players[socket.id].isMoving = transformData.isMoving;
      players[socket.id].isSwimming = transformData.isSwimming;
    }
  });

  // 3. Handle Chat Messages
  socket.on('chat', (text) => {
    if (players[socket.id]) {
      const messageData = {
        id: socket.id,
        name: players[socket.id].name,
        color: players[socket.id].color,
        text: text,
        timestamp: Date.now()
      };
      // Broadcast the message to EVERYONE (including the sender)
      io.emit('chatMessage', messageData);
      console.log(`💬 ${messageData.name}: ${messageData.text}`);
    }
  });

  // 4. Handle Disconnects (when they close the browser)
  socket.on('disconnect', () => {
    console.log(`👋 Player disconnected: ${socket.id}`);
    if (players[socket.id]) {
      const name = players[socket.id].name;
      delete players[socket.id];
      // Tell everyone else to remove this player from their screen
      io.emit('playerLeft', socket.id);
      console.log(`${name} left the island.`);
    }
  });
});

// --- THE GAME LOOP ---
// Instead of sending a network packet every single time someone touches a key,
// we gather all the positions and broadcast the "World State" 30 times a second.
// This prevents the server from melting and keeps the game buttery smooth.
setInterval(() => {
  io.emit('stateUpdate', players);
}, 1000 / 30);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Candy Island Server running on http://localhost:${PORT}`);
});
