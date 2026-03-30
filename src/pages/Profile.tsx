import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Grid, ArrowRight, LogOut, Settings, Shield, UserCheck, Loader2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { listEventsByCreator } from '../lib/store';

export function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  const [updating, setUpdating] = useState(false);
  const memberSince = user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Unknown';
  const totalEvents = myEvents.length;
  const publicEvents = myEvents.filter((event) => event.isPublic !== false).length;

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchMyEvents = async () => {
      try {
        setMyEvents(listEventsByCreator(user.uid));
      } catch (error) {
        console.error('Fetch events error:', error);
        toast.error('Failed to load your events');
      } finally {
        setLoading(false);
      }
    };

    fetchMyEvents();
  }, [user, navigate]);

  const handleUpdateProfile = async () => {
    if (!newName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setUpdating(true);
    try {
      await updateProfile(newName.trim());
      toast.success('Profile updated');
      setIsEditing(false);
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  if (!user) return null;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 sm:space-y-10 pb-24 sm:pb-32">
      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-[2rem] border border-orange-200 bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 p-5 sm:p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_45%)]" />
        <div className="relative grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr_auto] md:items-end">
          <div className="relative group w-fit">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || ''} 
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 border-white/80 shadow-2xl object-cover"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 border-white/80 bg-white/90 flex items-center justify-center shadow-2xl">
                <User className="w-10 h-10 text-neutral-300" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/35 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="space-y-2 md:pb-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-100">Personal Workspace</p>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md break-words">
              {user.displayName || 'Anonymous User'}
            </h1>
            <p className="text-white/90 text-sm sm:text-base font-medium flex items-center gap-2 break-all">
              <Mail className="w-4 h-4" /> {user.email}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:w-[290px]">
            <div className="rounded-2xl bg-white/20 backdrop-blur-sm p-3 text-white border border-white/20">
              <p className="text-[10px] uppercase tracking-[0.14em] text-orange-100">Total Events</p>
              <p className="text-2xl font-extrabold leading-tight">{totalEvents}</p>
            </div>
            <div className="rounded-2xl bg-white/20 backdrop-blur-sm p-3 text-white border border-white/20">
              <p className="text-[10px] uppercase tracking-[0.14em] text-orange-100">Public Events</p>
              <p className="text-2xl font-extrabold leading-tight">{publicEvents}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200 shadow-sm space-y-7">
            <h3 className="font-bold text-lg sm:text-xl flex items-center gap-2">
              <Shield className="w-6 h-6 text-orange-500" />
              Account Details
            </h3>
            
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 p-4 bg-neutral-50/60">
                <div className="p-2.5 bg-white rounded-xl border border-neutral-100">
                  <UserCheck className="w-5 h-5 text-neutral-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">User ID</p>
                  <p className="text-sm font-mono text-neutral-600 truncate">{user.uid}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-neutral-100 p-4 bg-neutral-50/60">
                <div className="p-2.5 bg-white rounded-xl border border-neutral-100">
                  <Calendar className="w-5 h-5 text-neutral-400" />
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Member Since</p>
                  <p className="text-sm font-medium text-neutral-600">{memberSince}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 space-y-3">
              <button
                onClick={() => setIsEditing(true)}
                className="w-full py-3.5 bg-neutral-900 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all"
              >
                <Settings className="w-5 h-5" /> Edit Profile
              </button>
              <button
                onClick={logout}
                className="w-full py-3.5 bg-red-50 text-red-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition-all"
              >
                <LogOut className="w-5 h-5" /> Logout
              </button>
            </div>
          </div>
        </div>

        {/* Main Content: My Events */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-2xl flex items-center gap-3">
              <Grid className="w-7 h-7 text-orange-500" />
              My Events
            </h3>
            <Link 
              to="/" 
              className="text-orange-500 font-bold text-sm hover:underline flex items-center gap-1"
            >
              Create New <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            </div>
          ) : myEvents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <AnimatePresence>
                {myEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-lg transition-all"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="text-xl font-bold tracking-tight group-hover:text-orange-500 transition-colors">
                            {event.name}
                          </h4>
                          <p className="text-xs text-neutral-400">
                            Created {new Date(event.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          event.isPublic !== false ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {event.isPublic !== false ? 'Public' : 'Private'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-neutral-50">
                        <Link
                          to={`/event/${event.id}`}
                          className="px-6 py-2 bg-neutral-50 text-neutral-600 rounded-xl text-sm font-bold hover:bg-neutral-100 transition-all flex items-center gap-2"
                        >
                          View Gallery
                        </Link>
                        <Link
                          to={`/event/${event.id}/settings`}
                          className="p-2 text-neutral-400 hover:text-orange-500 transition-colors"
                        >
                          <Settings className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="py-24 text-center space-y-6 bg-white rounded-[4rem] border-2 border-dashed border-neutral-100">
              <div className="p-8 bg-neutral-50 w-fit mx-auto rounded-full">
                <Grid className="w-16 h-16 text-neutral-200" />
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-neutral-500 tracking-tight">No events created</p>
                <p className="text-neutral-400 max-w-xs mx-auto text-lg">
                  You haven't created any events yet. Start by creating your first photo gallery!
                </p>
              </div>
              <Link
                to="/"
                className="inline-block px-10 py-4 bg-black text-white rounded-full font-bold hover:bg-neutral-800 transition-all shadow-xl active:scale-95"
              >
                Create Event
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsEditing(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white p-8 rounded-[3rem] max-w-sm w-full space-y-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-2 text-center">
                <h3 className="text-2xl font-bold">Edit Profile</h3>
                <p className="text-neutral-500">Update your public information</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Display Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-full font-bold hover:bg-neutral-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProfile}
                  disabled={updating}
                  className="flex-1 py-4 bg-black text-white rounded-full font-bold hover:bg-neutral-800 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
