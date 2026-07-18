/**
 * Application Type Definitions
 * 
 * Centralized interface and type declarations for the application.
 * These will be extended as features (like auth, database, and chat) are added.
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AppState {
  isInitialized: boolean;
  theme: "light" | "dark";
}
