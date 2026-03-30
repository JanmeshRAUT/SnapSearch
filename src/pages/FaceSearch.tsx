import React, { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { findMatchingPhotos } from '../lib/gemini';
import { Camera, Upload, ArrowLeft, Search, Sparkles, UserCheck, Grid, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export function FaceSearch() {
  const { eventId } = useParams();
  const [selfie, setSelfie] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.searchFiles?.[0] || e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelfie(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startSearch = async () => {
    if (!selfie || !eventId) return;

    setSearching(true);
    setHasSearched(true);
    setResults([]);

    try {
      // 1. Fetch all photos for this event
      const q = query(collection(db, 'events', eventId, 'photos'), orderBy('uploadedAt', 'desc'));
      const snapshot = await getDocs(q);
      const allPhotos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      if (allPhotos.length === 0) {
        toast.info('No photos in this event gallery yet.');
        setSearching(false);
        return;
      }

      // 2. Call Gemini to find matches
      // Limit to first 20 photos for prototype performance/token limits
      const photoBatch = allPhotos.slice(0, 20);
      const matchingIds = await findMatchingPhotos(selfie, photoBatch.map(p => ({ id: p.id, url: p.url })));
      
      const matchedPhotos = allPhotos.filter(p => matchingIds.includes(p.id));
      setResults(matchedPhotos);
      
      if (matchedPhotos.length > 0) {
        toast.success(`Found ${matchedPhotos.length} matching photos!`);
      } else {
        toast.info('No matching photos found. Try another selfie!');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('AI search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-photo-${id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="space-y-1">
        <Link to={`/event/${eventId}`} className="text-sm text-neutral-500 hover:text-orange-500 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Gallery
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Find Your Photos</h1>
        <p className="text-neutral-500">Upload a selfie and our AI will find all photos you're in.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-orange-500" />
              Your Selfie
            </h3>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`
                aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative
                ${selfie ? 'border-orange-500' : 'border-neutral-200 hover:border-neutral-300 bg-neutral-50'}
              `}
            >
              {selfie ? (
                <>
                  <img src={selfie} alt="Selfie" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white font-bold text-sm">Change Photo</p>
                  </div>
                </>
              ) : (
                <div className="text-center p-4 space-y-2">
                  <Camera className="w-8 h-8 text-neutral-300 mx-auto" />
                  <p className="text-sm text-neutral-400 font-medium">Take or upload a selfie</p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleSelfieUpload} 
                accept="image/*" 
                capture="user"
                className="hidden" 
              />
            </div>

            <button
              onClick={startSearch}
              disabled={!selfie || searching}
              className={`
                w-full py-4 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95
                ${!selfie || searching ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed' : 'bg-orange-500 text-white hover:bg-orange-600'}
              `}
            >
              {searching ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Find My Photos
                </>
              )}
            </button>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Grid className="w-5 h-5 text-orange-500" />
              Search Results
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {results.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative aspect-square bg-neutral-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all"
                >
                  <img
                    src={photo.url}
                    alt="Matched photo"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={() => handleDownload(photo.url, photo.id)}
                      className="p-2 bg-white rounded-full text-black hover:scale-110 transition-transform"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {!searching && hasSearched && results.length === 0 && (
              <div className="col-span-full py-20 text-center space-y-4 bg-white rounded-3xl border-2 border-dashed border-neutral-100">
                <div className="p-4 bg-neutral-50 w-fit mx-auto rounded-full">
                  <Search className="w-8 h-8 text-neutral-300" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-neutral-500">No matches found</p>
                  <p className="text-sm text-neutral-400">Try a different selfie or check back later!</p>
                </div>
              </div>
            )}

            {!hasSearched && (
              <div className="col-span-full py-20 text-center space-y-4 bg-white rounded-3xl border-2 border-dashed border-neutral-100 opacity-50">
                <div className="p-4 bg-neutral-50 w-fit mx-auto rounded-full">
                  <Sparkles className="w-8 h-8 text-neutral-300" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-neutral-500">Ready to search</p>
                  <p className="text-sm text-neutral-400">Upload a selfie to see the magic happen.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
