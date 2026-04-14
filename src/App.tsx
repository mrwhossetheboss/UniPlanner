import React, { useState, useEffect, Component } from 'react';
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
  Settings,
  BookOpen,
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
  getDoc,
  arrayUnion,
  or,
  and
} from 'firebase/firestore';
import { auth, db, messaging } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { cn, formatDate, suggestCategory } from './lib/utils';
import { Task, Stats, User, AppNotification } from './types';
import { Toaster, toast } from 'sonner';

// --- Types & Helpers ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, we might show a specific toast or error boundary update here
  toast.error(`Database error: ${errInfo.error}`);
}

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
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser({ id: firebaseUser.uid, ...docSnap.data() } as User);
          } else {
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || '',
              onboarded: false
            });
          }
          setLoading(false);
        });
      } else {
        if (unsubscribeUser) unsubscribeUser();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
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

const Onboarding = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [role, setRole] = useState<'student' | 'faculty'>('student');
  const [subject, setSubject] = useState('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const sections = ['A', 'B', 'C', 'D'];

  const handleToggleSection = (section: string) => {
    if (role === 'student') {
      setSelectedSections([section]);
    } else {
      if (selectedSections.includes(section)) {
        setSelectedSections(selectedSections.filter(s => s !== section));
      } else {
        setSelectedSections([...selectedSections, section]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (role === 'faculty' && !subject.trim()) {
      toast.error("Please enter the subject you teach");
      return;
    }
    if (selectedSections.length === 0) {
      toast.error("Please select at least one section");
      return;
    }

    try {
      const userData: any = {
        email: user.email,
        name: name.trim(),
        role,
        sections: selectedSections,
        onboarded: true,
        fcmTokens: []
      };
      
      if (role === 'faculty') {
        userData.subject = subject.trim();
      }

      await setDoc(doc(db, 'users', user.id), userData);
      window.location.reload(); // Refresh to update context
    } catch (err: any) {
      toast.error("Failed to save profile: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl"
      >
        <h2 className="text-3xl font-display font-black text-white mb-2">Complete Your Profile</h2>
        <p className="text-slate-400 mb-8">Tell us a bit more about yourself to get started.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Full Name</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter your name"
            />
          </div>

          {role === 'faculty' && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">What do you teach?</label>
              <input 
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="e.g. Mathematics, Computer Science"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Select Role</label>
            <div className="grid grid-cols-2 gap-4">
              {['student', 'faculty'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRole(r as any);
                    setSelectedSections([]);
                  }}
                  className={cn(
                    "p-4 rounded-2xl border transition-all font-bold capitalize",
                    role === r ? "bg-blue-600 border-blue-500 text-white" : "bg-white/5 border-white/10 text-slate-400"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              {role === 'student' ? 'Select Your Section' : 'Select Your Sections'}
            </label>
            <div className="grid grid-cols-4 gap-3">
              {sections.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleToggleSection(s)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all font-bold",
                    selectedSections.includes(s) ? "bg-blue-600 border-blue-500 text-white" : "bg-white/5 border-white/10 text-slate-400"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black text-white transition-all shadow-xl shadow-blue-600/20 uppercase tracking-widest text-sm mt-4"
          >
            Finish Setup
          </button>
        </form>
      </motion.div>
    </div>
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

interface TaskTableRowProps {
  key?: any;
  task: Task;
  onToggle: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  showCreator?: boolean;
  onClick: () => void;
}

const TaskTableRow = ({ task, onToggle, onDelete, showCreator = false, onClick }: TaskTableRowProps) => {
  const isOverdue = new Date(task.deadline) < new Date() && !task.completed;
  const isDueSoon = !task.completed && !isOverdue && (new Date(task.deadline).getTime() - new Date().getTime()) < 86400000 * 2;

  return (
    <motion.tr 
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer",
        task.completed ? "opacity-60" : ""
      )}
      onClick={onClick}
    >
      <td className="p-4 w-12" onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={() => onToggle(task.id)}
          className="text-slate-500 hover:text-blue-400 transition-colors"
        >
          {task.completed ? <CheckCircle2 className="text-blue-400" size={20} /> : <Circle size={20} />}
        </button>
      </td>
      
      <td className="p-4 min-w-[200px]">
        <h3 className={cn(
          "font-semibold truncate text-sm",
          task.completed ? "line-through text-slate-500" : "text-slate-100"
        )}>
          {task.title}
        </h3>
        {task.description && <p className="text-slate-500 text-[10px] truncate max-w-[200px]">{task.description}</p>}
      </td>

      <td className="p-4 whitespace-nowrap">
        <div className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          isOverdue ? "text-rose-400" : isDueSoon ? "text-amber-400" : "text-slate-400"
        )}>
          <Clock size={12} />
          {formatDate(task.deadline)}
          {isOverdue && <span className="ml-1 font-black text-[10px] uppercase tracking-tighter">(Overdue)</span>}
        </div>
      </td>

      <td className="p-4">
        <span className="bg-white/5 text-slate-400 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-white/5">
          {task.category}
        </span>
      </td>

      {showCreator && (
        <td className="p-4">
          {task.creatorName ? (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-blue-400">{task.creatorName}</span>
              <span className="text-[10px] text-slate-500 font-medium">{task.creatorSubject}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-600 italic">Me</span>
          )}
        </td>
      )}

      <td className="p-4 w-12 text-right" onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-rose-400 transition-all"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </motion.tr>
  );
};

const CreatorInfo = ({ createdBy, denormalizedName, denormalizedSubject, variant = 'card' }: { createdBy?: string, denormalizedName?: string, denormalizedSubject?: string, variant?: 'card' | 'modal-name' | 'modal-subject' }) => {
  const [info, setInfo] = useState<{ name: string, subject: string } | null>(
    denormalizedName ? { name: denormalizedName, subject: denormalizedSubject || 'General' } : null
  );

  useEffect(() => {
    if (info || !createdBy || createdBy === 'system') return;

    const fetchInfo = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', createdBy));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setInfo({ name: data.name || 'Faculty', subject: data.subject || 'General' });
        }
      } catch (err) {
        console.error("Failed to fetch creator info:", err);
      }
    };

    fetchInfo();
  }, [createdBy, info]);

  if (!info && !createdBy) return null;
  if (!info) return <span className="inline-block animate-pulse bg-white/10 h-4 w-24 rounded align-middle" />;

  if (variant === 'modal-subject') {
    return (
      <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 shrink-0">
          <BookOpen size={24} />
        </div>
        <div>
          <p className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest mb-1">Subject</p>
          <p className="text-base font-bold text-blue-300">{info.subject}</p>
        </div>
      </div>
    );
  }

  if (variant === 'modal-name') {
    return <>{info.name}</>;
  }

  return (
    <div className="mb-3 p-2 bg-white/5 rounded-xl border border-white/5">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Assigned By</p>
      <p className="text-xs font-bold text-blue-400">{info.name} <span className="text-slate-500 font-medium">• {info.subject}</span></p>
    </div>
  );
};

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
          
          {task.userId === 'section-task' && (
            <CreatorInfo 
              createdBy={task.createdBy} 
              denormalizedName={task.creatorName} 
              denormalizedSubject={task.creatorSubject} 
            />
          )}

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
          <h1 className="text-3xl font-display font-bold text-slate-100">UniPlanner</h1>
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
            <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
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
  const [activeTab, setActiveTab] = useState<'tasks' | 'students'>('tasks');
  const [students, setStudents] = useState<User[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempSections, setTempSections] = useState<string[]>([]);
  const [tempSubject, setTempSubject] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const addAppNotification = async (title: string, body: string, type: AppNotification['type'] = 'reminder', userEmail?: string, userId?: string) => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      body,
      timestamp: new Date().toISOString(),
      read: false,
      type
    };
    setAppNotifications(prev => [newNotif, ...prev].slice(0, 20));
    
    toast(title, {
      description: body,
      duration: 5000,
      className: cn(
        'glass-toast',
        type === 'success' ? 'border-l-4 border-l-emerald-500' : 
        type === 'system' ? 'border-l-4 border-l-amber-500' : 
        'border-l-4 border-l-blue-500'
      ),
      descriptionClassName: 'glass-toast-description',
      icon: type === 'success' ? <CheckCircle2 className="text-emerald-400" size={18} /> : 
            type === 'system' ? <AlertCircle className="text-amber-400" size={18} /> : 
            <Clock className="text-blue-400" size={18} />,
    });
    
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { 
          body, 
          icon: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
          badge: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png"
        });
      } catch (e) {
        console.warn("Browser notification failed:", e);
      }
    }

    if (userId && notificationsEnabled) {
      try {
        await axios.post('/api/send-push', { userId, title, body });
      } catch (err: any) {
        console.error("Failed to send push notification:", err.message);
      }
    }

    if (userEmail && notificationsEnabled) {
      try {
        await axios.post('/api/send-email', {
          to: userEmail,
          subject: `[UniPlanner Reminder] ${title}`,
          text: body,
          html: `
            <div style="font-family: sans-serif; padding: 30px; color: #1e293b; background-color: #f8fafc; border-radius: 16px;">
              <div style="background-color: #2563eb; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">UniPlanner Reminder</h1>
              </div>
              <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
                <h2 style="color: #1e293b; margin-top: 0;">${title}</h2>
                <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 16px; line-height: 1.6;">${body}</p>
                </div>
                <p style="font-size: 14px; color: #64748b;">
                  Don't forget to check your dashboard for more details.
                </p>
              </div>
            </div>
          `
        });
      } catch (err) {
        console.error("Failed to send email notification:", err);
      }
    }
  };

  const testNotification = async () => {
    addAppNotification("Test Notification", "This is a test of the notification system!", "success", user?.email, user?.id);
    
    // Explicit feedback for email test
    if (user?.email) {
      toast.promise(
        axios.post('/api/send-email', {
          to: user.email,
          subject: "[UniPlanner] Email Test",
          text: "If you are reading this, your custom email sender is working perfectly!"
        }),
        {
          loading: 'Sending test email...',
          success: 'Test email sent to your inbox!',
          error: (err: any) => err.response?.data?.error || 'Email failed. Check your SMTP secrets.',
        }
      );
    }
  };

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    deadline: '',
    category: '',
    targetSections: [] as string[]
  });

  useEffect(() => {
    if (!user || !user.onboarded) return;

    // FCM Setup
    const setupFCM = async () => {
      if (!messaging) return;
      
      try {
        const permission = await Notification.permission;
        if (permission === 'default') {
          await Notification.requestPermission();
        }
        
        if (Notification.permission === 'granted') {
          const token = await getToken(messaging, {
            vapidKey: 'BPIy_W-X-Y-Z-EXAMPLE-VAPID-KEY' 
          });
          
          if (token) {
            await updateDoc(doc(db, 'users', user.id), {
              fcmTokens: arrayUnion(token)
            });
          }
        }
      } catch (err) {
        console.error("FCM Setup failed:", err);
      }
    };

    setupFCM();

    // Foreground Message Handler
    if (messaging) {
      onMessage(messaging, (payload) => {
        if (payload.notification) {
          const { title, body } = payload.notification;
          addAppNotification(title || 'Notification', body || '', 'reminder');
          if (Notification.permission === 'granted') {
            new Notification(title || 'Task Reminder', {
              body: body || '',
              icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
              badge: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
              tag: 'task-reminder'
            });
          }
        }
      });
    }

    // Fetch tasks based on role and section
    let q;
    if (user.role === 'faculty') {
      // Faculty see tasks they created
      q = query(
        collection(db, 'tasks'),
        where('createdBy', '==', user.id)
      );
    } else {
      // Students see:
      // 1. Their own personal tasks (userId == user.id)
      // 2. Faculty tasks for their sections (userId == 'section-task' AND targetSections contains section)
      const sections = user.sections || [];
      if (sections.length === 0) {
        q = query(
          collection(db, 'tasks'),
          where('userId', '==', user.id)
        );
      } else {
        q = query(
          collection(db, 'tasks'),
          or(
            where('userId', '==', user.id),
            and(
              where('userId', '==', 'section-task'),
              where('targetSections', 'array-contains-any', sections)
            )
          )
        );
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Task))
        .filter(t => !t.hiddenBy?.includes(user?.id || ''))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setTasks(taskList);
      
      const total = taskList.length;
      const completed = taskList.filter(t => t.completed).length;
      const pending = total - completed;
      setStats({ total, completed, pending });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks-main');
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Fetch students for faculty
  useEffect(() => {
    if (!user || !user.onboarded || user.role !== 'faculty' || activeTab !== 'students') return;

    const sections = user.sections || [];
    if (sections.length === 0) {
      setStudents([]);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('sections', 'array-contains-any', sections)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [user, activeTab]);

  const handleToggle = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await updateDoc(doc(db, 'tasks', id), { completed: !task.completed });
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    try {
      if (user.role === 'student' && task.userId === 'section-task') {
        // Soft delete for students on faculty tasks: only hide for them
        await updateDoc(doc(db, 'tasks', id), {
          hiddenBy: arrayUnion(user.id)
        });
        toast.success("Task hidden from your list");
      } else {
        // Hard delete for personal tasks or faculty deleting tasks
        await deleteDoc(doc(db, 'tasks', id));
        toast.success("Task deleted successfully");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tasks');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newTask.title.trim()) {
      toast.warning("Please enter a task title.");
      return;
    }
    if (!newTask.deadline) {
      toast.warning("Please select a deadline.");
      return;
    }
    if (user.role === 'faculty' && newTask.targetSections.length === 0) {
      toast.warning("Please select at least one section.");
      return;
    }
    
    const category = newTask.category || suggestCategory(newTask.title, newTask.description);
    
    try {
      const deadlineISO = new Date(newTask.deadline).toISOString();
      
      await addDoc(collection(db, 'tasks'), {
        title: newTask.title,
        description: newTask.description,
        deadline: deadlineISO,
        category,
        completed: false,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        creatorName: user.name || '',
        creatorSubject: user.subject || '',
        userId: user.role === 'student' ? user.id : 'section-task',
        targetSections: user.role === 'faculty' ? newTask.targetSections : user.sections,
        remindersSent: []
      });

      setNewTask({ title: '', description: '', deadline: '', category: '', targetSections: [] });
      setIsAdding(false);
      toast.success("Task created successfully!");
    } catch (err: any) {
      console.error("Error adding task:", err);
      toast.error(`Failed to add task: ${err.message}`);
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to add tasks.");
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
              createdBy: user.id,
              creatorName: user.name || '',
              creatorSubject: user.subject || '',
              targetSections: user.sections || [],
              completed: false,
              createdAt: new Date().toISOString(),
              remindersSent: []
            });
        }
      }
    }

    if (parsedTasks.length === 0) {
      toast.warning("No valid tasks found in the text. Please check the format.");
      return;
    }

    try {
      await Promise.all(parsedTasks.map(t => addDoc(collection(db, 'tasks'), t)));
      setBulkText('');
      setIsBulkAdding(false);
    } catch (err: any) {
      console.error("Bulk add failed:", err);
      toast.error(`Some tasks failed to add: ${err.message || 'Unknown error'}`);
    }
  };

  const handleUpdateSections = async () => {
    if (!user) return;
    if (tempSections.length === 0) {
      toast.warning("Please select at least one section.");
      return;
    }
    if (user.role === 'faculty' && !tempSubject.trim()) {
      toast.warning("Please enter the subject you teach.");
      return;
    }
    try {
      const updateData: any = {
        sections: tempSections
      };
      
      if (user.role === 'faculty') {
        updateData.subject = tempSubject.trim();
      }

      await updateDoc(doc(db, 'users', user.id), updateData);
      setIsSettingsOpen(false);
      toast.success("Settings updated successfully!");
      // The user state will update via the onAuthStateChanged listener in AuthProvider
    } catch (err: any) {
      console.error("Update settings failed:", err);
      toast.error("Failed to update settings.");
    }
  };

  const filteredTasks = tasks
    .filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    .filter(t => filter === 'All' ? true : t.category === filter)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  const facultyTasks = filteredTasks.filter(t => t.userId === 'section-task');
  const myTasks = filteredTasks.filter(t => t.userId === user?.id);
  const displayFacultyTasks = user?.role === 'student' ? facultyTasks : facultyTasks.filter(t => t.createdBy === user?.id);

  const categories = ['All', ...Array.from(new Set(tasks.map(t => t.category)))];

  return (
    <div className="min-h-screen">
      {user && !user.onboarded && <Onboarding />}
      
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-32">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-display font-black text-slate-100 mb-2">
              Hey {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              {user?.role === 'faculty' ? 'Faculty Portal' : 'Student Dashboard'} • Section {user?.sections?.join(', ')}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {user?.role === 'faculty' && (
              <div className="flex glass rounded-2xl p-1">
                <button 
                  onClick={() => setActiveTab('tasks')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    activeTab === 'tasks' ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Tasks
                </button>
                <button 
                  onClick={() => setActiveTab('students')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    activeTab === 'students' ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Students
                </button>
              </div>
            )}
            {user?.role === 'student' && (
              <button 
                onClick={() => setIsBulkAdding(true)}
                className="glass px-4 py-4 rounded-2xl text-slate-400 hover:text-white transition-all flex items-center gap-2 font-bold"
                title="Bulk Add Tasks"
              >
                <CopyPlus size={20} />
                <span className="hidden sm:inline">Bulk Add</span>
              </button>
            )}
            <button 
              onClick={() => {
                setTempSections(user?.sections || []);
                setTempSubject(user?.subject || '');
                setIsSettingsOpen(true);
              }}
              className="glass p-4 rounded-2xl text-slate-400 hover:text-white transition-all"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-blue-600 hover:bg-blue-500 p-4 rounded-2xl text-white transition-all shadow-xl shadow-blue-600/20 flex items-center gap-2 font-bold"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Add Task</span>
            </button>
          </div>
        </header>

        {activeTab === 'tasks' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <StatCard label="Total Tasks" value={stats.total} color="text-blue-400" />
              <StatCard label="Completed" value={stats.completed} color="text-emerald-400" />
              <StatCard label="Pending" value={stats.pending} color="text-amber-400" />
            </div>

            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-display font-bold text-slate-100">Your Tasks</h2>
                <div className="flex items-center gap-4">
                  {user?.role === 'student' && (
                    <button 
                      onClick={testNotification}
                      className="glass p-3 rounded-xl text-slate-400 hover:text-white transition-all"
                      title="Test Notification"
                    >
                      <Bell size={18} />
                    </button>
                  )}
                  <div className="relative w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search tasks..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 pl-12 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-12">
                {/* Faculty Assigned / Section Tasks Section */}
                {((user?.role === 'student' && facultyTasks.length > 0) || (user?.role === 'faculty' && displayFacultyTasks.length > 0)) && (
                  <div>
                    <h3 className="text-lg font-display font-bold text-blue-400 mb-6 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      {user?.role === 'student' ? 'Faculty Assigned' : 'Tasks Assigned to Sections'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <AnimatePresence mode="popLayout">
                        {displayFacultyTasks.map((task) => (
                          <div key={task.id} onClick={() => setSelectedTask(task)} className="cursor-pointer">
                            <TaskCard 
                              task={task} 
                              onToggle={handleToggle}
                              onDelete={handleDelete}
                            />
                          </div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* My Tasks Section */}
                <div>
                  <h3 className="text-lg font-display font-bold text-emerald-400 mb-6 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    {user?.role === 'student' ? 'My Personal Tasks' : 'Tasks I Created'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {myTasks.map((task) => (
                        <div key={task.id} onClick={() => setSelectedTask(task)} className="cursor-pointer">
                          <TaskCard 
                            task={task} 
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                          />
                        </div>
                      ))}
                    </AnimatePresence>
                    {myTasks.length === 0 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full glass p-12 rounded-[2.5rem] text-center border-dashed border-white/10"
                      >
                        <ListTodo className="mx-auto text-slate-800 mb-4" size={48} />
                        <p className="text-slate-500 font-display italic">No personal tasks found.</p>
                      </motion.div>
                    )}
                  </div>
                </div>

                {filteredTasks.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full glass p-12 rounded-[2.5rem] text-center border-dashed border-white/10"
                  >
                    <ListTodo className="mx-auto text-slate-800 mb-4" size={48} />
                    <p className="text-slate-500 font-display italic">No tasks found. Time to relax!</p>
                  </motion.div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-8">
            <h2 className="text-2xl font-display font-bold text-slate-100">Students in Your Sections</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map(student => (
                <motion.div 
                  key={student.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass p-6 rounded-2xl flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400">
                    <UserIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100">{student.name}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Section {student.sections?.join(', ')}</p>
                    <p className="text-[10px] text-slate-600">{student.email}</p>
                  </div>
                </motion.div>
              ))}
              {students.length === 0 && (
                <div className="col-span-full text-center p-12 glass rounded-3xl">
                  <p className="text-slate-500 italic">No students found in your sections.</p>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 py-10 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass w-full max-w-md rounded-[2.5rem] p-10 relative z-10 my-auto border-white/20"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-display font-black text-slate-100">Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                {user?.role === 'faculty' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">What do you teach?</label>
                    <input 
                      type="text"
                      value={tempSubject}
                      onChange={(e) => setTempSubject(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="e.g. Mathematics"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Select Sections</label>
                  <div className="grid grid-cols-2 gap-4">
                    {['A', 'B', 'C', 'D'].map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          if (user?.role === 'student') {
                            setTempSections([s]);
                          } else {
                            if (tempSections.includes(s)) {
                              setTempSections(prev => prev.filter(x => x !== s));
                            } else {
                              setTempSections(prev => [...prev, s]);
                            }
                          }
                        }}
                        className={cn(
                          "p-4 rounded-2xl border transition-all font-bold",
                          tempSections.includes(s) ? "bg-blue-600 border-blue-500 text-white" : "bg-white/5 border-white/10 text-slate-400"
                        )}
                      >
                        Section {s}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleUpdateSections}
                  className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black text-white transition-all shadow-xl shadow-blue-600/20 uppercase tracking-widest text-sm"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Details Modal */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 py-10 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass w-full max-w-lg rounded-[2.5rem] p-10 relative z-10 my-auto border-white/20"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    selectedTask.completed ? "bg-emerald-500" : "bg-blue-500"
                  )} />
                  <h2 className="text-2xl font-display font-black text-slate-100">Task Details</h2>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Title</label>
                  <h3 className="text-2xl font-bold text-slate-100 mt-1">{selectedTask.title}</h3>
                </div>

                {selectedTask.description && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Description</label>
                    <p className="text-slate-400 mt-2 leading-relaxed">{selectedTask.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Deadline</label>
                    <div className="flex items-center gap-2 mt-2 text-slate-200">
                      <Clock size={16} className="text-blue-400" />
                      <span className="font-medium">{new Date(selectedTask.deadline).toLocaleString()}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Category</label>
                    <div className="flex items-center gap-2 mt-2 text-slate-200">
                      <Filter size={16} className="text-emerald-400" />
                      <span className="font-medium">{selectedTask.category}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          {selectedTask.userId === 'section-task' ? 'Assigned By' : 'Personal Task'}
                        </p>
                        <div className="text-sm font-bold text-slate-300">
                          {selectedTask.userId === 'section-task' ? (
                            <CreatorInfo 
                              createdBy={selectedTask.createdBy} 
                              denormalizedName={selectedTask.creatorName} 
                              variant="modal-name" 
                            />
                          ) : 'Me'}
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest",
                      selectedTask.completed ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-400"
                    )}>
                      {selectedTask.completed ? 'Completed' : 'In Progress'}
                    </div>
                  </div>

                  {selectedTask.userId === 'section-task' && (
                    <div className="grid grid-cols-1 gap-4">
                      <CreatorInfo 
                        createdBy={selectedTask.createdBy} 
                        denormalizedName={selectedTask.creatorName} 
                        denormalizedSubject={selectedTask.creatorSubject} 
                        variant="modal-subject" 
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
                          value={newTask.deadline}
                          onChange={(e) => setNewTask({...newTask, deadline: e.target.value})}
                        />
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

                  {user?.role === 'faculty' && (
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Target Sections</label>
                      <div className="grid grid-cols-4 gap-3">
                        {user.sections?.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              const current = newTask.targetSections;
                              if (current.includes(s)) {
                                setNewTask({...newTask, targetSections: current.filter(x => x !== s)});
                              } else {
                                setNewTask({...newTask, targetSections: [...current, s]});
                              }
                            }}
                            className={cn(
                              "p-4 rounded-2xl border transition-all font-bold",
                              newTask.targetSections.includes(s) ? "bg-blue-600 border-blue-500 text-white" : "bg-white/5 border-white/10 text-slate-400"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
  </div>
  );
};

const CalendarView = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (!user || !user.onboarded) return;
    
    let q;
    if (user.role === 'faculty') {
      q = query(collection(db, 'tasks'), where('createdBy', '==', user.id));
    } else {
      const sections = user.sections || [];
      if (sections.length === 0) {
        setTasks([]);
        return;
      }
      q = query(
        collection(db, 'tasks'), 
        or(
          where('userId', '==', user.id),
          and(
            where('userId', '==', 'section-task'),
            where('targetSections', 'array-contains-any', sections)
          )
        )
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Task))
        .filter(t => !t.hiddenBy?.includes(user?.id || ''))
      );
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks-calendar');
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
      <Toaster 
        position="top-right" 
        expand={true}
        visibleToasts={3}
        closeButton
        toastOptions={{
          className: 'glass-toast',
          descriptionClassName: 'glass-toast-description',
        }}
      />
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
