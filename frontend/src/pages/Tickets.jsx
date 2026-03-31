import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("Newest");

  const fetchTickets = async () => {
    const res = await fetch("http://localhost:3000/tickets");
    const data = await res.json();
    setTickets(data);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const closeTicket = async (id) => {
    await fetch(`http://localhost:3000/tickets/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Closed",
      }),
    });

    fetchTickets();
  };

  const filteredTickets = tickets
    .filter((ticket) => {
      if (filter === "All") return true;
      return ticket.status === filter;
    })
    .sort((a, b) => {
      if (sort === "Newest") {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sort === "Priority") {
        const order = { High: 3, Medium: 2, Low: 1 };
        return order[b.priority] - order[a.priority];
      }
      return 0;
    });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Support Tickets</h1>

      {/* FILTER + SORT CONTROLS */}
      <div className="flex gap-4 mb-6">

        <select
          className="border p-2 rounded"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>All</option>
          <option>Open</option>
          <option>Closed</option>
        </select>

        <select
          className="border p-2 rounded"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option>Newest</option>
          <option>Priority</option>
        </select>

      </div>

      {/* TICKETS LIST */}
      <div className="grid gap-4">

        {filteredTickets.map((ticket) => (
          <div
            key={ticket.id}
            className="bg-white p-4 rounded-lg shadow border hover:shadow-lg transition"
          >

            {/* CLICKABLE TITLE */}
            <Link to={`/tickets/${ticket.id}`}>
              <h2 className="text-xl font-semibold hover:text-blue-600">
                {ticket.title}
              </h2>
            </Link>

            <p className="text-gray-600">{ticket.description}</p>

            <p className="text-sm mt-2">
              Priority:{" "}
              <span
                className={
                  ticket.priority === "High"
                    ? "text-red-600 font-semibold"
                    : ticket.priority === "Medium"
                    ? "text-yellow-600 font-semibold"
                    : "text-green-600 font-semibold"
                }
              >
                {ticket.priority}
              </span>
            </p>

            <p className="text-sm">
              Status:{" "}
              <span
                className={
                  ticket.status === "Open"
                    ? "text-green-600 font-semibold"
                    : "text-gray-500"
                }
              >
                {ticket.status}
              </span>
            </p>

            <p className="text-xs text-gray-400 mt-2">
              Created: {new Date(ticket.created_at).toLocaleString()}
            </p>

            {ticket.status === "Open" && (
              <button
                onClick={() => closeTicket(ticket.id)}
                className="mt-3 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Close Ticket
              </button>
            )}

          </div>
        ))}

      </div>
    </div>
  );
}

export default Tickets;