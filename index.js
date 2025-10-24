import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

// Import database connection
import dbConnect from './src/config/mongodb.js';

// Import routes
import authRouter from './src/routes/auth.route.js';
import jobRouter from './src/routes/job.route.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
dbConnect();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/auth', authRouter);
app.use('/jobs', jobRouter);

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Elite Jobs Backend API is running!',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});