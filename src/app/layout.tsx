import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
export const metadata: Metadata = {
  title: 'Curwen Arkiv',
  description: 'Archivo público de las transmisiones de Curwen. Busca menciones y abre cada momento en YouTube.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><a href="#main" className="skip-link">Saltar al contenido</a>
    <div className="atmosphere" aria-hidden="true" /><Navbar /><main id="main" tabIndex={-1}>{children}</main>
  </body></html>;
}
