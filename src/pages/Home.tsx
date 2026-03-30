import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar as CalendarIcon, ArrowRight, QrCode, Trash2, Upload, Search, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { createEvent, deleteEvent, listEventsByCreator, recordActivity, setEventDriveFolder } from '../lib/store';
import { createDriveFolderForEvent, deleteDriveFolderWithContents } from '../lib/googleDrive';

export function Home() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }
    setEvents(listEventsByCreator(user.uid));
  }, [user]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to create an event');
      login();
      return;
    }
    if (!eventName.trim()) return;

    try {
      const created = createEvent({
        name: eventName.trim(),
        createdBy: user.uid,
        creatorName: user.displayName,
      });
      recordActivity({
        userId: user.uid,
        type: 'create_event',
        description: `Created event "${eventName.trim()}"`,
        eventId: created.id,
      });

      try {
        const driveFolder = await createDriveFolderForEvent(created.name);
        setEventDriveFolder(created.id, {
          driveFolderId: driveFolder.id,
          driveFolderLink: driveFolder.webViewLink,
        });
        toast.success('Google Drive folder created for this event');
      } catch (driveError) {
        console.error('Drive folder creation error:', driveError);
        toast.info('Event created without Drive folder. Check Google permissions.');
      }

      toast.success('Event created successfully!');
      setEventName('');
      setIsCreating(false);
      setEvents(listEventsByCreator(user.uid));
      navigate(`/event/${created.id}`);
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    }
  };

  const handleDeleteEvent = async (e: React.MouseEvent, eventId: string, createdBy: string, driveFolderId?: string) => {
    e.stopPropagation();
    if (user?.uid !== createdBy) {
      toast.error('Only the creator can delete this event');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this event and all its photos?')) return;

    try {
      if (driveFolderId) {
        try {
          await deleteDriveFolderWithContents(driveFolderId);
        } catch (error) {
          console.error('Drive folder delete error:', error);
        }
      }

      deleteEvent(eventId);
      if (user) {
        setEvents(listEventsByCreator(user.uid));
      } else {
        setEvents([]);
      }
      toast.success('Event deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete event');
    }
  };

  return (
    <div className="w-full space-y-8 sm:space-y-12">
      <section className="text-center space-y-4 py-8 sm:py-12">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
        >
          Share Event Photos <span className="text-orange-500">Instantly</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-base sm:text-xl text-neutral-500 max-w-2xl mx-auto"
        >
          Create an event, share the QR code, and let everyone find their photos using AI face search.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="pt-8"
        >
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="px-8 py-4 bg-black text-white rounded-full font-bold text-lg hover:bg-neutral-800 transition-all flex items-center gap-2 mx-auto shadow-xl hover:shadow-2xl active:scale-95"
            >
              <Plus className="w-6 h-6" />
              Create New Event
            </button>
          ) : (
            <form onSubmit={handleCreateEvent} className="max-w-md mx-auto flex flex-col sm:flex-row gap-2">
              <input
                autoFocus
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Enter event name..."
                className="flex-1 px-6 py-4 rounded-full border-2 border-neutral-200 focus:border-orange-500 outline-none transition-colors"
                required
              />
              <button
                type="submit"
                className="px-8 py-4 bg-orange-500 text-white rounded-full font-bold hover:bg-orange-600 transition-colors shadow-lg whitespace-nowrap"
              >
                Create
              </button>
            </form>
          )}
        </motion.div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-orange-500" />
            Recent Events
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { title: 'Create Event', desc: 'Start a new workspace for your occasion.', icon: CalendarIcon },
            { title: 'Upload Photos', desc: 'Photographers and guests add images.', icon: Upload },
            { title: 'Face Search', desc: 'Guests quickly find their moments.', icon: Search },
            { title: 'Manage Settings', desc: 'Control access and sharing options.', icon: Settings },
          ].map((step, idx) => (
            <div key={step.title} className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <step.icon className="w-5 h-5 text-orange-500 mt-0.5" />
                <span className="text-xs font-bold text-neutral-400">0{idx + 1}</span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-neutral-900">{step.title}</h3>
              <p className="mt-1 text-xs text-neutral-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="group bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
              onClick={() => navigate(`/event/${event.id}`)}
            >
              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-orange-50 rounded-2xl">
                    <QrCode className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.uid === event.createdBy && (
                      <button
                        onClick={(e) => handleDeleteEvent(e, event.id, event.createdBy, event.driveFolderId)}
                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
                      {event.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold group-hover:text-orange-500 transition-colors">
                    {event.name}
                  </h3>
                  <p className="text-sm text-neutral-500">
                    Created by {event.creatorName || 'Anonymous'}
                  </p>
                </div>
                <div className="flex items-center text-orange-500 font-bold text-sm gap-1 group-hover:gap-2 transition-all">
                  View Gallery <ArrowRight className="w-4 h-4" />
                </div>
              </div>
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-orange-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
          {events.length === 0 && (
            <div className="col-span-full py-12 text-center text-neutral-400 border-2 border-dashed border-neutral-100 rounded-3xl">
              No events found. Create one to get started!
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
