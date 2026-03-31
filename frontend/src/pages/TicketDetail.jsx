import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

function TicketDetail() {
  const { id } = useParams()
  const [ticket, setTicket] = useState(null)

  useEffect(() => {
    const fetchTicket = async () => {
      const res = await fetch(`http://localhost:3000/tickets/${id}`)
      const data = await res.json()
      setTicket(data)
    }

    fetchTicket()
  }, [id])

  if (!ticket) return <p>Loading...</p>

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">{ticket.title}</h1>

      <p className="mb-3">{ticket.description}</p>

      <p><b>Priority:</b> {ticket.priority}</p>
      <p><b>Status:</b> {ticket.status}</p>

      <p className="text-sm text-gray-500 mt-4">
        Created: {new Date(ticket.created_at).toLocaleString()}
      </p>
    </div>
  )
}

export default TicketDetail