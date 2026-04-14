import React, { useState, useEffect, useRef } from 'react';
import { Heart, Trophy, User as UserIcon, Play, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type TargetType = 'gold' | 'alien' | null;

interface LeaderboardEntry {
  username: string;
  topScore: number;
  currentLevel: number;
}

export default function App() {
  const [username, setUsername] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  
  const [activeHole, setActiveHole] = useState<number | null>(null);
  const [targetType, setTargetType] = useState<TargetType>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  const [shake, setShake] = useState(false);
  const [feedback, setFeedback] = useState<{ hole: number; text: string; color: string } | null>(null);

  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHoleRef = useRef<number | null>(null);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      setLeaderboard(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      setIsLoggedIn(true);
      startGame();
    } catch (e) {
      console.error(e);
    }
  };

  const saveScore = async () => {
    try {
      await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, score, level, isGameOver: true })
      });
      fetchLeaderboard();
    } catch (e) {
      console.error(e);
    }
  };

  const startGame = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setGameOver(false);
    setActiveHole(null);
    setTargetType(null);
    lastHoleRef.current = null;
    scheduleNextSpawn(1500, 1200);
  };

  const stopGame = () => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    if (stayTimerRef.current) clearTimeout(stayTimerRef.current);
    setActiveHole(null);
    setTargetType(null);
  };

  const scheduleNextSpawn = (currentSpawnRate: number, currentStayDuration: number) => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    
    spawnTimerRef.current = setTimeout(() => {
      spawnTarget(currentStayDuration);
      scheduleNextSpawn(currentSpawnRate, currentStayDuration);
    }, currentSpawnRate);
  };

  const spawnTarget = (stayDuration: number) => {
    if (stayTimerRef.current) clearTimeout(stayTimerRef.current);

    let nextHole;
    do {
      nextHole = Math.floor(Math.random() * 9);
    } while (nextHole === lastHoleRef.current);
    
    lastHoleRef.current = nextHole;
    
    const isAlien = Math.random() < 0.25;
    
    setActiveHole(nextHole);
    setTargetType(isAlien ? 'alien' : 'gold');

    stayTimerRef.current = setTimeout(() => {
      setActiveHole(null);
      setTargetType(null);
    }, stayDuration);
  };

  const handleHoleClick = (index: number) => {
    if (gameOver) return;
    
    if (index === activeHole && targetType) {
      if (stayTimerRef.current) clearTimeout(stayTimerRef.current);
      
      if (targetType === 'gold') {
        const newScore = score + 10;
        setScore(newScore);
        showFeedback(index, '+10', 'text-green-400');
        
        const newLevel = Math.min(100, Math.floor(newScore / 50) + 1);
        if (newLevel > level) {
          setLevel(newLevel);
          updateTimers(newLevel);
        }
      } else if (targetType === 'alien') {
        const newLives = lives - 1;
        setLives(newLives);
        showFeedback(index, '-1', 'text-red-500');
        triggerShake();
        
        if (newLives <= 0) {
          handleGameOver();
          return;
        }
      }
      
      setActiveHole(null);
      setTargetType(null);
    } else if (activeHole !== null) {
      triggerShake();
    }
  };

  const updateTimers = (newLevel: number) => {
    const multiplier = Math.pow(0.97, newLevel - 1);
    let newSpawnRate = 1500 * multiplier;
    let newStayDuration = 1200 * multiplier;
    
    if (newSpawnRate < 500) newSpawnRate = 500;
    if (newStayDuration < 400) newStayDuration = 400;
    
    scheduleNextSpawn(newSpawnRate, newStayDuration);
  };

  const handleGameOver = () => {
    setGameOver(true);
    stopGame();
    saveScore();
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  const showFeedback = (hole: number, text: string, color: string) => {
    setFeedback({ hole, text, color });
    setTimeout(() => setFeedback(null), 600);
  };

  useEffect(() => {
    return () => stopGame();
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-8 max-w-md w-full"
        >
          <div className="flex justify-center mb-6">
            <div className="bg-white/10 p-4 rounded-full border border-white/20">
              <Trophy className="w-12 h-12 text-[#fbbf24]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 text-white tracking-tight">Modern Whack-a-Mole</h1>
          <p className="text-white/60 text-center mb-8">Enter your username to start playing</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-white/50" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-white/20 rounded-xl leading-5 bg-black/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-[#6366f1] sm:text-sm transition-colors"
                  placeholder="Player123"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#6366f1] hover:bg-[#4f46e5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6366f1] transition-colors"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Game
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-75 ${shake ? 'bg-red-900/40' : ''}`}>
      <div className="max-w-[1024px] mx-auto p-6 flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="glass flex justify-between items-center px-8 py-4 mb-6 h-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.1em] opacity-70">Player</div>
              <div className="font-semibold">{username}</div>
            </div>
          </div>
          
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.1em] opacity-70">Level</div>
              <div className="text-xl font-bold text-[#a855f7]">{level}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.1em] opacity-70">Current Score</div>
              <div className="text-xl font-bold text-[#fbbf24]">{score}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.1em] opacity-70">Health</div>
              <div className="flex gap-1 text-[#ef4444] tracking-[4px] text-2xl leading-none items-center h-full">
                {'❤'.repeat(lives)}{'♡'.repeat(3 - lives)}
              </div>
            </div>
          </div>
        </header>

        {/* Main Grid & Leaderboard */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 min-h-0">
          {/* Game Area */}
          <section className="glass flex justify-center items-center p-5 relative">
            <motion.div 
              animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-3 gap-5"
              style={{ gridTemplateColumns: 'repeat(3, min(160px, 25vw))', gridTemplateRows: 'repeat(3, min(160px, 25vw))' }}
            >
              {[...Array(9)].map((_, i) => (
                <div 
                  key={i}
                  onClick={() => handleHoleClick(i)}
                  className="relative bg-black/30 rounded-full shadow-[inset_0_8px_16px_rgba(0,0,0,0.5)] flex justify-center items-center overflow-hidden cursor-pointer"
                >
                  {/* Target */}
                  <AnimatePresence>
                    {activeHole === i && targetType && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className={`w-4/5 h-4/5 rounded-full flex justify-center items-center text-4xl relative ${
                          targetType === 'gold' 
                            ? 'bg-[radial-gradient(circle_at_center,#fbbf24,#d97706)] shadow-[0_0_20px_rgba(251,191,36,0.4)] border-2 border-white/30' 
                            : 'bg-[radial-gradient(circle_at_center,#4ade80,#166534)] shadow-[0_0_20px_rgba(74,222,128,0.4)] border-2 border-white/30'
                        }`}
                      >
                        {targetType === 'gold' ? '💰' : '👾'}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Feedback Animation */}
                  <AnimatePresence>
                    {feedback?.hole === i && (
                      <motion.div
                        initial={{ opacity: 1, y: 0, scale: 0.5 }}
                        animate={{ opacity: 0, y: -50, scale: 1.2 }}
                        exit={{ opacity: 0 }}
                        className={`absolute top-5 right-5 font-black text-2xl pointer-events-none z-10 ${feedback.color}`}
                        style={{ textShadow: '0 0 10px rgba(0,0,0,0.5)' }}
                      >
                        {feedback.text}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </motion.div>

            {/* Game Over Overlay */}
            <AnimatePresence>
              {gameOver && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm flex items-center justify-center rounded-[20px] z-20"
                >
                  <div className="text-center p-8 glass max-w-sm w-full">
                    <AlertCircle className="w-16 h-16 text-[#ef4444] mx-auto mb-4" />
                    <h2 className="text-3xl font-black text-white mb-2">GAME OVER</h2>
                    <p className="text-white/70 mb-6">You survived until Level {level}</p>
                    
                    <div className="bg-black/20 rounded-xl p-4 mb-8">
                      <p className="text-[10px] text-white/50 uppercase tracking-[0.1em] font-bold mb-1">Final Score</p>
                      <p className="text-4xl font-mono font-black text-[#fbbf24]">{score}</p>
                    </div>
                    
                    <button
                      onClick={startGame}
                      className="w-full py-4 px-6 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Play className="w-5 h-5" />
                      Play Again
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Leaderboard Sidebar */}
          <aside className="glass p-6 flex flex-col">
            <h2 className="text-base uppercase tracking-[0.15em] mb-5 text-center opacity-90">Leaderboard</h2>
            
            <ul className="flex flex-col gap-2 list-none">
              {leaderboard.length === 0 ? (
                <p className="text-white/50 text-center py-8">No scores yet. Be the first!</p>
              ) : (
                leaderboard.map((entry, idx) => {
                  const isTop = idx === 0;
                  const isCurrent = entry.username === username;
                  return (
                    <li 
                      key={idx} 
                      className={`grid grid-cols-[30px_1fr_60px] px-3.5 py-2.5 rounded-xl text-sm items-center ${
                        isTop ? 'bg-[#6366f1]/20 border border-[#6366f1]/30' : 'bg-white/5'
                      } ${isCurrent && !isTop ? 'border border-[#fbbf24]/30' : ''}`}
                    >
                      <span className="font-bold text-[#fbbf24]">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>
                      <span className="opacity-90 truncate pr-2">
                        {entry.username}
                      </span>
                      <span className="text-right font-mono font-semibold">
                        {entry.topScore}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </aside>
        </main>
        
        {/* Footer / Status */}
        <footer className="mt-6 flex justify-between text-xs opacity-50 px-2.5">
          <span>Server: Region-EU-1 (Online)</span>
          <span>Stay Duration: {stayTimerRef.current ? 'Active' : 'Waiting'} | Spawn Rate: {spawnTimerRef.current ? 'Active' : 'Waiting'}</span>
          <span>DB: MongoDB Cluster-v2.4</span>
        </footer>
      </div>
    </div>
  );
}
