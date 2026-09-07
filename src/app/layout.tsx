import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
export const metadata: Metadata = {
  title: 'Curwen Arkiv',
  description: 'Archivo público de las transmisiones de Curwen. Busca menciones y abre cada momento en YouTube.',
  openGraph: {
    title: 'Curwen Arkiv',
    description: 'Archivo público de las transmisiones de Curwen. Busca menciones y abre cada momento en YouTube.',
    type: 'website',
    images: [{
      url: 'https://tataportal.github.io/curwen_arkiv/social/brutalidad-analitica-v1.png',
      width: 1254,
      height: 1254,
      alt: 'Brutalidad Analítica',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Curwen Arkiv',
    images: [{
      url: 'https://tataportal.github.io/curwen_arkiv/social/brutalidad-analitica-v1.png',
      alt: 'Brutalidad Analítica',
    }],
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><a href="#main" className="skip-link">Saltar al contenido</a>
    <div className="atmosphere" aria-hidden="true" /><Navbar /><main id="main" tabIndex={-1}>{children}</main>
  </body></html>;
}
