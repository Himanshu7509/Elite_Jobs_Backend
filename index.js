import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import jwt from 'jsonwebtoken';

dotenv.config();

// Import database connection
import dbConnect from './src/config/mongodb.js';

// Import passport configuration
import passport from './src/config/passport.js';

// Import routes
import authRouter from './src/routes/auth.route.js';
import jobRouter from './src/routes/job.route.js';
import recruiterRouter from './src/routes/recruiter.route.js';
import adminRouter from './src/routes/admin.route.js';
import eliteTeamRouter from './src/routes/eliteTeam.route.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
dbConnect();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/auth', authRouter);
app.use('/jobs', jobRouter);
app.use('/recruiter', recruiterRouter);
app.use('/admin', adminRouter);
app.use('/elite-team', eliteTeamRouter);

// Google OAuth routes - only set up if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get('/auth/google', 
    (req, res, next) => {
      // Store the role in the session for later use
      if (req.query.role) {
        req.session.oauthRole = req.query.role;
      }
      next();
    },
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      // If we have a new user from Google (not yet in our system)
      if (req.user.googleProfile) {
        // Redirect to a frontend page where they can select their role
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/google-role-selection?googleId=${req.user.googleProfile.id}&email=${req.user.googleProfile.emails[0].value}&name=${req.user.googleProfile.displayName}`);
      }
      
      // For existing users, redirect to dashboard with token
      const token = jwt.sign({ userId: req.user._id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard?token=${token}`);
    }
  );
} else {
  console.log('Google OAuth routes not configured: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

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