// Test script to verify contact API endpoints
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Import our new contact components
import Contact from './src/models/contact.model.js';
import contactRouter from './src/routes/contact.route.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected for testing');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Test routes
app.use('/api/contact', contactRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Contact API test server running' });
});

// Test data
const testContactData = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '9876543210',
  subject: 'Test Contact Form',
  message: 'This is a test message from the contact form API.'
};

// Test endpoint
app.post('/test-contact', async (req, res) => {
  try {
    const contact = new Contact(testContactData);
    await contact.save();
    res.json({
      success: true,
      message: 'Test contact created successfully',
      data: contact
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

// Start server
const startTestServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Test server running on port ${PORT}`);
    console.log(`📝 Test endpoints:`);
    console.log(`   POST /test-contact - Create test contact`);
    console.log(`   POST /api/contact - Create contact form (public)`);
    console.log(`   GET /api/contact - Get all contacts (admin)`);
    console.log(`   GET /api/contact/:id - Get contact by ID (admin)`);
    console.log(`   PUT /api/contact/:id - Update contact (admin)`);
    console.log(`   DELETE /api/contact/:id - Delete contact (admin)`);
    console.log(`   GET /api/contact/stats - Get contact stats (admin)`);
  });
};

startTestServer();