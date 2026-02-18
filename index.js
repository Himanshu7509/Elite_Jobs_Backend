import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport';
import jwt from 'jsonwebtoken';

// ES module dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '.env') });

// DB
import dbConnect from './src/config/mongodb.js';

// Passport config
import './src/config/passport.js';

// Routes
import authRouter from './src/routes/auth.route.js';
import jobRouter from './src/routes/job.route.js';
import recruiterRouter from './src/routes/recruiter.route.js';
import adminRouter from './src/routes/admin.route.js';
import eliteTeamRouter from './src/routes/eliteTeam.route.js';

const app = express();
const PORT = process.env.PORT || 3000;

/* ===============================
   IMPORTANT FOR RAILWAY
================================ */
app.set('trust proxy', 1);

/* ===============================
   CORS (VERY IMPORTANT)
================================ */
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://www.eliteindiajobs.com',
  'https://eliteindiajobs.com',
  'https://www.eliteindiajobs.in',
  'https://eliteindiajobs.in',
  'https://admin-panel-job-portal-six.vercel.app',
  'https://admin.eliteindiajobs.in',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);



/* ===============================
   MIDDLEWARES
================================ */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(
  session({
    name: 'elite-session',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,          // HTTPS only (Railway uses HTTPS)
      httpOnly: true,
      sameSite: 'none'       // Required for cross-domain auth
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* ===============================
   ROUTES
================================ */
app.use('/auth', authRouter);
app.use('/jobs', jobRouter);
app.use('/recruiter', recruiterRouter);
app.use('/admin', adminRouter);
app.use('/elite-team', eliteTeamRouter);

/* ===============================
   GOOGLE OAUTH
================================ */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get(
    '/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', { session: true }, (err, user, info) => {
      if (err || !user) {
        return res.redirect(
          `${process.env.FRONTEND_URL}/google-role-selection`
        );
      }

      req.logIn(user, err => {
        if (err) {
          return res.status(500).json({ success: false });
        }

        const token = jwt.sign(
          { userId: user._id, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.redirect(
          `${process.env.FRONTEND_URL}/google-callback?token=${token}`
        );
      });
    })(req, res, next);
  });
}

/* ===============================
   HEALTH CHECKS
================================ */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Elite Jobs API running',
    domain: 'api.eliteindiajobs.in'
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'OK' });
});

/* ===============================
   404 HANDLER
================================ */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

/* ===============================
   ERROR HANDLER
================================ */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

/* ===============================
   START SERVER
================================ */
const startServer = async () => {
  try {
    await dbConnect();
    console.log('✅ MongoDB connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server failed to start', error);
    process.exit(1);
  }
};

startServer();
