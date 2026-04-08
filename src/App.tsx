import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Search, 
  Bell, 
  BellOff,
  Clock,
  AlertCircle,
  ChevronRight,
  Filter,
  LogIn,
  UserPlus,
  LogOut,
  Mail,
  Lock,
  User as UserIcon,
  Timer,
  Play,
  Pause,
  RotateCcw,
  ListTodo,
  CopyPlus,
  X
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  getDocs,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { cn, formatDate, suggestCategory } from './lib/utils';
import { Task, Stats, User, AppNotification } from './types';

// --- Auth Context ---

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!userDoc.exists()) {
          const newUser = {
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || '',
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser({ id: firebaseUser.uid, ...newUser });
        } else {
          setUser({ id: firebaseUser.uid, ...userDoc.data() } as User);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Components ---

const Navbar = () => {
  const location = useLocation();
  const { logout } = useAuth();
  
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/calendar', icon: CalendarIcon, label: 'Calendar' },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 glass rounded-full px-6 py-3 flex items-center gap-8 z-50 shadow-2xl">
      {navItems.map((item) => (
        <Link 
          key={item.path} 
          to={item.path}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors relative",
            location.pathname === item.path ? "text-blue-400" : "text-slate-500 hover:text-slate-300"
          )}
        >
          <item.icon size={20} />
          <span className="text-[10px] font-medium uppercase tracking-wider">{item.label}</span>
          {location.pathname === item.path && (
            <motion.div 
              layoutId="nav-indicator"
              className="absolute -bottom-1 w-1 h-1 rounded-full bg-blue-400"
            />
          )}
        </Link>
      ))}
      <button 
        onClick={logout}
        className="flex flex-col items-center gap-1 text-slate-500 hover:text-rose-400 transition-colors"
      >
        <LogOut size={20} />
        <span className="text-[10px] font-medium uppercase tracking-wider">Logout</span>
      </button>
    </nav>
  );
};

const StatCard = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass p-6 rounded-3xl flex flex-col gap-2"
  >
    <span className="text-slate-500 text-sm font-medium">{label}</span>
    <span className={cn("text-4xl font-display font-bold", color)}>{value}</span>
  </motion.div>
);

interface TaskCardProps {
  key?: string;
  task: Task;
  onToggle: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

const TaskCard = ({ task, onToggle, onDelete }: TaskCardProps) => {
  const isOverdue = new Date(task.deadline) < new Date() && !task.completed;
  const isDueSoon = !task.completed && !isOverdue && (new Date(task.deadline).getTime() - new Date().getTime()) < 86400000 * 2;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "glass p-5 rounded-2xl flex flex-col gap-4 group relative overflow-hidden",
        task.completed ? "opacity-60" : ""
      )}
    >
      <div className="flex items-start gap-4">
        <button 
          onClick={() => onToggle(task.id)}
          className="mt-1 text-slate-500 hover:text-blue-400 transition-colors"
        >
          {task.completed ? <CheckCircle2 className="text-blue-400" /> : <Circle />}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={cn(
              "font-semibold truncate text-lg",
              task.completed ? "line-through text-slate-500" : "text-slate-100"
            )}>
              {task.title}
            </h3>
          </div>
          <p className="text-slate-400 text-sm line-clamp-2 mb-3">{task.description}</p>
          
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className={cn(
              "flex items-center gap-1.5",
              isOverdue ? "text-rose-400" : isDueSoon ? "text-amber-400" : "text-slate-500"
            )}>
              <Clock size={14} />
              {formatDate(task.deadline)}
              {isOverdue && <span className="ml-1 font-bold">(Overdue)</span>}
              {isDueSoon && <span className="ml-1 font-bold">(Soon)</span>}
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Filter size={14} />
              {task.category}
            </div>
          </div>
        </div>

        <button 
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-rose-400 transition-all"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </motion.div>
  );
};

// --- Auth Pages ---

