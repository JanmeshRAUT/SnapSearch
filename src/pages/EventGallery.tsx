import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { Camera, Search, Share2, Upload, Grid, ArrowLeft, Download, Trash2, Tag, User, Filter, X as CloseIcon, Settings, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { canUserAccessEvent, deletePhoto, deletePhotosBulk, getEventFromAnySource, incrementUserStats, listPhotos, recordActivity, upsertDrivePhotos } from '../lib/store';
import { EventFlowNav } from '../components/EventFlowNav';
import { deleteDriveFile, getDriveImageUrl, listDriveImagesInFolder } from '../lib/googleDrive';
import { createSecureClientDashboardUrl } from '../lib/shareAccess';

export function EventGallery() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [creatingShareUrl, setCreatingShareUrl] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      const foundEvent = await getEventFromAnySource(eventId);
      if (foundEvent) {
        if (!canUserAccessEvent(foundEvent, { uid: user?.uid, email: user?.email })) {
          if (!user) {
            toast.info('Private event: please login with your granted Gmail account.');
            await login();
            return;
          }
          toast.error('Your Gmail does not have access to this private event.');
          navigate('/client');
          return;
        }

        setEvent(foundEvent);
        setPhotos(listPhotos(eventId));
        setLoading(false);
      } else {
        toast.error('Event not found');
        navigate('/');
      }
    };

    fetchEvent();
  }, [eventId, location.search, login, navigate, user?.email, user?.uid]);

  useEffect(() => {
    if (!eventId || !event?.driveFolderId) return;

    const syncDrivePhotos = async () => {
      try {
        const drivePhotos = await listDriveImagesInFolder(event.driveFolderId);
        upsertDrivePhotos(
          eventId,
          drivePhotos.map((item) => ({
            driveFileId: item.id,
            driveFolderId: event.driveFolderId,
            name: item.name,
            url: item.publicUrl,
            uploadedAt: item.createdTime,
          })),
        );
        setPhotos(listPhotos(eventId));
      } catch (error) {
        console.error('Drive sync error:', error);
      }
    };

    syncDrivePhotos();
  }, [eventId, event?.driveFolderId]);

  // Extract unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    photos.forEach(p => {
      if (p.tags && Array.isArray(p.tags)) {
        p.tags.forEach((t: string) => tags.add(t));
      }
    });
    return Array.from(tags).sort();
  }, [photos]);

  // Filter photos
  const filteredPhotos = useMemo(() => {
    if (selectedTags.length === 0) return photos;
    return photos.filter(p => 
      p.tags && Array.isArray(p.tags) && selectedTags.every(t => p.tags.includes(t))
    );
  }, [photos, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => 
      prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedPhotoIds.length === 0) return;
    setDeletingBulk(true);
    
    try {
      const currentPhotos = listPhotos(eventId!);
      const driveIdsToDelete = currentPhotos
        .filter((photo) => selectedPhotoIds.includes(photo.id) && photo.driveFileId)
        .map((photo) => photo.driveFileId as string);

      for (const driveFileId of driveIdsToDelete) {
        try {
          await deleteDriveFile(driveFileId);
        } catch (error) {
          console.error('Drive bulk delete file error:', error);
        }
      }

      deletePhotosBulk(eventId!, selectedPhotoIds);
      setPhotos(listPhotos(eventId!));
      toast.success(`Deleted ${selectedPhotoIds.length} photos`);
      setSelectedPhotoIds([]);
      setIsSelectMode(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete photos');
    } finally {
      setDeletingBulk(false);
    }
  };

  const openShareQr = async () => {
    if (!eventId) return;

    setShowQR(true);
    setCreatingShareUrl(true);

    try {
      const secureUrl = await createSecureClientDashboardUrl(eventId);
      setShareUrl(secureUrl);
    } catch (error) {
      console.error('Create share URL error:', error);
      toast.error('Failed to create secure share link');
      setShowQR(false);
    } finally {
      setCreatingShareUrl(false);
    }
  };

  const handleDownload = async (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `photo-${id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Increment download stat if user is logged in
    if (user) {
      try {
        incrementUserStats(user.uid, { totalDownloads: 1 });

        recordActivity({
          userId: user.uid,
          type: 'download',
          description: `Downloaded a photo from "${event?.name || 'event'}"`,
          eventId: eventId,
          photoId: id
        });
      } catch (error) {
        console.error('Error updating download stats:', error);
      }
    }
  };

  const handleBulkDownload = async () => {
    if (filteredPhotos.length === 0) return;
    setDownloadingAll(true);
    const zip = new JSZip();
    const folder = zip.folder(`${event?.name || 'event'}-photos`);

    const urlToBlob = async (url: string): Promise<Blob> => {
      if (url.startsWith('data:')) {
        const response = await fetch(url);
        return response.blob();
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      return response.blob();
    };

    try {
      for (let i = 0; i < filteredPhotos.length; i++) {
        const photo = filteredPhotos[i];
        try {
          const blob = await urlToBlob(photo.url);
          const ext = blob.type.includes('png') ? 'png' : 'jpg';
          folder?.file(`photo-${photo.id}.${ext}`, blob);
        } catch (error) {
          console.error('Skipped photo during zip build:', photo.id, error);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${event?.name || 'event'}-photos.zip`);
      toast.success('Bulk download started!');
      
      // Increment download stat
      if (user) {
        try {
          incrementUserStats(user.uid, { totalDownloads: filteredPhotos.length });

          recordActivity({
            userId: user.uid,
            type: 'download',
            description: `Bulk downloaded ${filteredPhotos.length} photos from "${event?.name || 'event'}"`,
            eventId: eventId
          });
        } catch (error) {
          console.error('Error updating download stats:', error);
        }
      }
    } catch (error) {
      console.error('Bulk download error:', error);
      toast.error('Failed to create zip file');
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleDelete = async (photoId: string, uploadedBy: string) => {
    const isCreator = user?.uid === event?.createdBy;
    const isPhotographer = user?.uid === uploadedBy;

    if (!isCreator && !isPhotographer) {
      toast.error('You do not have permission to delete this photo');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this photo?')) return;

    try {
      const target = photos.find((photo) => photo.id === photoId);
      if (target?.driveFileId) {
        try {
          await deleteDriveFile(target.driveFileId);
        } catch (error) {
          console.error('Drive delete file error:', error);
        }
      }

      deletePhoto(eventId!, photoId);
      setPhotos(listPhotos(eventId!));
      toast.success('Photo deleted');
      if (selectedPhoto?.id === photoId) setSelectedPhoto(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete photo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-24 sm:pb-32">
      <EventFlowNav eventName={event?.name} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <Link to="/" className="text-sm text-neutral-500 hover:text-orange-500 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Link>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight break-words">{event?.name}</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-neutral-500">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {event?.creatorName || 'Anonymous'}
            </span>
            <span>•</span>
            <span>{photos.length} Photos</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {user?.uid === event?.createdBy && (
            <Link
              to={`/event/${eventId}/settings`}
              className="flex-1 sm:flex-none px-5 py-3 bg-white border border-neutral-200 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-50 transition-all shadow-sm active:scale-95"
            >
              <Settings className="w-4 h-4" /> Settings
            </Link>
          )}
          <button
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedPhotoIds([]);
            }}
            className={`flex-1 sm:flex-none px-5 py-3 border rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${
              isSelectMode ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {isSelectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {isSelectMode ? 'Cancel Selection' : 'Select'}
          </button>
          {isSelectMode && selectedPhotoIds.length > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 sm:flex-none px-5 py-3 bg-red-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-all shadow-lg shadow-red-200 active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Delete ({selectedPhotoIds.length})
            </button>
          )}
          {user?.uid === event?.createdBy && (
            <button
              onClick={openShareQr}
              className="flex-1 sm:flex-none px-5 py-3 bg-white border border-neutral-200 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-50 transition-all shadow-sm active:scale-95"
            >
              <Share2 className="w-4 h-4" /> Share QR
            </button>
          )}
          <button
            onClick={handleBulkDownload}
            disabled={downloadingAll || filteredPhotos.length === 0}
            className="flex-1 sm:flex-none px-5 py-3 bg-white border border-neutral-200 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {downloadingAll ? (
              <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {selectedTags.length > 0 ? 'Download Filtered' : 'Download All'}
          </button>
          <Link
            to={`/event/${eventId}/search`}
            className="flex-1 sm:flex-none px-5 py-3 bg-orange-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 active:scale-95"
          >
            <Search className="w-4 h-4" /> Find My Photos
          </Link>
          <Link
            to={`/event/${eventId}/upload`}
            className="flex-1 sm:flex-none px-5 py-3 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all shadow-lg active:scale-95"
          >
            <Upload className="w-4 h-4" /> Upload
          </Link>
        </div>
      </div>

      {/* Tag Filtering */}
      {allTags.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-600">
            <Filter className="w-4 h-4" /> Filter by Tags
          </div>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all border ${
                  selectedTags.includes(tag)
                    ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="px-4 py-2 text-sm font-bold text-red-500 hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredPhotos.map((photo, index) => (
              <motion.div
                key={photo.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.01 }}
                className={`group relative aspect-square bg-neutral-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer ring-offset-2 ${
                  selectedPhotoIds.includes(photo.id) ? 'ring-4 ring-orange-500 scale-95' : ''
                }`}
                onClick={() => isSelectMode ? togglePhotoSelection(photo.id) : setSelectedPhoto(photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || "Event photo"}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (!photo.driveFileId) return;
                    const fallback = getDriveImageUrl(photo.driveFileId);
                    if (e.currentTarget.src !== fallback) {
                      e.currentTarget.src = fallback;
                    }
                  }}
                />
                
                {isSelectMode && (
                  <div className="absolute top-3 right-3 z-10">
                    {selectedPhotoIds.includes(photo.id) ? (
                      <div className="bg-orange-500 text-white p-1 rounded-full shadow-lg">
                        <CheckSquare className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="bg-white/50 backdrop-blur-sm text-white p-1 rounded-full border border-white/20">
                        <Square className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                {photo.caption && (
                  <p className="text-white text-xs font-medium truncate mb-1">{photo.caption}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/80 font-mono truncate">
                    By {photo.photographerName?.split(' ')[0] || 'Photog'}
                  </span>
                  <div className="flex gap-1">
                    {(user?.uid === photo.uploadedBy || user?.uid === event?.createdBy) && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(photo.id, photo.uploadedBy); }}
                        className="p-1.5 bg-red-500/80 rounded-lg text-white hover:bg-red-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDownload(photo.url, photo.id); }}
                      className="p-1.5 bg-white/80 rounded-lg text-black hover:bg-white transition-colors"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {filteredPhotos.length === 0 && photos.length > 0 && (
          <div className="col-span-full py-24 text-center space-y-4 bg-white rounded-[3rem] border-2 border-dashed border-neutral-100">
            <div className="p-6 bg-neutral-50 w-fit mx-auto rounded-full">
              <Filter className="w-10 h-10 text-neutral-300" />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-bold text-neutral-500">No photos match your filters</p>
              <p className="text-neutral-400">Try selecting different tags or clear all filters.</p>
            </div>
            <button
              onClick={() => setSelectedTags([])}
              className="px-8 py-3 bg-black text-white rounded-full font-bold hover:bg-neutral-800 transition-all shadow-lg active:scale-95"
            >
              Clear Filters
            </button>
          </div>
        )}
        {photos.length === 0 && (
          <div className="col-span-full py-24 text-center space-y-4 bg-white rounded-[3rem] border-2 border-dashed border-neutral-100">
            <div className="p-6 bg-neutral-50 w-fit mx-auto rounded-full">
              <Grid className="w-10 h-10 text-neutral-300" />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-bold text-neutral-500">No photos yet</p>
              <p className="text-neutral-400">Be the first to upload photos to this event!</p>
            </div>
            <Link
              to={`/event/${eventId}/upload`}
              className="inline-block px-8 py-3 bg-black text-white rounded-full font-bold hover:bg-neutral-800 transition-all shadow-lg active:scale-95"
            >
              Upload Photos
            </Link>
          </div>
        )}
      </div>

      {/* Photo Detail Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-5xl w-full flex flex-col lg:flex-row gap-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 relative aspect-square lg:aspect-auto lg:h-[80vh] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.caption || "Event photo"}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (!selectedPhoto.driveFileId) return;
                    const fallback = getDriveImageUrl(selectedPhoto.driveFileId);
                    if (e.currentTarget.src !== fallback) {
                      e.currentTarget.src = fallback;
                    }
                  }}
                />
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
                >
                  <CloseIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="w-full lg:w-80 space-y-6 text-white">
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold">{selectedPhoto.caption || "Untitled Photo"}</h3>
                  <div className="flex items-center gap-2 text-neutral-400">
                    <User className="w-4 h-4" />
                    <span className="text-sm">Uploaded by {selectedPhoto.photographerName || 'Anonymous'}</span>
                  </div>
                  {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedPhoto.tags.map((tag: string) => (
                        <span key={tag} className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
                  <button
                    onClick={() => handleDownload(selectedPhoto.url, selectedPhoto.id)}
                    className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all"
                  >
                    <Download className="w-5 h-5" /> Download Original
                  </button>
                  {(user?.uid === selectedPhoto.uploadedBy || user?.uid === event?.createdBy) && (
                    <button
                      onClick={() => handleDelete(selectedPhoto.id, selectedPhoto.uploadedBy)}
                      className="w-full py-4 bg-red-500/20 text-red-500 border border-red-500/30 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-500/30 transition-all"
                    >
                      <Trash2 className="w-5 h-5" /> Delete Photo
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white p-8 rounded-[3rem] max-w-sm w-full text-center space-y-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-red-50 w-fit mx-auto rounded-full">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Delete {selectedPhotoIds.length} photos?</h3>
                <p className="text-neutral-500">This action cannot be undone. All selected photos will be permanently removed.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-full font-bold hover:bg-neutral-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deletingBulk}
                  className="flex-1 py-4 bg-red-500 text-white rounded-full font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                >
                  {deletingBulk ? 'Deleting...' : 'Delete All'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white p-10 rounded-[3rem] max-w-sm w-full text-center space-y-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-2">
                <h3 className="text-3xl font-extrabold tracking-tight">Event QR</h3>
                <p className="text-neutral-500">Scan to join the gallery</p>
              </div>
              
              <div className="bg-neutral-50 p-8 rounded-[2rem] inline-block border border-neutral-100 shadow-inner">
                {creatingShareUrl || !shareUrl ? (
                  <div className="w-[200px] h-[200px] flex items-center justify-center text-sm text-neutral-500">
                    Creating secure link...
                  </div>
                ) : (
                  <QRCodeSVG value={shareUrl} size={200} />
                )}
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-neutral-50 rounded-2xl text-[10px] font-mono break-all border border-neutral-100 text-neutral-400">
                  {shareUrl || 'Preparing secure URL...'}
                </div>
                <button
                  onClick={() => setShowQR(false)}
                  className="w-full py-4 bg-black text-white rounded-full font-bold hover:bg-neutral-800 transition-all shadow-lg"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
