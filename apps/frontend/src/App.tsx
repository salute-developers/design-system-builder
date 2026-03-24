import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// Pages
import Index from './pages/Index';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <nav className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="text-xl font-bold text-foreground">
                Design System Builder
              </Link>
              <div className="space-x-4">
                <Link to="/" className="text-foreground hover:text-primary">
                  Home
                </Link>
                <Link to="/admin" className="text-foreground hover:text-primary">
                  Admin
                </Link>
              </div>
            </div>
          </nav>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
