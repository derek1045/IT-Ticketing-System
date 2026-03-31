import { useEffect, useState } from "react"

function Dashboard() {

  const [stats, setStats] = useState({
    open: 0,
    closed: 0
  })

  useEffect(() => {
    const fetchTickets = async () => {
      const res = await fetch("http://localhost:3000/tickets")
      const data = await res.json()

      const open = data.filter(t => t.status === "Open").length
      const closed = data.filter(t => t.status === "Closed").length

      setStats({ open, closed })
    }

    fetchTickets()
  }, [])

  return (
    <div>

      <h1 className="text-3xl font-bold mb-8">
        Dashboard
      </h1>

      <div className="grid grid-cols-2 gap-6">

        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold">
            Open Tickets
          </h2>
          <p className="text-3xl">{stats.open}</p>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold">
            Closed Tickets
          </h2>
          <p className="text-3xl">{stats.closed}</p>
        </div>

      </div>

    </div>
  )
}

export default Dashboard