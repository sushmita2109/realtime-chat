const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
  }),
);

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

const messageSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    room: {
      type: String,
      default: "general",
    },
  },
  {
    timestamps: true,
  },
);

const Message = mongoose.model("Message", messageSchema);

// Get previous messages
app.get("/api/messages", async (req, res) => {
  try {
    const messages = await Message.find({
      room: "general",
    })
      .sort({ createdAt: 1 })
      .limit(50);

    res.json(messages);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch messages",
    });
  }
});

// Socket connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join_room", (username) => {
    socket.username = username;

    socket.join("general");

    console.log(`${username} joined the chat`);

    socket.to("general").emit("user_joined", {
      username,
    });

    io.to("general").emit("online_users", getOnlineUsers());
  });

  socket.on("send_message", async (data) => {
    try {
      const newMessage = await Message.create({
        username: data.username,
        message: data.message,
        room: "general",
      });

      io.to("general").emit("receive_message", newMessage);
    } catch (error) {
      console.error(error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    io.to("general").emit("user_left", {
      username: socket.username,
    });

    io.to("general").emit("online_users", getOnlineUsers());
  });
});

function getOnlineUsers() {
  const users = [];

  for (const [, socket] of io.sockets.sockets) {
    if (socket.username) {
      users.push(socket.username);
    }
  }

  return users;
}

const PORT = process.env.PORT || 5500;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
