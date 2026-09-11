import { createRoot } from 'react-dom/client';
import Tracker from '../app/tracker';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(<Tracker storageMode="device" />);
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}); });
}
