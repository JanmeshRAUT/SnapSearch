import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';
import { Camera, Search, Share2, Upload, Grid, ArrowLeft, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export function EventGallery() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    const fetchEvent = async () => {
      const docRef = doc(db, 'events', eventId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setEvent({ id: docSnap.id, ...docSnap.data() });
      } else {
        toast.error('Event not found');
        navigate('/');
      }
    };

    fetchEvent();

    const q = query(collection(db, 'events', eventId, 'photos'), orderBy('uploadedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [eventId, navigate]);

  const shareUrl = `${window.location.origin}/event/${eventId}`;

  const handleDownload = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `photo-${id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link to="/" className="text-sm text-neutral-500 hover:text-orange-500 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{event?.name}</h1>
          <p className="text-neutral-500">Event ID: {eventId}</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowQR(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-white border border-neutral-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-50 transition-colors"
          >
            <Share2 className="w-4 h-4" /> Share QR
          </button>
          <Link
            to={`/event/${eventId}/search`}
            className="flex-1 sm:flex-none px-4 py-2 bg-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200"
          >
            <Search className="w-4 h-4" /> Find My Photos
          </Link>
          <Link
            to={`/event/${eventId}/upload`}
            className="flex-1 sm:flex-none px-4 py-2 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-lg"
          >
            <Upload className="w-4 h-4" /> Upload
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {photos.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02 }}
            className="group relative aspect-square bg-neutral-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all"
          >
            <img
              src={photo.url}
              alt="Event photo"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button 
                onClick={() => handleDownload(photo.url, photo.id)}
                className="p-2 bg-white rounded-full text-black hover:scale-110 transition-transform"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
        {photos.length === 0 && (
          <div className="col-span-full py-20 text-center space-y-4 bg-white rounded-3xl border-2 border-dashed border-neutral-100">
            <div className="p-4 bg-neutral-50 w-fit mx-auto rounded-full">
              <Grid className="w-8 h-8 text-neutral-300" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-neutral-500">No photos yet</p>
              <p className="text-sm text-neutral-400">Be the first to upload photos to this event!</p>
            </div>
            <Link
              to={`/event/${eventId}/upload`}
              className="inline-block px-6 py-2 bg-black text-white rounded-full font-bold text-sm hover:bg-neutral-800 transition-colors"
            >
              Upload Photos
            </Link>
          </div>
        )}
      </div>

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
              className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full text-center space-y-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Event QR Code</h3>
                <p className="text-neutral-500 text-sm">Scan this to join the gallery</p>
              </div>
              
              <div className="bg-neutral-50 p-6 rounded-3xl inline-block border border-neutral-100">
                <QRCodeSVG value={shareUrl} size={200} />
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-neutral-50 rounded-2xl text-xs font-mono break-all border border-neutral-100">
                  {shareUrl}
                </div>
                <button
                  onClick={() => setShowQR(false)}
                  className="w-full py-4 bg-black text-white rounded-full font-bold hover:bg-neutral-800 transition-colors"
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
