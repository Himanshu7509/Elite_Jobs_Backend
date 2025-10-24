import mongoose from "mongoose";

let isConnected = false;

const dbConnect = async () => {
  if (isConnected) {
    console.log("⚡ Using existing MongoDB connection");
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    isConnected = conn.connections[0].readyState;
    console.log("✅ MongoDB connected successfully");
    console.log("MongoDB connection state:", mongoose.connection.readyState);
    return conn;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error("Please check your MONGO_URI in .env file");
    throw err;
  }
};

export default dbConnect;