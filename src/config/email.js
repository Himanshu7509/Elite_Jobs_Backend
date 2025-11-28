import { Resend } from 'resend';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Resend with API key from environment variables
// Handle the case where the API key is not available
let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('RESEND_API_KEY not found in environment variables. Email functionality will be disabled.');
  resend = {
    emails: {
      send: async () => {
        console.warn('Email sending is disabled due to missing RESEND_API_KEY');
        return { id: 'disabled' };
      }
    }
  };
}

export default resend;