import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Save, Trash2, Shield, Globe, Lock, Settings, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { deleteEvent, getEventFromAnySource, normalizeEmail, updateEvent } from '../lib/store';
import { EventFlowNav } from '../components/EventFlowNav';
import { deleteDriveFolderWithContents } from '../lib/googleDrive';
import { createSecureClientDashboardUrl, getPublicAppBaseUrl } from '../lib/shareAccess';

export function EventSettings() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingShareUrl, setCreatingShareUrl] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const publicBaseUrl = getPublicAppBaseUrl();
  const usingLocalhostBase = /localhost|127\.0\.0\.1/i.test(publicBaseUrl);
  
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [allowedEmailsInput, setAllowedEmailsInput] = useState('');

  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      const foundEvent = await getEventFromAnySource(eventId);
      if (foundEvent) {
        if (foundEvent.createdBy !== user?.uid) {
          toast.error('Only the event creator can access settings');
          navigate(`/event/${eventId}`);
          return;
        }
        setEvent(foundEvent);
        setName(foundEvent.name);
        setIsPublic(foundEvent.isPublic !== false);
        setAllowedEmailsInput((foundEvent.allowedEmails || []).join(', '));
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

    const parsedAllowedEmails: string[] = Array.from(
      new Set(
        allowedEmailsInput
          .split(/[\n,;]/)
          .map((entry) => normalizeEmail(entry))
          .filter(Boolean),
      ),
    );

    const invalidEmails = parsedAllowedEmails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalidEmails.length > 0) {
      toast.error(`Invalid email: ${invalidEmails[0]}`);
      return;
    }

    setSaving(true);
    try {
      const updated = updateEvent(eventId!, {
        name: name.trim(),
        isPublic,
        allowedEmails: parsedAllowedEmails,
      });

      if (updated) {
        setEvent(updated);
      }
      toast.success('Settings updated');
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateShareLink = async (rotate = false) => {
    if (!eventId) return;

    setCreatingShareUrl(true);
    try {
      const url = await createSecureClientDashboardUrl(eventId, { rotate });
      setShareUrl(url);
      if (rotate) {
        toast.success('Secure link regenerated. Previous link has been revoked.');
      } else {
        toast.success('Secure link is ready to share.');
      }
    } catch (error) {
      console.error('Generate share link error:', error);
      toast.error('Failed to generate secure link');
    } finally {
      setCreatingShareUrl(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) {
      toast.info('Generate a secure link first.');
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Secure link copied to clipboard');
    } catch (error) {
      console.error('Copy link error:', error);
      toast.error('Unable to copy link. Please copy manually.');
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
    <div className="w-full space-y-6 sm:space-y-8 pb-24 sm:pb-32">
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
                  <p className="text-xs text-neutral-500">Only granted Gmail accounts can access this gallery.</p>
                </div>
              </button>
            </div>

            {!isPublic && (
              <div className="rounded-3xl border border-neutral-200 bg-white p-5 space-y-3">
                <p className="text-sm font-semibold text-neutral-700">Allowed Gmail Accounts</p>
                <p className="text-xs text-neutral-500">
                  Add one or more emails separated by comma or new line. Only these Google accounts can open this private event.
                </p>
                <textarea
                  value={allowedEmailsInput}
                  onChange={(e) => setAllowedEmailsInput(e.target.value)}
                  rows={4}
                  placeholder="person1@gmail.com, person2@gmail.com"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none text-sm"
                />
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-neutral-400" />
              Share Access
            </h3>

            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 space-y-4">
              <p className="text-sm text-neutral-600">
                {isPublic
                  ? 'Public event: anyone can access with the event link. You can still share a secure client link if needed.'
                  : 'Private event: guests must sign in with a granted Gmail and then open this QR/link.'}
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleGenerateShareLink(false)}
                  disabled={creatingShareUrl}
                  className="px-5 py-3 bg-black text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50"
                >
                  {creatingShareUrl ? 'Generating...' : 'Generate Secure Link'}
                </button>
                <button
                  onClick={handleCopyLink}
                  disabled={!shareUrl}
                  className="px-5 py-3 bg-white border border-neutral-200 rounded-2xl font-bold hover:bg-neutral-100 transition-all disabled:opacity-50"
                >
                  Copy Link
                </button>
                <button
                  onClick={() => handleGenerateShareLink(true)}
                  disabled={creatingShareUrl}
                  className="px-5 py-3 bg-orange-50 text-orange-600 border border-orange-200 rounded-2xl font-bold hover:bg-orange-100 transition-all disabled:opacity-50"
                >
                  Regenerate Link
                </button>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-neutral-200 text-xs font-mono break-all text-neutral-500">
                {shareUrl || 'No secure link generated yet.'}
              </div>

              <div className="p-3 bg-white rounded-2xl border border-neutral-200 text-xs text-neutral-500 space-y-1">
                <p className="font-semibold text-neutral-700">Current Share Base URL</p>
                <p className="font-mono break-all">{publicBaseUrl}</p>
                {usingLocalhostBase && (
                  <p className="text-amber-700">
                    This URL uses localhost and works only on this machine. For sharing to other people/devices, set VITE_PUBLIC_APP_URL to your public domain.
                  </p>
                )}
              </div>
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
