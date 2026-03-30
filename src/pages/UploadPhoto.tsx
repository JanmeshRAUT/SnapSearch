import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../context/AuthContext';
import { Upload, X, Image as ImageIcon, ArrowLeft, CheckCircle2, Tag, Type, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { addPhoto, getEvent, recordActivity, setEventDriveFolder } from '../lib/store';
import { EventFlowNav } from '../components/EventFlowNav';
import { createDriveFolderForEvent, uploadImageToDriveFolder } from '../lib/googleDrive';

interface PhotoMetadata {
  id: string;
  file: File;
  preview: string;
  caption: string;
  tags: string;
  status: 'pending' | 'compressing' | 'uploading' | 'done' | 'error';
  progress: number;
}

export function UploadPhoto() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const isMountedRef = useRef(true);
  const [photoData, setPhotoData] = useState<PhotoMetadata[]>([]);
  const [uploading, setUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetPhotoData = (updater: React.SetStateAction<PhotoMetadata[]>) => {
    if (!isMountedRef.current) return;
    setPhotoData(updater);
  };

  const safeSetUploading = (value: boolean) => {
    if (!isMountedRef.current) return;
    setUploading(value);
  };

  const safeSetOverallProgress = (value: number) => {
    if (!isMountedRef.current) return;
    setOverallProgress(value);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newPhotos = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      caption: '',
      tags: '',
      status: 'pending' as const,
      progress: 0
    }));
    safeSetPhotoData(prev => [...prev, ...newPhotos]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] }
  } as any);

  const removePhoto = (id: string) => {
    safeSetPhotoData(prev => prev.filter(p => p.id !== id));
  };

  const updateMetadata = (id: string, field: 'caption' | 'tags', value: string) => {
    safeSetPhotoData(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleUpload = async () => {
    if (!user) {
      toast.error('Please login to upload photos');
      login();
      return;
    }
    if (photoData.length === 0) return;

    safeSetUploading(true);
    safeSetOverallProgress(0);
    toast.info('Upload started. You can keep browsing while files upload in background.');
    let successCount = 0;
    let failedCount = 0;

    try {
      const event = getEvent(eventId!);
      if (!event) {
        toast.error('Event not found');
        safeSetUploading(false);
        return;
      }

      let driveFolderId = event.driveFolderId;
      if (!driveFolderId) {
        const createdFolder = await createDriveFolderForEvent(event.name);
        driveFolderId = createdFolder.id;
        setEventDriveFolder(event.id, {
          driveFolderId: createdFolder.id,
          driveFolderLink: createdFolder.webViewLink,
        });
        toast.success('Connected event folder to Google Drive');
      }

      for (let i = 0; i < photoData.length; i++) {
        const photo = photoData[i];
        
        // Update status to compressing
        safeSetPhotoData(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'compressing', progress: 20 } : p));

        // 1. Image Compression
        const options = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          onProgress: (p: number) => {
            safeSetPhotoData(prev => prev.map(item => item.id === photo.id ? { ...item, progress: 20 + (p * 0.3) } : item));
          }
        };
        
        let compressedFile: File | Blob;
        try {
          compressedFile = await imageCompression(photo.file, options);
        } catch {
          // Fallback: continue with original file instead of aborting this photo.
          compressedFile = photo.file;
        }

        // Update status to uploading
        safeSetPhotoData(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'uploading', progress: 60 } : p));
        
        const uploadFile = compressedFile instanceof File
          ? compressedFile
          : new File([compressedFile], photo.file.name || `${photo.id}.jpg`, { type: compressedFile.type || 'image/jpeg' });

        try {
          const driveFile = await uploadImageToDriveFolder({
            file: uploadFile,
            folderId: driveFolderId,
            fileName: photo.file.name,
          });

          // 3. Save photo metadata after verified Drive upload
          addPhoto(eventId!, {
            url: driveFile.publicUrl,
            caption: photo.caption.trim(),
            tags: photo.tags.split(',').map(t => t.trim()).filter(Boolean),
            uploadedBy: user.uid,
            photographerName: user.displayName,
            driveFileId: driveFile.id,
            driveFolderId: driveFolderId,
          });

          // Update status to done
          safeSetPhotoData(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'done', progress: 100 } : p));
          successCount++;
        } catch (fileError) {
          console.error('Single file upload failed:', fileError);
          safeSetPhotoData(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'error' } : p));
          failedCount++;
        }

        safeSetOverallProgress(Math.round(((i + 1) / photoData.length) * 100));
      }

      // Record activity
      if (successCount > 0) {
        recordActivity({
          userId: user.uid,
          type: 'upload',
          description: `Uploaded ${successCount} photos to event`,
          eventId: eventId
        });
      }

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} photo${successCount > 1 ? 's' : ''}!`);
        if (failedCount > 0) {
          toast.info(`${failedCount} photo${failedCount > 1 ? 's' : ''} could not be uploaded.`);
        }
      } else {
        toast.error('No photos were uploaded. Check Google Drive permission and folder access, then try again.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload some photos');
    } finally {
      safeSetUploading(false);
    }
  };

  const continueInBackground = () => {
    toast.success('Upload continues in background. You can use other screens now.');
    navigate(`/event/${eventId}`);
  };

  return (
    <div className="w-full space-y-6 sm:space-y-8 pb-24 sm:pb-32">
      <EventFlowNav />

      <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm space-y-1">
        <Link to={`/event/${eventId}`} className="text-sm text-neutral-500 hover:text-orange-500 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Gallery
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Upload Photos</h1>
        <p className="text-neutral-500">Add your captures with captions and tags.</p>
      </div>

      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-3xl p-6 sm:p-12 text-center transition-all cursor-pointer
          ${isDragActive ? 'border-orange-500 bg-orange-50' : 'border-neutral-200 hover:border-neutral-300 bg-white'}
          ${uploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="p-4 bg-neutral-50 w-fit mx-auto rounded-full">
            <Upload className={`w-8 h-8 ${isDragActive ? 'text-orange-500' : 'text-neutral-400'}`} />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold">
              {isDragActive ? 'Drop them here!' : 'Drag & drop photos here'}
            </p>
            <p className="text-neutral-500">or click to browse from your device</p>
          </div>
          <p className="text-xs text-neutral-400">Photos will be automatically compressed for faster sharing.</p>
        </div>
      </div>

      {photoData.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-orange-500" />
              Selected Photos ({photoData.length})
            </h3>
            {!uploading && (
              <button
                onClick={() => safeSetPhotoData([])}
                className="text-sm text-red-500 font-bold hover:underline"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-4">
            <AnimatePresence>
              {photoData.map((photo) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-4 rounded-3xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row gap-6 group relative overflow-hidden"
                >
                  {/* Individual Progress Background */}
                  {uploading && photo.status !== 'done' && (
                    <div 
                      className="absolute bottom-0 left-0 h-1 bg-orange-100 transition-all duration-300"
                      style={{ width: `${photo.progress}%` }}
                    />
                  )}

                  <div className="relative w-full sm:w-40 aspect-square rounded-2xl overflow-hidden shrink-0">
                    <img src={photo.preview} alt="Preview" className="w-full h-full object-cover" />
                    {!uploading && (
                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {uploading && photo.status === 'done' && (
                      <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1 mr-4">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                          <Type className="w-3 h-3" /> Caption
                        </label>
                        <input
                          type="text"
                          value={photo.caption}
                          onChange={(e) => updateMetadata(photo.id, 'caption', e.target.value)}
                          placeholder="Add a caption..."
                          disabled={uploading}
                          className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all text-sm"
                        />
                      </div>
                      {uploading && (
                        <div className="text-right">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
                            photo.status === 'done' ? 'bg-green-100 text-green-600' :
                            photo.status === 'error' ? 'bg-red-100 text-red-600' :
                            'bg-orange-100 text-orange-600'
                          }`}>
                            {photo.status}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Tags (comma separated)
                      </label>
                      <input
                        type="text"
                        value={photo.tags}
                        onChange={(e) => updateMetadata(photo.id, 'tags', e.target.value)}
                        placeholder="e.g. candid, sunset, group"
                        disabled={uploading}
                        className="w-full px-4 py-2 bg-neutral-50 rounded-xl border border-transparent focus:border-orange-500 focus:bg-white outline-none transition-all text-sm"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="fixed bottom-4 sm:bottom-8 left-0 right-0 px-4 z-40">
            <div className="w-full">
              {uploading ? (
                <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-neutral-100 space-y-4">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                      <span className="text-neutral-600">Overall Progress</span>
                    </div>
                    <span className="text-orange-500">{overallProgress}%</span>
                  </div>
                  <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-orange-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${overallProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={continueInBackground}
                      className="px-4 py-2 text-sm font-semibold text-neutral-700 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors"
                    >
                      Continue in Background
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleUpload}
                  className="w-full py-5 bg-black text-white rounded-full font-bold text-xl hover:bg-neutral-800 transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  Upload {photoData.length} Photos
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
