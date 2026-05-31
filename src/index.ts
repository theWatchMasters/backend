import express from 'express';
import cors from 'cors';
import "dotenv/config";
import { loginUser } from './routes/auth.js';
import { generateMFAToken } from './utils/auth/jwt.js';
import { setupMFA, verifyMFALogin } from './routes/mfa.js';
const app = express();

// TODO: Restrict CORS to only allow requests from the frontend
app.use(cors());
app.use(express.json());
app.post('/api/mfa/setup', setupMFA);
app.post('/api/mfa/verify', verifyMFALogin);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'success.hello_world',
  });
});

app.post("/login", loginUser);


app.listen(3001, (error) => {
  if (error) {
    console.error('Error starting server:', error);
    return;
  }
  console.log('Server is running on port 3001');
});
