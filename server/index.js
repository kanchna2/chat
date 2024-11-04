// Import dependencies
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
require('dotenv').config();

const JWT_SECRET = process.env.JWT; 
// Models
const User = require("./chat/db");
const Message = require("./chat/message");

// Initialize express app and server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO).then(()=>{
    console.log("database connected...");
}).catch((err)=>{
    console.log("database connection failed", err.message);
});

// Authentication Routes
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  const user = new User({ username, password: hashedPassword });

  try {
    await user.save();
    res.status(201).send({ message: "User registered" });
  } catch (error) {
    res.status(500).send({ error: "Error registering user" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).send({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ username }, JWT_SECRET);
  res.send({ token });
});

// WebSocket setup and user tracking
const connections = {}; // Active WebSocket connections by username

// Helper function to broadcast all users' statuses
const broadcastOnlineUsers = async () => {
  const users = await User.find({}, "username lastOnline").lean(); // Retrieve usernames and lastOnline timestamps
  const userStatus = users.map((user) => ({
    username: user.username,
    isOnline: !!connections[user.username],
    lastOnline: user.lastOnline,
  }));
   
  for (const ws of Object.values(connections)) {
    ws.send(JSON.stringify({ type: "user-status", users: userStatus }));
  }
};

// WebSocket connection handling
wss.on("connection", (ws) => {
  let username;

  ws.on("message", async (data) => {
    const message = JSON.parse(data);

    // Handle join event to set user as online
    if (message.type === "join") {
      const decoded = jwt.verify(message.token, JWT_SECRET);
      username = decoded.username;

      // Update connection and clear lastOnline
      connections[username] = ws;
      await User.updateOne({ username }, { $set: { lastOnline: null } });

      // Send undelivered messages only if a recipient is specified
      const undeliveredMessages = await Message.find({
        recipient: username,
        delivered: false,
      });
      
      undeliveredMessages.forEach((msg) => {
        ws.send(
          JSON.stringify({
            type: "message",
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.timestamp.toLocaleTimeString(),
          })
        );
      });

      // Mark messages as delivered and delete from database
      await Message.deleteMany({ recipient: username, delivered: false });

      // Broadcast updated statuses
      broadcastOnlineUsers();
      return;
    }

    // Handle `get-user-status` request
    if (message.type === "get-user-status") {
      const requestedUser = message.recipient;
      const user = await User.findOne({ username: requestedUser });
      console.log(user)
      const response = {
        type: "user-status",
        users: [
          {
            username: requestedUser,
            isOnline: !!connections[requestedUser],
            lastOnline: user ? user.lastOnline : null,
          },
        ],
      };
      ws.send(JSON.stringify(response));
      return;
    }

    // Handle incoming chat message
    const { token, recipient, content } = message;
    if (!recipient) {
      ws.send(JSON.stringify({ error: "Recipient not specified." }));
      return;
    }
    
    try {
      // Verify JWT token to get the sender's username
      const decoded = jwt.verify(token, JWT_SECRET);
      username = decoded.username;

      // Save the message to the database, setting delivered status based on recipient's online status
      const savedMessage = new Message({
        sender: username,
        recipient,
        content,
        delivered: !!connections[recipient],
      });
      await savedMessage.save();

      const broadcastMessage = JSON.stringify({
        type: "message",
        sender: username,
        content,
        timestamp: new Date().toLocaleTimeString(),
      });

      // Send the message to the recipient if they are online
      if (connections[recipient]) {
        connections[recipient].send(broadcastMessage);
      }

      // Send the message back to the sender's client to show in their chat window
      ws.send(broadcastMessage);

    } catch (error) {
      ws.send(JSON.stringify({ error: "Unauthorized" }));
    }
  });

  // Handle disconnection
  ws.on("close", async () => {
    if (username) {
      delete connections[username];
      console.log(username)
      // Update lastOnline in the database
      await User.updateOne({ username }, { $set: { lastOnline: new Date() } });
      broadcastOnlineUsers(); // Broadcast updated statuses with lastOnline
    }
  });
});


// Start server
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
