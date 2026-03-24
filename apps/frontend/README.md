# Design System Builder - Frontend

A modern React application for managing design systems, built with React + TypeScript + Vite + Tailwind CSS + Radix UI.

## Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your API configuration:
   ```
   VITE_API_BASE_URL=http://localhost:3001
   ```

   For production, update to your actual API URL:
   ```
   VITE_API_BASE_URL=https://your-api-domain.com
   ```

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. The application will be available at `http://localhost:5173`

## Build

```bash
npm run build
```

## Features

- **Design System Management**: Create, edit, and delete design systems
- **Component Management**: Add components to design systems with variations
- **Token System**: Define design tokens with values for different variations
- **Search & Filter**: Find design systems quickly
- **Responsive UI**: Built with Tailwind CSS and Radix UI components

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **React Router** for navigation

## Project Structure

```
src/
  components/ui/     # Reusable UI components
  pages/            # Page components
  config/           # Configuration files
  lib/              # Utility functions
  types/            # TypeScript type definitions
```
