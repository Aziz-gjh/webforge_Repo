import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ProviderPreview from './ProviderPreview';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ProviderPreview /></StrictMode>,
);
