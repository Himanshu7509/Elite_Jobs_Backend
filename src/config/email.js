import { Resend } from 'resend';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Resend with API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

export default resend;