import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== STARTING SERVER ===');
console.log('Current working directory:', process.cwd());
console.log('Script directory:', __dirname);

// Load environment variables from the correct path
const envPath = path.resolve(__dirname, '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

console.log('Environment variables after dotenv:');
console.log('MONGO_URI:', process.env.MONGO_URI);
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY);

// Import database connection
import dbConnect from './src/config/mongodb.js';

// Import passport configuration
import passport from './src/config/passport.js';
import jwt from 'jsonwebtoken';

// Import routes
import authRouter from './src/routes/auth.route.js';
import jobRouter from './src/routes/job.route.js';
import recruiterRouter from './src/routes/recruiter.route.js';
import adminRouter from './src/routes/admin.route.js';
import eliteTeamRouter from './src/routes/eliteTeam.route.js';

const startServer = async () => {
  console.log('=== STARTING SERVER FUNCTION ===');
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Connect to database
  try {
    await dbConnect();
    console.log('✅ Database connection established');
  } catch (err) {
    console.error('❌ Failed to connect to database:', err);
    process.exit(1);
  }

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));


  // Add error handling middleware early to catch any issues
  app.use((err, req, res, next) => {
    console.error('=== EARLY ERROR HANDLING ===');
    console.error('Error:', err);
    next(err);
  });

  // Session middleware for passport
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false
  }));

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Routes
  console.log('Mounting auth routes');
  app.use('/auth', authRouter);
  console.log('Auth routes mounted');

  console.log('Mounting jobs routes');
  app.use('/jobs', jobRouter);
  console.log('Jobs routes mounted');

  console.log('Mounting recruiter routes');
  app.use('/recruiter', recruiterRouter);
  console.log('Recruiter routes mounted');

  console.log('Mounting admin routes');
  app.use('/admin', adminRouter);
  console.log('Admin routes mounted');

  console.log('Mounting elite-team routes');
  app.use('/elite-team', eliteTeamRouter);
  console.log('Elite-team routes mounted');

  // Google OAuth routes - only set up if credentials are provided
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    console.log('Google OAuth routes configured');
    app.get('/auth/google', 
      (req, res, next) => {
        // Don't store the role in the session anymore since we're not specifying it in the URL
        // For existing users, we'll try to log them in directly
        // For new users, they'll select their role on the GoogleRoleSelection page
        next();
      },
      passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    app.get('/auth/google/callback',
      (req, res, next) => {
        // Add error handling middleware to catch any errors during authentication
        passport.authenticate('google', (err, user, info) => {
          if (err) {
            console.error('Google OAuth Error:', err);
            return res.status(500).json({
              success: false,
              message: 'Google authentication failed',
              error: err.message
            });
          }
          
          // Handle the case where user is false but we have info (new user case)
          if (!user && info && info.googleProfile) {
            console.log('New user detected in callback, redirecting to role selection');
            // Redirect to a frontend page where they can select their role
            const frontendUrl = process.env.FRONTEND_URL || 'https://www.eliteindiajobs.com';
            return res.redirect(`${frontendUrl}/google-role-selection?googleId=${info.googleProfile.id}&email=${info.googleProfile.emails[0].value}&name=${info.googleProfile.displayName}`);
          }
          
          if (!user) {
            console.error('Google OAuth Failed:', info);
            // Redirect to role selection page for users who need to sign up
            if (info && info.message && info.message.includes('not found')) {
              const frontendUrl = process.env.FRONTEND_URL || 'https://www.eliteindiajobs.com';
              return res.redirect(`${frontendUrl}/google-role-selection?googleId=${info.googleProfile.id}&email=${info.googleProfile.emails[0].value}&name=${info.googleProfile.displayName}`);
            }
            return res.status(401).json({
              success: false,
              message: 'Google authentication failed',
              error: info ? info.message : 'Unknown error'
            });
          }
          
          // If authentication successful, log the user in
          req.logIn(user, { session: true }, (loginErr) => {
            if (loginErr) {
              console.error('Login Error:', loginErr);
              return res.status(500).json({
                success: false,
                message: 'Failed to login user',
                error: loginErr.message
              });
            }
            next();
          });
        })(req, res, next);
      },
      (req, res) => {
        try {
          // For existing users, redirect to Google callback handler with token
          const token = jwt.sign({ userId: req.user._id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
          const frontendUrl = process.env.FRONTEND_URL || 'https://www.eliteindiajobs.com';
          res.redirect(`${frontendUrl}/google-callback?token=${token}`);
        } catch (error) {
          console.error('Google OAuth Callback Error:', error);
          res.status(500).json({
            success: false,
            message: 'Something went wrong during Google authentication',
            error: error.message
          });
        }
      }
    );
  } else {
    console.log('Google OAuth routes not configured: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
    console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET);
  }

  // Health check endpoint
  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Elite Jobs Backend API is running!',
      timestamp: new Date().toISOString()
    });
  });

  // Simple test endpoint for google signup
  app.post('/test-google-signup', (req, res) => {
    console.log('Test google signup endpoint hit with body:', req.body);
    res.status(200).json({
      success: true,
      message: 'Test endpoint working',
      data: req.body
    });
  });

  // Another test endpoint to verify server is working
  app.get('/health', (req, res) => {
    console.log('Health check endpoint hit');
    res.status(200).json({
      success: true,
      message: 'Server is healthy',
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
    console.error('=== UNHANDLED ERROR ===');
    console.error('Error details:', err);
    console.error('Error stack:', err.stack);
    console.error('Request URL:', req.url);
    console.error('Request method:', req.method);
    console.error('Request body:', req.body);
    
    res.status(500).json({
      success: false,
      message: 'Something went wrong!',
      error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
  });

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

// Start the server
console.log('=== CALLING START SERVER ===');
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});