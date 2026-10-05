import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { initialize } from './storage/db';
import './styles/global.css';
import './styles/portfolio.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? <main className="fatal"><h1>Não foi possível abrir esta vista.</h1><p>Os dados guardados permanecem no dispositivo. Experimente recarregar a aplicação.</p><button onClick={() => location.reload()}>Recarregar</button></main> : this.props.children;
  }
}
const root = ReactDOM.createRoot(document.getElementById('root')!);
initialize().then(() => root.render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>)).catch(() => root.render(<main className="fatal"><h1>O armazenamento local não está disponível.</h1><p>Ative o armazenamento de sites no navegador e abra novamente a aplicação. Nenhum dado foi enviado para um servidor.</p><button onClick={() => location.reload()}>Tentar novamente</button></main>));
