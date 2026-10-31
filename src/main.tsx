import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initApiInterceptor } from './lib/api-interceptor';

try {
  initApiInterceptor();
} catch (error) {
  console.warn('API Interceptor initialization skipped:', error);
}

createRoot(document.getElementById('root')!).render(<App />);
