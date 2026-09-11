import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Ритм — трекер привычек',
  description: 'Твои привычки, день за днём. Отмечай сделанное, возвращайся к прошлым датам и наблюдай за прогрессом.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
  appleWebApp: { capable: true, title: 'Ритм', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111416' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru" className="dark"><body>{children}</body></html>;
}
