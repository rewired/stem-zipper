import { ToastProvider } from './providers/ToastProvider';
import { AppRouter } from './routes';

export default function App() {
  return (
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  );
}
