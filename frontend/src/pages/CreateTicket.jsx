import { useState } from "react";

function CreateTicket() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Low");

  const submitTicket = async (e) => {
    e.preventDefault();

    await fetch("http://localhost:3000/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
        priority,
      }),
    });

    setTitle("");
    setDescription("");
    setPriority("Low");

    alert("Ticket submitted!");
  };

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create Support Ticket</h1>

      <form onSubmit={submitTicket} className="flex flex-col gap-4">

        <input
          className="border p-2 rounded"
          placeholder="Ticket Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          className="border p-2 rounded"
          placeholder="Describe the issue"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <select
          className="border p-2 rounded"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>

        <button
          className="bg-blue-600 text-white p-2 rounded"
          type="submit"
        >
          Submit Ticket
        </button>

      </form>
    </div>
  );
}

export default CreateTicket;