# IT Support Ticketing System

A full-stack web application designed to streamline IT support operations by providing a centralized platform for creating, managing, tracking, and resolving support tickets.

## Overview

Organizations often manage support requests through emails, phone calls, or verbal communication, which can result in lost requests, delayed responses, and poor visibility into ongoing issues. This project solves that problem by providing a structured ticket management system with real-time tracking and reporting capabilities.

Developed as a Senior CIS Capstone Project at the University of Akron.

## Features

* Create support tickets
* View all submitted tickets
* View detailed ticket information
* Update ticket status (Open / Closed)
* Filter and sort tickets
* Dashboard statistics and reporting
* Responsive user interface
* PostgreSQL database integration

## Technology Stack

### Frontend

* React
* React Router
* Tailwind CSS

### Backend

* Node.js
* Express.js

### Database

* PostgreSQL

### Development Tools

* Git
* Visual Studio Code

## System Architecture

```text
React Frontend
      ↓
Express REST API
      ↓
PostgreSQL Database
```

The frontend communicates with backend API endpoints, which process requests and interact with the PostgreSQL database to store and retrieve ticket information.

## Screens

### Dashboard

Displays ticket statistics and system overview.

### Ticket Creation

Allows users to submit new support requests.

### Ticket Listing

Displays all tickets with filtering and sorting functionality.

### Ticket Details

Provides detailed ticket information and status management.

## Installation

### Prerequisites

* Node.js
* PostgreSQL
* npm

### Clone the Repository

```bash
git clone https://github.com/yourusername/it-support-ticketing-system.git
cd it-support-ticketing-system
```

### Install Dependencies

Frontend:

```bash
cd client
npm install
```

Backend:

```bash
cd server
npm install
```

### Configure Environment Variables

Create a `.env` file in the server directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ticketing_system
DB_USER=postgres
DB_PASSWORD=yourpassword
```

### Start the Application

Backend:

```bash
npm run dev
```

Frontend:

```bash
npm start
```

## Future Improvements

* User authentication
* Role-based access control
* Ticket comments and activity logs
* Email notifications
* Advanced analytics and reporting
* File attachments

## Learning Outcomes

This project provided hands-on experience with:

* Full-stack web development
* REST API development
* PostgreSQL database design
* React component architecture
* State management
* Debugging and troubleshooting
* Git version control
* Software development lifecycle practices

## Author

**Derek Nicholson**

Bachelor of Science in Computer Information Systems
University of Akron

## License

This project is intended for educational and portfolio purposes.
