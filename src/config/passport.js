import dotenv from 'dotenv';
dotenv.config();

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/auth.model.js';

// Configure Google OAuth strategy only if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('Google OAuth Profile:', profile);
      
      // Check if user already exists with this Google ID
      let user = await User.findOne({ 'google.id': profile.id });
      
      if (user) {
        console.log('Existing user found with Google ID:', profile.id);
        return done(null, user);
      }
      
      // Check if user exists with the same email
      user = await User.findOne({ email: profile.emails[0].value });
      
      if (user) {
        console.log('Existing user found with email:', profile.emails[0].value);
        // If user exists with same email but no Google ID, add Google ID to existing account
        user.google = {
          id: profile.id,
          token: accessToken
        };
        await user.save();
        return done(null, user);
      }
      
      // If user doesn't exist, return the profile info to indicate new user needs to be created
      // We'll handle user creation in the route controller
      console.log('New user detected, redirecting to role selection');
      return done(null, false, { 
        googleProfile: profile,
        accessToken: accessToken
      });
    } catch (error) {
      console.error('Google OAuth Strategy Error:', error);
      return done(error, null);
    }
  }));
} else {
  console.log('Google OAuth not configured: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

// Serialize user for session
passport.serializeUser((user, done) => {
  // For new users, we don't serialize anything to session
  // For existing users, serialize the user ID
  if (user && user._id) {
    done(null, user._id.toString());
  } else {
    // For new users or cases where we don't want to serialize to session
    done(null, false);
  }
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    if (id) {
      const user = await User.findById(id);
      done(null, user);
    } else {
      done(null, false);
    }
  } catch (error) {
    done(error, null);
  }
});

export default passport;