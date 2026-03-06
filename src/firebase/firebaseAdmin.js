import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  let serviceAccount;

  // Option 1: Use Environment Variable (Railway Production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } 
  // Option 2: Fallback to local file (Local Development)
  else {
    const serviceAccountPath = path.resolve(__dirname, '../../firebase/elitejobs-2e753-firebase-adminsdk-fbsvc-a21ad3badd.json');
    if (existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    } else {
      throw new Error(`Service account file not found at ${serviceAccountPath} and FIREBASE_SERVICE_ACCOUNT env var is missing.`);
    }
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
}

const messaging = admin.messaging();

export { admin, messaging };
export default admin;
