import express from 'express';
import cors from 'cors';
import "dotenv/config";
import { loginUser, registerUser, getCurrentUser } from './routes/auth.js'; 
import { setupMFA, verifyMFALogin } from './routes/mfa.js';
import { ActiveVault, CreateVault, FinishVault, ListVault, UnfinishedVault } from './routes/vault.js';

const app = express();

// TODO: Restrict CORS to only allow requests from the frontend
app.use(cors());
app.use(express.json());

app.post("/vault/new", CreateVault);
app.get("/vault/list", ListVault);
app.post("/vault/complete", FinishVault);
app.post("/vault/incomplete", UnfinishedVault);
app.get("/vault/active", ActiveVault)


app.post("/login", loginUser);
app.post("/register", registerUser);
app.get("/me", getCurrentUser);

app.post('/mfa/register', setupMFA);
app.post('/mfa', verifyMFALogin);

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
