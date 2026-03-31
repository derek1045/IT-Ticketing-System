import { Routes, Route, Link } from "react-router-dom"
import Dashboard from "./pages/Dashboard"
import Tickets from "./pages/Tickets"
import CreateTicket from "./pages/CreateTicket"
import TicketDetail from "./pages/TicketDetail"

export default function App() {
  return (
    <div className="flex h-screen bg-gray-100">

      <aside className="w-64 bg-gray-900 text-white p-6">
        <h1 className="text-xl font-bold mb-6">IT System</h1>

        <nav className="space-y-3">

          <Link to="/" className="block hover:text-blue-400">
            Dashboard
          </Link>

          <Link to="/tickets" className="block hover:text-blue-400">
            Tickets
          </Link>

          <Link to="/create-ticket" className="block hover:text-blue-400">
            Create Ticket
          </Link>

        </nav>
      </aside>

      <main className="flex-1 p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/create-ticket" element={<CreateTicket />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
        </Routes>
      </main>

    </div>
  )
}