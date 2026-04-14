import express from 'express';
import mongoose from 'mongoose';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  topScore: { type: Number, default: 0 },
  currentLevel: { type: Number, default: 1 },
  isGameOver: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// In-memory fallback for preview environment without MongoDB
let fallbackUsers: any[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  let useMongoDB = false;
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
      useMongoDB = true;
    } catch (err) {
      console.error('MongoDB connection error, using in-memory fallback:', err);
    }
  } else {
    console.log('No MONGODB_URI provided, using in-memory fallback for preview.');
  }

  // API Routes
  app.post('/api/users', async (req, res) => {
    try {
      const { username } = req.body;
      if (useMongoDB) {
        let user = await User.findOne({ username });
        if (!user) {
          user = new User({ username });
          await user.save();
        }
        res.json(user);
      } else {
        let user = fallbackUsers.find(u => u.username === username);
        if (!user) {
          user = { username, topScore: 0, currentLevel: 1, isGameOver: false };
          fallbackUsers.push(user);
        }
        res.json(user);
      }
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/score', async (req, res) => {
    try {
      const { username, score, level, isGameOver } = req.body;
      if (useMongoDB) {
        const user = await User.findOne({ username });
        if (user) {
          if (score > user.topScore) {
            user.topScore = score;
          }
          user.currentLevel = level;
          user.isGameOver = isGameOver;
          await user.save();
          res.json(user);
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      } else {
        const user = fallbackUsers.find(u => u.username === username);
        if (user) {
          if (score > user.topScore) {
            user.topScore = score;
          }
          user.currentLevel = level;
          user.isGameOver = isGameOver;
          res.json(user);
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      }
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/api/leaderboard', async (req, res) => {
    try {
      if (useMongoDB) {
        const leaderboard = await User.find().sort({ topScore: -1 }).limit(10);
        res.json(leaderboard);
      } else {
        const leaderboard = [...fallbackUsers].sort((a, b) => b.topScore - a.topScore).slice(0, 10);
        res.json(leaderboard);
      }
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
