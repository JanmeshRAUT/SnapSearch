import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Upload, X, Image as ImageIcon, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export function UploadPhoto() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    const newPreviews = acceptedFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] }
  } as any);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!user) {
      toast.error('Please login to upload photos');
      login();
      return;
    }
    if (files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Convert to base64 for prototype (warning: Firestore 1MB limit)
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        // Basic compression check (very simple)
        if (base64.length > 1000000) {
          toast.warning(`Photo ${i + 1} is too large (>1MB). Skipping...`);
          continue;
        }

        await addDoc(collection(db, 'events', eventId!, 'photos'), {
          url: base64,
          uploadedAt: serverTimestamp(),
          uploadedBy: user.uid,
          eventId: eventId
        });
        
        successCount++;
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      toast.success(`Successfully uploaded ${successCount} photos!`);
      navigate(`/event/${eventId}`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload some photos');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-1">
        <Link to={`/event/${eventId}`} className="text-sm text-neutral-500 hover:text-orange-500 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Gallery
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Upload Photos</h1>
        <p className="text-neutral-500">Add your captures to this event gallery.</p>
      </div>

      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-[2rem] p-12 text-center transition-all cursor-pointer
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
          <p className="text-xs text-neutral-400">Max size per photo: 1MB (Prototype limit)</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-orange-500" />
              Selected Photos ({files.length})
            </h3>
            <button
              onClick={() => { setFiles([]); setPreviews([]); }}
              className="text-sm text-red-500 font-bold hover:underline"
              disabled={uploading}
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            <AnimatePresence>
              {previews.map((preview, index) => (
                <motion.div
                  key={preview}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative aspect-square rounded-2xl overflow-hidden border border-neutral-100 group"
                >
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  {!uploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="pt-4">
            {uploading ? (
              <div className="space-y-4">
                <div className="h-4 bg-neutral-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-orange-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center font-bold text-orange-500 animate-pulse">
                  Uploading... {progress}%
                </p>
              </div>
            ) : (
              <button
                onClick={handleUpload}
                className="w-full py-4 bg-black text-white rounded-full font-bold text-lg hover:bg-neutral-800 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Start Uploading
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
