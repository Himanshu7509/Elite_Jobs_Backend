import mongoose from "mongoose";

let isConnected = false;

const dbConnect = async () => {
  console.log('=== DATABASE CONNECTION ATTEMPT ===');
  console.log('Current connection state:', mongoose.connection.readyState);
  
  if (isConnected) {
    console.log("⚡ Using existing MongoDB connection");
    return;
  }

  try {
    console.log('Attempting to connect to MongoDB with URI:', process.env.MONGO_URI);
    const conn = await mongoose.connect(process.env.MONGO_URI);
    isConnected = conn.connections[0].readyState;
    console.log("✅ MongoDB connected successfully");
    console.log("MongoDB connection state:", mongoose.connection.readyState);
    console.log("Connection details:", {
      host: conn.connection.host,
      name: conn.connection.name,
      port: conn.connection.port
    });
    return conn;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error("Error details:", err);
    console.error("Please check your MONGO_URI in .env file");
    throw err;
  }
};

export default dbConnect;