import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import targetsRoutes from './routes/targets.js';
import foodsRoutes from './routes/foods.js';
import recipesRoutes from './routes/recipes.js';
import logRoutes from './routes/log.js';
import trackerRoutes from './routes/tracker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

// ---------- API ----------
app.use('/api', authRoutes);
app.use('/api', targetsRoutes);
app.use('/api', foodsRoutes);
app.use('/api', recipesRoutes);
app.use('/api', logRoutes);
app.use('/api', trackerRoutes);

// ---------- Static frontend ----------
const publicDir = join(__dirname, '..', 'frontend', 'public');
app.use(express.static(publicDir));
app.get('*', (req, res) => {
  res.sendFile(join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MacroLog en écoute sur http://localhost:${PORT}`);
});
