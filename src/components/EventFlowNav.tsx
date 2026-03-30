import { Link, useLocation, useParams } from 'react-router-dom';
import { Camera, Images, ScanFace, Settings } from 'lucide-react';
import { clsx } from 'clsx';

const steps = [
  { key: 'gallery', label: 'Gallery', icon: Images, path: (eventId: string) => `/event/${eventId}` },
  { key: 'upload', label: 'Upload', icon: Camera, path: (eventId: string) => `/event/${eventId}/upload` },
  { key: 'search', label: 'Face Search', icon: ScanFace, path: (eventId: string) => `/event/${eventId}/search` },
  { key: 'settings', label: 'Settings', icon: Settings, path: (eventId: string) => `/event/${eventId}/settings` },
] as const;

function isActive(pathname: string, stepKey: (typeof steps)[number]['key']) {
  if (stepKey === 'gallery') {
    return /\/event\/[^/]+$/.test(pathname);
  }
  if (stepKey === 'upload') return pathname.includes('/upload');
  if (stepKey === 'search') return pathname.includes('/search');
  if (stepKey === 'settings') return pathname.includes('/settings');
  return false;
}

export function EventFlowNav({ eventName }: { eventName?: string }) {
  const { eventId } = useParams();
  const { pathname } = useLocation();

  if (!eventId) return null;

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400 font-semibold">Event Workspace</p>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 truncate">
            {eventName || 'Event'}
          </h2>
        </div>
        <Link
          to="/"
          className="text-sm font-semibold text-neutral-500 hover:text-orange-500 transition-colors"
        >
          All Events
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((step) => {
          const active = isActive(pathname, step.key);
          const Icon = step.icon;

          return (
            <Link
              key={step.key}
              to={step.path(eventId)}
              className={clsx(
                'rounded-2xl border px-3 py-3 text-sm font-semibold transition-all',
                'flex items-center justify-center gap-2 text-center',
                active
                  ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{step.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
