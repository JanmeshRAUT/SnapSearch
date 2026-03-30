import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Save, Trash2, Shield, Globe, Lock, Settings, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { deleteEvent, getEvent, updateEvent } from '../lib/store';
import { EventFlowNav } from '../components/EventFlowNav';
import { deleteDriveFolderWithContents } from '../lib/googleDrive';

export function EventSettings() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      const foundEvent = getEvent(eventId);
      if (foundEvent) {
        if (foundEvent.createdBy !== user?.uid) {
          toast.error('Only the event creator can access settings');
          navigate(`/event/${eventId}`);
          return;
        }
        setEvent(foundEvent);
        setName(foundEvent.name);
        setIsPublic(foundEvent.isPublic !== false);
      } else {
        toast.error('Event not found');
        navigate('/');
      }
      setLoading(false);
    };

    fetchEvent();
  }, [eventId, user, navigate]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Event name is required');
      return;
    }

    setSaving(true);
    try {
      updateEvent(eventId!, {
        name: name.trim(),
        isPublic,
      });
      toast.success('Settings updated');
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!window.confirm('Are you sure you want to delete this entire event? This will remove all photos and cannot be undone.')) return;

    setDeleting(true);
    try {
      if (event?.driveFolderId) {
        try {
          await deleteDriveFolderWithContents(event.driveFolderId);
        } catch (error) {
          console.error('Drive folder delete error:', error);
        }
      }

      deleteEvent(eventId!);
      toast.success('Event deleted');
      navigate('/');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete event');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-24 sm:pb-32">
      <EventFlowNav eventName={event?.name} />

      <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm space-y-1">
        <Link to={`/event/${eventId}`} className="text-sm text-neutral-500 hover:text-orange-500 flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Gallery
        </Link>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-3">
          <Settings className="w-10 h-10 text-orange-500" />
          Event Settings
        </h1>
        <p className="text-neutral-500">Manage your event details and privacy settings.</p>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-8 space-y-8">
          {/* Basic Info */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-neutral-400" />
              General Information
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-600 ml-1">Event Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter event name"
                className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none font-medium"
              />
            </div>
          </section>

          {/* Privacy */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Globe className="w-5 h-5 text-neutral-400" />
              Privacy & Access
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setIsPublic(true)}
                className={`p-6 rounded-3xl border-2 transition-all text-left space-y-2 ${
                  isPublic ? 'border-orange-500 bg-orange-50/50' : 'border-neutral-100 bg-neutral-50 hover:border-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Globe className={`w-6 h-6 ${isPublic ? 'text-orange-500' : 'text-neutral-400'}`} />
                  {isPublic && <div className="w-3 h-3 bg-orange-500 rounded-full" />}
                </div>
                <div>
                  <p className="font-bold">Public Gallery</p>
                  <p className="text-xs text-neutral-500">Anyone with the link or QR code can view and upload photos.</p>
                </div>
              </button>

              <button
                onClick={() => setIsPublic(false)}
                className={`p-6 rounded-3xl border-2 transition-all text-left space-y-2 ${
                  !isPublic ? 'border-orange-500 bg-orange-50/50' : 'border-neutral-100 bg-neutral-50 hover:border-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Lock className={`w-6 h-6 ${!isPublic ? 'text-orange-500' : 'text-neutral-400'}`} />
                  {!isPublic && <div className="w-3 h-3 bg-orange-500 rounded-full" />}
                </div>
                <div>
                  <p className="font-bold">Private Gallery</p>
                  <p className="text-xs text-neutral-500">Only secure QR/share links can access this gallery.</p>
                </div>
              </button>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="pt-8 border-t border-neutral-50 space-y-4">
            <h3 className="text-lg font-bold text-red-500 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Danger Zone
            </h3>
            <div className="p-6 bg-red-50 rounded-3xl border border-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-red-900">Delete Event</p>
                <p className="text-sm text-red-700/70">Permanently remove this event and all its photos.</p>
              </div>
              <button
                onClick={handleDeleteEvent}
                disabled={deleting}
                className="px-6 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200 active:scale-95 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </section>
        </div>

        <div className="p-5 sm:p-8 bg-neutral-50 border-t border-neutral-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-10 py-4 bg-black text-white rounded-full font-bold hover:bg-neutral-800 transition-all shadow-xl active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