const LoginPage = () => {
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      await login();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-md rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
            <LogIn className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-100">Welcome Back</h1>
          <p className="text-slate-400">Sign in to manage your student life</p>
        </div>

        <div className="flex flex-col gap-5">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          <button 
            onClick={handleGoogleLogin}
            className="w-full glass hover:bg-white/10 py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-3 border border-white/10"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
            Continue with Google
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const RegisterPage = LoginPage;
const ForgotPasswordPage = LoginPage;

// --- Pages ---

const Dashboard = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, pending: 0 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const addAppNotification = (title: string, body: string, type: AppNotification['type'] = 'reminder') => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      body,
      timestamp: new Date().toISOString(),
      read: false,
      type
    };
    setAppNotifications(prev => [newNotif, ...prev].slice(0, 20));
    
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  };

  const testNotification = () => {
    addAppNotification("Test Notification", "This is a test of the notification system!", "success");
  };

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    deadline: '',
    category: '',
    reminderValue: '1',
    reminderUnit: 'days'
  });

  useEffect(() => {
    if (!user) return;

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(taskList);
      
      const total = taskList.length;
      const completed = taskList.filter(t => t.completed).length;
      const pending = total - completed;
      setStats({ total, completed, pending });
    });

    // Notification Checker
    const notifiedTasks = new Set<string>();
    const interval = setInterval(() => {
      const now = new Date();
      tasks.forEach(task => {
        if (task.completed) return;
        
        const deadline = new Date(task.deadline);
        const diffMs = deadline.getTime() - now.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        // 5 mins before automatic notification
        if (diffMins === 5 && !notifiedTasks.has(`${task.id}-5min`)) {
          addAppNotification("Task Reminder", `"${task.title}" is due in 5 minutes!`);
          notifiedTasks.add(`${task.id}-5min`);
        }

        // Custom reminder
        if (task.reminderValue && task.reminderUnit) {
          const val = parseInt(task.reminderValue);
          let reminderMs = 0;
          if (task.reminderUnit === 'hours') reminderMs = val * 60 * 60 * 1000;
          if (task.reminderUnit === 'days') reminderMs = val * 24 * 60 * 60 * 1000;

          const reminderTime = deadline.getTime() - reminderMs;
          const timeToReminder = Math.floor((reminderTime - now.getTime()) / 60000);

          if (timeToReminder === 0 && !notifiedTasks.has(`${task.id}-custom`)) {
            addAppNotification("Task Reminder", `"${task.title}" reminder: Due at ${formatDate(task.deadline)}`);
            notifiedTasks.add(`${task.id}-custom`);
          }
        }
      });
    }, 30000); // Check every 30 seconds

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [user, tasks]);

  const handleToggle = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await updateDoc(doc(db, 'tasks', id), { completed: !task.completed });
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'tasks', id));
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("You must be logged in to add tasks.");
      return;
    }
    if (!newTask.title.trim()) {
      alert("Please enter a task title.");
      return;
    }
    if (!newTask.deadline) {
      alert("Please select a deadline.");
      return;
    }
    
    const category = newTask.category || suggestCategory(newTask.title, newTask.description);
    
    try {
      // Ensure deadline is in ISO format for Firestore
      const deadlineISO = new Date(newTask.deadline).toISOString();
      
      await addDoc(collection(db, 'tasks'), {
        ...newTask,
        deadline: deadlineISO,
        category,
        userId: user.id,
        completed: false,
        createdAt: new Date().toISOString()
      });

      setNewTask({ title: '', description: '', deadline: '', category: '', reminderValue: '1', reminderUnit: 'days' });
      setIsAdding(false);
    } catch (err: any) {
      console.error("Error adding task:", err);
      alert(`Failed to add task: ${err.message || 'Unknown error'}`);
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("You must be logged in to add tasks.");
      return;
    }
    if (!bulkText.trim()) return;

    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l);
    const parsedTasks = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(.*?)\s\((?:Online|Offline)\)\s-(.*?)\s\(Last date:\s(\d{2}-[a-zA-Z]{3}-\d{4})\)$/);
      
      if (match) {
        const [_, title, category, dateStr] = match;
        const date = new Date(dateStr);
        
        let shouldAdd = true;
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].toLowerCase();
          if (nextLine === 'submitted') {
            shouldAdd = false;
            i++;
          } else if (nextLine === 'pending' || nextLine === 'overdue') {
            i++;
          }
        }

        if (shouldAdd) {
          parsedTasks.push({
            title,
            description: category.trim(),
            deadline: date.toISOString(),
            category: category.split('-')[0].trim() || 'General',
            userId: user.id,
            completed: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    if (parsedTasks.length === 0) {
      alert("No valid tasks found in the text. Please check the format.");
      return;
    }

    try {
      await Promise.all(parsedTasks.map(t => addDoc(collection(db, 'tasks'), t)));
      setBulkText('');
      setIsBulkAdding(false);
    } catch (err: any) {
      console.error("Bulk add failed:", err);
      alert(`Some tasks failed to add: ${err.message || 'Unknown error'}`);
    }
  };

  const filteredTasks = tasks
    .filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    .filter(t => filter === 'All' ? true : t.category === filter)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  const categories = ['All', ...Array.from(new Set(tasks.map(t => t.category)))];
  const overallProgress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto px-6 pt-12 pb-32">
      <header className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-display font-bold text-slate-100 mb-2">Hey {user?.name || 'Student'}! 👋</h1>
          <p className="text-slate-400">You have <span className="text-blue-400 font-bold">{stats.pending}</span> tasks pending for today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={testNotification}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl glass text-xs font-bold text-slate-400 hover:text-blue-400 transition-all"
          >
            Test Notif
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(
                "p-3 rounded-2xl glass transition-all relative",
                notificationsEnabled ? "text-blue-400" : "text-slate-500"
              )}
            >
              <Bell size={24} />
              {appNotifications.some(n => !n.read) && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-950" />
              )}
            </button>
            
            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-4 w-80 glass rounded-3xl p-4 z-50 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="font-bold text-slate-100">Notifications</h3>
                    <button 
                      onClick={() => setAppNotifications(prev => prev.map(n => ({...n, read: true})))}
                      className="text-[10px] uppercase tracking-widest font-bold text-blue-400 hover:text-blue-300"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                    {appNotifications.length > 0 ? (
                      appNotifications.map(n => (
                        <div key={n.id} className={cn(
                          "p-3 rounded-2xl transition-all",
                          n.read ? "bg-white/5 opacity-60" : "bg-white/10 border-l-2 border-blue-500"
                        )}>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-100">{n.title}</h4>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{n.body}</p>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center">
                        <BellOff className="mx-auto text-slate-700 mb-2" size={32} />
                        <p className="text-slate-500 text-sm italic">No notifications yet.</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Always On</span>
                    <button 
                      onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                      className={cn(
                        "w-10 h-5 rounded-full transition-all relative",
                        notificationsEnabled ? "bg-blue-600" : "bg-slate-700"
                      )}
                    >
                      <motion.div 
                        animate={{ x: notificationsEnabled ? 20 : 2 }}
                        className="absolute top-1 w-3 h-3 bg-white rounded-full"
                      />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <StatCard label="Total Tasks" value={stats.total} color="text-slate-100" />
        <StatCard label="Completed" value={stats.completed} color="text-emerald-400" />
        <StatCard label="Pending" value={stats.pending} color="text-amber-400" />
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Search tasks..."
            className="w-full glass rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                filter === cat ? "bg-blue-600 text-white" : "glass text-slate-400 hover:text-slate-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-display font-bold text-slate-100">Your Tasks</h2>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsBulkAdding(true)}
              className="flex items-center gap-2 glass hover:bg-white/10 text-slate-300 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            >
              <CopyPlus size={18} />
              Bulk Add
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus size={18} />
              Add Task
            </button>
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass p-12 rounded-3xl text-center"
            >
              <p className="text-slate-500">No tasks found. Time to relax! ☕</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bulk Add Modal */}
      <AnimatePresence>
        {isBulkAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 py-10 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkAdding(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass w-full max-w-2xl rounded-3xl p-8 relative z-10 my-auto"
            >
              <h2 className="text-2xl font-display font-bold text-slate-100 mb-2">Bulk Add Tasks</h2>
              <p className="text-slate-400 text-sm mb-6">Paste your task list below. The app will automatically parse titles, courses, and deadlines.</p>
              
              <form onSubmit={handleBulkAdd} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Task List Text</label>
                  <textarea 
                    autoFocus
                    className="glass bg-white/5 rounded-xl p-4 h-64 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button 
                    type="button"
                    onClick={() => setIsBulkAdding(false)}
                    className="flex-1 glass py-3 rounded-xl font-bold text-slate-400 hover:text-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-white transition-all shadow-lg shadow-blue-600/20"
                  >
                    Add Tasks
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 py-10 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass w-full max-w-lg rounded-[2.5rem] p-10 relative z-10 my-auto border-white/20"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-display font-black text-slate-100">New Task</h2>
                <div className="h-px flex-1 bg-white/10 mx-6" />
                <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddTask} className="flex flex-col gap-8">
                <div className="space-y-6">
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Task Title</label>
                    <input 
                      autoFocus
                      type="text" 
                      required
                      placeholder="e.g. Finish Architecture Project"
                      className="bg-white/5 border-b border-white/10 py-4 text-xl font-medium focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-700"
                      value={newTask.title}
                      onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Description</label>
                    <textarea 
                      placeholder="Add some notes..."
                      className="bg-white/5 border border-white/10 rounded-2xl p-4 h-24 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-700 resize-none"
                      value={newTask.description}
                      onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Deadline</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                          type="datetime-local" 
                          required
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 focus:outline-none focus:border-blue-500 transition-colors"
                          value={newTask.deadline}
                          onChange={(e) => setNewTask({...newTask, deadline: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Reminder</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          min="1"
                          className="w-20 bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-blue-500 transition-colors"
                          value={newTask.reminderValue}
                          onChange={(e) => setNewTask({...newTask, reminderValue: e.target.value})}
                        />
                        <select 
                          className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                          value={newTask.reminderUnit}
                          onChange={(e) => setNewTask({...newTask, reminderUnit: e.target.value})}
                        >
                          <option value="hours">Hours before</option>
                          <option value="days">Days before</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Category</label>
                    <div className="relative">
                      <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input 
                        type="text" 
                        placeholder="e.g. Design"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-700"
                        value={newTask.category}
                        onChange={(e) => setNewTask({...newTask, category: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black text-white transition-all shadow-xl shadow-blue-600/20 uppercase tracking-widest text-sm"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CalendarView = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'tasks'), where('userId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });
    return () => unsubscribe();
  }, [user]);

  const tasksOnSelectedDate = tasks.filter(t => 
    new Date(t.deadline).toDateString() === selectedDate.toDateString()
  );

  const tileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month') {
      const hasTasks = tasks.some(t => new Date(t.deadline).toDateString() === date.toDateString());
      if (hasTasks) {
        return <div className="h-1.5 w-1.5 bg-blue-500 rounded-full mx-auto mt-1 shadow-lg shadow-blue-500/50" />;
      }
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-12 pb-32">
      <div className="flex flex-col md:flex-row gap-12 items-start">
        {/* Left Side: Oversized Date */}
        <div className="md:w-1/3 sticky top-12">
          <div className="relative">
            <motion.span 
              key={selectedDate.getDate()}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display font-black text-[180px] leading-none text-white/10 absolute -top-12 -left-4 select-none"
            >
              {selectedDate.getDate().toString().padStart(2, '0')}
            </motion.span>
            <div className="relative z-10 pt-8">
              <h1 className="text-5xl font-display font-black text-slate-100 mb-2">
                {selectedDate.toLocaleDateString('en-US', { month: 'long' })}
              </h1>
              <p className="text-blue-400 font-black uppercase tracking-[0.3em] text-sm">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
              </p>
              <div className="mt-12 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Schedule</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">
                  You have {tasksOnSelectedDate.length} tasks scheduled for this day. 
                  Stay focused and manage your time effectively.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Calendar & Tasks */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
          <div className="glass p-8 rounded-[2.5rem] border-white/20">
            <Calendar 
              onChange={(val) => setSelectedDate(val as Date)} 
              value={selectedDate}
              tileContent={tileContent}
              className="modern-calendar"
            />
          </div>
          
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-black text-slate-100">Tasks</h2>
              <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                {tasksOnSelectedDate.length} Items
              </span>
            </div>
            
            <AnimatePresence mode="popLayout">
              {tasksOnSelectedDate.length > 0 ? (
                tasksOnSelectedDate.map(task => (
                  <motion.div 
                    key={task.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="glass-card p-6 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-2 h-12 rounded-full",
                        task.completed ? "bg-emerald-500/50" : "bg-blue-500"
                      )} />
                      <div>
                        <h3 className={cn(
                          "font-bold text-lg transition-all",
                          task.completed ? "text-slate-500 line-through" : "text-slate-100"
                        )}>
                          {task.title}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                      task.completed ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-400"
                    )}>
                      {task.completed ? 'Done' : 'Pending'}
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass p-12 rounded-[2.5rem] text-center border-dashed border-white/10"
                >
                  <CalendarIcon className="mx-auto text-slate-800 mb-4" size={48} />
                  <p className="text-slate-500 font-display italic">No tasks found for this date.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }
  
  if (!user) return <LoginPage />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/calendar" element={
              <ProtectedRoute>
                <CalendarView />
              </ProtectedRoute>
            } />
          </Routes>
          <AuthConsumerNavbar />
        </div>
      </Router>
    </AuthProvider>
  );
}

const AuthConsumerNavbar = () => {
  const { user } = useAuth();
  if (!user) return null;
  return <Navbar />;
};
