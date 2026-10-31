import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Page } from './components/Layout';
import { AppStateProvider } from './i18n';
import Book from './pages/Book';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import Trips from './pages/Trips';
import { useIsProvider } from './lib/auth';
import ProviderBlocks from './pages/provider/ProviderBlocks';
import ProviderSchedule from './pages/provider/ProviderSchedule';

function Provider() {
  const { isProvider } = useIsProvider();
  return (
    <Page title="nav.provider">
      <div className="provider-wrap">
        {isProvider && <ProviderBlocks />}
        <ProviderSchedule />
      </div>
    </Page>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/book" element={<Book />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/provider" element={<Provider />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  );
}
