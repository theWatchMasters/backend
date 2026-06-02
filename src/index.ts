import express from 'express';
import cors from 'cors';
import "dotenv/config";
import { loginUser, registerUser, getCurrentUser } from './routes/auth.js'; 
import { setupMFA, verifyMFALogin } from './routes/mfa.js';
import { activeVault, createVault, finishVault, listVault, unfinishedVault } from './routes/vault.js';
import { authMiddleware } from './utils/auth/middleware.js';
import morgan from 'morgan';

const app = express();

// TODO: Restrict CORS to only allow requests from the frontend
app.use(cors());
app.use(express.json());
// app.use(morgan("dev"))

app.get("/vault/list", authMiddleware(listVault));
app.get("/vault/active", authMiddleware(activeVault));
app.post("/vault/new", authMiddleware(createVault));
app.post("/vault/complete", authMiddleware(finishVault));
app.post("/vault/incomplete", authMiddleware(unfinishedVault));

app.post("/login", loginUser);
app.post("/register", registerUser);
app.get("/me", authMiddleware(getCurrentUser));

app.post('/mfa/register', authMiddleware(setupMFA));
app.post('/mfa', verifyMFALogin);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'success.hello_world',
  });
});


app.listen(3001, (error) => {
  if (error) {
    console.error('Error starting server:', error);
    return;
  }
  console.log('Server is running on port 3001');
});
