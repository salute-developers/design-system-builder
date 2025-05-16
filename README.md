# Design System Builder

A web application for managing and building design systems. This application allows you to create and manage components, variations, tokens, and design systems.

## Features

- Create and manage Design Systems
- Manage Components with their Variations
- Define Tokens and their values
- Admin interface for managing all entities
- Modern UI built with Material-UI

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm run install:all
   ```

3. Set up the database:
   - Create a PostgreSQL database named `ds_builder`
   - Create a `.env` file in the backend directory with the following variables:
     ```
     # Database Configuration
     DB_HOST=localhost
     DB_PORT=5432
     DB_USER=postgres
     DB_PASSWORD=postgres
     DB_NAME=ds_builder

     # Server Configuration
     PORT=3001
     ```

4. Generate and run migrations:
   ```bash
   cd backend
   npm run generate
   npm run migrate
   ```

5. Start the development servers:
   ```bash
   npm run dev
   ```

This will start both the backend (port 3001) and frontend (port 5173) servers.

## Project Structure

- `/backend` - Node.js backend with Express and Drizzle ORM
- `/frontend` - React frontend with TypeScript and Material-UI

## API Endpoints

### Design Systems
- GET `/api/design-systems` - Get all design systems
- POST `/api/design-systems` - Create a new design system

### Components
- GET `/api/components` - Get all components
- POST `/api/components` - Create a new component
- DELETE `/api/components/:id` - Delete a component

### Variations
- GET `/api/variations` - Get all variations
- POST `/api/variations` - Create a new variation
- DELETE `/api/variations/:id` - Delete a variation

### Tokens
- GET `/api/tokens` - Get all tokens
- POST `/api/tokens` - Create a new token
- DELETE `/api/tokens/:id` - Delete a token

## Technologies Used

- Backend:
  - Node.js
  - Express
  - Drizzle ORM
  - PostgreSQL
  - TypeScript

- Frontend:
  - React
  - TypeScript
  - Material-UI
  - React Router
  - Axios 