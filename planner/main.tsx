import { createRoot } from 'react-dom/client';
import Planner from './planner';
import './planner.css';
createRoot(document.getElementById('root')!).render(<Planner />);
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}); });
}
