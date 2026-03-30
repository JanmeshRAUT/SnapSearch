import React, { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { findMatchingPhotos } from '../lib/gemini';
import { Camera, Upload, ArrowLeft, Search, Sparkles, UserCheck, Grid, Download, X, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { incrementUserStats, listPhotos, recordActivity } from '../lib/store';
import { EventFlowNav } from '../components/EventFlowNav';

export function FaceSearch() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const [selfies, setSelfies] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelfies(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeSelfie = (index: number) => {
    setSelfies(prev => prev.filter((_, i) => i !== index));
  };

  const startSearch = async () => {
    if (selfies.length === 0 || !eventId) return;

    setSearching(true);
    setHasSearched(true);
    setResults([]);

    try {
      // 1. Fetch all photos for this event
      const allPhotos = listPhotos(eventId);

      if (allPhotos.length === 0) {
        toast.info('No photos in this event gallery yet.');
        setSearching(false);
        return;
      }

      // 2. Run local face matcher to find matches
      // Limit to first 20 photos for prototype performance/token limits
      const photoBatch = allPhotos.slice(0, 20);
      const matchingIds = await findMatchingPhotos(selfies, photoBatch.map(p => ({ id: p.id, url: p.url })));
      
      const matchedPhotos = allPhotos.filter(p => matchingIds.includes(p.id));
      setResults(matchedPhotos);
      
      if (matchedPhotos.length > 0) {
        toast.success(`Found ${matchedPhotos.length} matching photos!`);
        
        // Increment AI Matches stat
        if (user) {
          try {
            incrementUserStats(user.uid, { totalAiMatches: matchedPhotos.length });

            recordActivity({
              userId: user.uid,
              type: 'match',
              description: `Found ${matchedPhotos.length} matches in event "${eventId}"`,
              eventId: eventId
            });
          } catch (error) {
            console.error('Error updating AI match stats:', error);
          }
        }
      } else {
        toast.info('No matching photos found. Try more selfies from different angles!');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Face search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = async (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-photo-${id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Increment download stat
    if (user) {
      try {
        incrementUserStats(user.uid, { totalDownloads: 1 });

        recordActivity({
          userId: user.uid,
          type: 'download',
          description: `Downloaded a matched photo from event "${eventId}"`,
          eventId: eventId,
          photoId: id
        });
      } catch (error) {
        console.error('Error updating download stats:', error);
      }
    }
  };

  const handleDownloadAllMatches = async () => {
    if (results.length === 0) return;
    setDownloadingAll(true);
    const zip = new JSZip();
    const folder = zip.folder(`my-matched-photos`);

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
      for (let i = 0; i < results.length; i++) {
        const photo = results[i];
        try {
          const blob = await urlToBlob(photo.url);
          const ext = blob.type.includes('png') ? 'png' : 'jpg';
          folder?.file(`photo-${photo.id}.${ext}`, blob);
        } catch (error) {
          console.error('Skipped matched photo during zip build:', photo.id, error);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `my-matched-photos.zip`);
      toast.success('Download started!');

      // Increment download stat
      if (user) {
        try {
          incrementUserStats(user.uid, { totalDownloads: results.length });

          recordActivity({
            userId: user.uid,
            type: 'download',
            description: `Bulk downloaded ${results.length} matched photos from event "${eventId}"`,
            eventId: eventId
          });
        } catch (error) {
          console.error('Error updating download stats:', error);
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to create zip file');
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="w-full space-y-8 sm:space-y-12 pb-24 sm:pb-32">
      <EventFlowNav />

      <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm space-y-1 text-center max-w-3xl mx-auto px-1">
        <Link to={`/event/${eventId}`} className="text-sm text-neutral-500 hover:text-orange-500 inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Gallery
        </Link>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Find Your <span className="text-orange-500">Memories</span></h1>
        <p className="text-neutral-500 text-base sm:text-lg">
          Our AI will scan the entire gallery to find every photo you're in.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Selfie Upload */}
        <div className="lg:col-span-4 space-y-6 lg:space-y-8 lg:sticky lg:top-24">
          <div className="bg-white p-5 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-orange-500" />
                Who are we looking for?
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence>
                {selfies.map((selfie, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-neutral-100 group shadow-sm"
                  >
                    <img src={selfie} alt="Selfie" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeSelfie(index)}
                      className="absolute top-1 right-1 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {selfies.length < 4 && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center hover:border-orange-500 hover:bg-orange-50 transition-all group bg-neutral-50/50"
                  disabled={searching}
                >
                  <Plus className="w-6 h-6 text-neutral-300 group-hover:text-orange-500 transition-colors" />
                  <span className="text-[10px] font-bold text-neutral-400 group-hover:text-orange-500">Add Selfie</span>
                </button>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-neutral-50">
              <p className="text-xs text-neutral-400 text-center leading-relaxed">
                Add up to 4 photos from different angles for the highest matching accuracy.
              </p>
              <button
                onClick={startSearch}
                disabled={selfies.length === 0 || searching}
                className={`
                  w-full py-5 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95
                  ${selfies.length === 0 || searching ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed' : 'bg-black text-white hover:bg-neutral-800'}
                `}
              >
                {searching ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    AI is Scanning...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6 text-orange-400" />
                    Find My Photos
                  </>
                )}
              </button>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleSelfieUpload} 
              accept="image/*" 
              multiple
              className="hidden" 
            />
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-bold text-2xl flex items-center gap-3">
              <Grid className="w-7 h-7 text-orange-500" />
              {hasSearched ? 'Your Matched Photos' : 'Search Results'}
            </h3>
            {results.length > 0 && (
              <button
                onClick={handleDownloadAllMatches}
                disabled={downloadingAll}
                className="px-6 py-2.5 bg-orange-50 text-orange-600 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-orange-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {downloadingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download All Matches ({results.length})
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {results.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: index * 0.05 
                  }}
                  className="group relative aspect-square bg-neutral-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all ring-1 ring-neutral-200"
                >
                  <img
                    src={photo.url}
                    alt="Matched photo"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="text-white text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-400" /> AI Match
                        </p>
                        <p className="text-white/60 text-[10px] font-mono">ID: {photo.id.slice(0, 8)}</p>
                      </div>
                      <button 
                        onClick={() => handleDownload(photo.url, photo.id)}
                        className="p-3 bg-white rounded-2xl text-black hover:scale-110 transition-transform shadow-xl active:scale-95"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {!searching && hasSearched && results.length === 0 && (
              <div className="col-span-full py-32 text-center space-y-6 bg-white rounded-[4rem] border-2 border-dashed border-neutral-100 shadow-inner">
                <div className="p-8 bg-neutral-50 w-fit mx-auto rounded-full">
                  <Search className="w-16 h-16 text-neutral-200" />
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-neutral-500 tracking-tight">No matches found</p>
                  <p className="text-neutral-400 max-w-xs mx-auto text-lg">
                    We couldn't find you in the gallery. Try adding more selfies or check back later!
                  </p>
                </div>
              </div>
            )}

            {!hasSearched && (
              <div className="col-span-full py-32 text-center space-y-6 bg-white rounded-[4rem] border-2 border-dashed border-neutral-100 opacity-40">
                <div className="p-8 bg-neutral-50 w-fit mx-auto rounded-full">
                  <Sparkles className="w-16 h-16 text-neutral-200" />
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-neutral-500 tracking-tight">Ready to scan</p>
                  <p className="text-neutral-400 text-lg">Upload your selfies to start the AI search.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
