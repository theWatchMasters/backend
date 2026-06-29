import express from 'express';
import 'dotenv/config';
import { loginUser, registerUser, getCurrentUser } from './routes/auth.js';
import { setupMFA, verifyMFALogin, verifyMFASetup } from './routes/mfa.js';
import {
  activeVault,
  createVault,
  finishVault,
  listVault,
  payVault,
  unfinishedVault,
} from './routes/vault.js';
import { authMiddleware } from './utils/auth/middleware.js';
import morgan from 'morgan';
import { vaultMiddleware } from './utils/vault/middleware.js';
const app = express();

app.use(express.json());
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.get('/vault/list', vaultMiddleware(listVault));
app.get('/vault/active', vaultMiddleware(activeVault));
app.post('/vault/pay', vaultMiddleware(payVault));
app.post('/vault/new', vaultMiddleware(createVault));
app.post('/vault/complete', vaultMiddleware(finishVault));
app.post('/vault/incomplete', vaultMiddleware(unfinishedVault));

app.post('/login', loginUser);
app.post('/register', registerUser);
app.get('/me', authMiddleware(getCurrentUser));

app.post('/mfa/register/verify', authMiddleware(verifyMFASetup));
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
