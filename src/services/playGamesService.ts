// Google Play Games Services (GPGS) API Client and Achievement Synchronization Service
import { QUESTS } from '../data/definitions';

export interface PlayGamesPlayer {
  playerId: string;
  displayName: string;
  avatarImageUrl?: string;
  title?: string;
  experiencePoints?: number;
  level?: number;
}

export interface PlayGamesAchievement {
  id: string; // Google Play Games achievement ID (e.g. CgkI...)
  gameQuestId: string; // In-game quest ID (e.g. a_kills_1k)
  name: string;
  description: string;
  achievementType: 'STANDARD' | 'INCREMENTAL';
  totalSteps: number;
  currentSteps: number;
  achievementState: 'UNLOCKED' | 'REVEALED' | 'HIDDEN';
  xpFull: number;
  unlockedIconUrl?: string;
  isSynced: boolean;
  lastUpdatedTimestamp?: number;
}

export interface PlayGamesAuthStatus {
  isConnected: boolean;
  accessToken: string | null;
  player: PlayGamesPlayer | null;
  error: string | null;
  lastSyncedAt: number | null;
  clientId: string;
  isSandboxMode: boolean;
}

// Google Play Games Default Achievement Mapping
export const DEFAULT_GPGS_ACHIEVEMENTS: Array<Omit<PlayGamesAchievement, 'currentSteps' | 'achievementState' | 'isSynced'>> = [
  {
    id: 'CgkI17eA3qIJEAIQAQ',
    gameQuestId: 'a_kills_1k',
    name: 'Void Reaper I',
    description: 'Defeat 1,000 enemies.',
    achievementType: 'INCREMENTAL',
    totalSteps: 1000,
    xpFull: 5000,
  },
  {
    id: 'CgkI17eA3qIJEAIQAg',
    gameQuestId: 'a_kills_10k',
    name: 'Void Reaper II',
    description: 'Defeat 10,000 enemies.',
    achievementType: 'INCREMENTAL',
    totalSteps: 10000,
    xpFull: 15000,
  },
  {
    id: 'CgkI17eA3qIJEAIQAw',
    gameQuestId: 'a_bosses_25',
    name: 'Sovereign Slayer',
    description: 'Defeat 25 gatekeeper bosses.',
    achievementType: 'INCREMENTAL',
    totalSteps: 25,
    xpFull: 10000,
  },
  {
    id: 'CgkI17eA3qIJEAIQBA',
    gameQuestId: 'a_level_100',
    name: 'Century Mark',
    description: 'Reach Level 100.',
    achievementType: 'INCREMENTAL',
    totalSteps: 100,
    xpFull: 20000,
  },
  {
    id: 'CgkI17eA3qIJEAIQBQ',
    gameQuestId: 'a_eclipse_5',
    name: 'Cycle of Rebirth',
    description: 'Perform 5 Eclipses.',
    achievementType: 'INCREMENTAL',
    totalSteps: 5,
    xpFull: 25000,
  },
  {
    id: 'CgkI17eA3qIJEAIQBg',
    gameQuestId: 'a_arcade_25',
    name: 'Arcade Legend',
    description: 'Complete 25 Arcade games.',
    achievementType: 'INCREMENTAL',
    totalSteps: 25,
    xpFull: 10000,
  },
  {
    id: 'CgkI17eA3qIJEAIQBw',
    gameQuestId: 'a_relics_all',
    name: 'Relic Master',
    description: 'Collect all 5 ancient relics.',
    achievementType: 'STANDARD',
    totalSteps: 5,
    xpFull: 15000,
  },
  {
    id: 'CgkI17eA3qIJEAIQCA',
    gameQuestId: 'a_pets_all',
    name: 'Beast Whisperer',
    description: 'Awaken both pet companions.',
    achievementType: 'STANDARD',
    totalSteps: 2,
    xpFull: 10000,
  },
  {
    id: 'CgkI17eA3qIJEAIQCQ',
    gameQuestId: 'a_skills_25',
    name: 'Ascendant God',
    description: 'Unlock 25 Ascendant Powers.',
    achievementType: 'INCREMENTAL',
    totalSteps: 25,
    xpFull: 25000,
  },
  {
    id: 'CgkI17eA3qIJEAIQCg',
    gameQuestId: 'a_crystals_100',
    name: 'Crystal Hoarder',
    description: 'Accumulate 100 Void Crystals in total.',
    achievementType: 'INCREMENTAL',
    totalSteps: 100,
    xpFull: 15000,
  },
];

const STORAGE_AUTH_KEY = 'vanta_gpgs_auth_v1';
const STORAGE_SYNC_QUEUE_KEY = 'vanta_gpgs_pending_sync_v1';
const GPGS_API_BASE = 'https://games.googleapis.com/games/v1';

// Declare Google Identity Services global
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (err: unknown) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

class PlayGamesService {
  private status: PlayGamesAuthStatus = {
    isConnected: false,
    accessToken: null,
    player: null,
    error: null,
    lastSyncedAt: null,
    clientId: (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '',
    isSandboxMode: false,
  };

  private listeners: Set<(status: PlayGamesAuthStatus) => void> = new Set();
  private isGISLoading = false;

  constructor() {
    this.loadPersistedAuth();
  }

  private loadPersistedAuth() {
    try {
      const saved = localStorage.getItem(STORAGE_AUTH_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.status = {
          ...this.status,
          ...parsed,
          error: null,
        };
      }
    } catch (e) {
      console.warn('Failed to parse saved GPGS auth state:', e);
    }
  }

  private persistAuth() {
    try {
      localStorage.setItem(
        STORAGE_AUTH_KEY,
        JSON.stringify({
          isConnected: this.status.isConnected,
          accessToken: this.status.accessToken,
          player: this.status.player,
          lastSyncedAt: this.status.lastSyncedAt,
          clientId: this.status.clientId,
          isSandboxMode: this.status.isSandboxMode,
        })
      );
    } catch (e) {
      console.warn('Failed to persist GPGS auth state:', e);
    }
  }

  public getStatus(): PlayGamesAuthStatus {
    return { ...this.status };
  }

  public subscribe(listener: (status: PlayGamesAuthStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = this.getStatus();
    this.listeners.forEach((listener) => listener(current));
  }

  public setClientId(newClientId: string) {
    this.status.clientId = newClientId.trim();
    this.persistAuth();
    this.notify();
  }

  /**
   * Load Google Identity Services library dynamically
   */
  public async loadGIS(): Promise<boolean> {
    if (window.google?.accounts?.oauth2) {
      return true;
    }

    if (this.isGISLoading) {
      // Wait for existing load
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (window.google?.accounts?.oauth2) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 8000);
      });
    }

    this.isGISLoading = true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.isGISLoading = false;
        resolve(true);
      };
      script.onerror = () => {
        this.isGISLoading = false;
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Sign in to Google Play Games Services via OAuth 2.0 (Games scope)
   */
  public async signIn(explicitClientId?: string): Promise<{ success: boolean; error?: string }> {
    const clientId = explicitClientId || this.status.clientId || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      // If no client ID is configured, allow sandbox test mode or prompt user
      this.status.error = 'Google Cloud Client ID required. Please provide a Client ID or use Sandbox Mode.';
      this.notify();
      return { success: false, error: this.status.error };
    }

    this.status.clientId = clientId;
    this.status.error = null;

    try {
      const isGISLoaded = await this.loadGIS();
      if (!isGISLoaded || !window.google?.accounts?.oauth2) {
        throw new Error('Could not load Google Identity Services library.');
      }

      return new Promise((resolve) => {
        try {
          const client = window.google!.accounts!.oauth2!.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/games',
            callback: async (tokenResponse) => {
              if (tokenResponse.error) {
                this.status.error = `Google Auth Error: ${tokenResponse.error}`;
                this.notify();
                resolve({ success: false, error: this.status.error });
                return;
              }

              if (tokenResponse.access_token) {
                await this.handleTokenSuccess(tokenResponse.access_token, false);
                resolve({ success: true });
              } else {
                this.status.error = 'No access token received.';
                this.notify();
                resolve({ success: false, error: this.status.error });
              }
            },
            error_callback: (err) => {
              console.error('GIS Error callback:', err);
              this.status.error = 'Failed to initiate Google authentication popup.';
              this.notify();
              resolve({ success: false, error: this.status.error });
            },
          });

          client.requestAccessToken();
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Unknown auth error';
          this.status.error = message;
          this.notify();
          resolve({ success: false, error: message });
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to Google Play Games';
      this.status.error = message;
      this.notify();
      return { success: false, error: message };
    }
  }

  /**
   * Connect in Sandbox / Local Verified Mode for instant testing in preview
   */
  public async enableSandboxMode(customGamerTag = 'EclipseSovereign#2026') {
    this.status = {
      ...this.status,
      isConnected: true,
      isSandboxMode: true,
      accessToken: 'sandbox_token_gpgs_' + Date.now(),
      error: null,
      lastSyncedAt: Date.now(),
      player: {
        playerId: 'gpgs_player_sandbox_9942',
        displayName: customGamerTag,
        avatarImageUrl: '',
        title: 'Void Conqueror',
        experiencePoints: 45000,
        level: 12,
      },
    };
    this.persistAuth();
    this.notify();
  }

  public async signOut() {
    this.status = {
      isConnected: false,
      accessToken: null,
      player: null,
      error: null,
      lastSyncedAt: null,
      clientId: this.status.clientId,
      isSandboxMode: false,
    };
    this.persistAuth();
    this.notify();
  }

  private async handleTokenSuccess(accessToken: string, isSandbox = false) {
    this.status.accessToken = accessToken;
    this.status.isConnected = true;
    this.status.isSandboxMode = isSandbox;
    this.status.error = null;

    if (!isSandbox) {
      // Fetch authenticated player profile from Google Play Games API
      await this.fetchPlayerProfile();
    }

    this.persistAuth();
    this.notify();
  }

  /**
   * GET /players/me - Retrieves current player from Google Play Games Services API
   */
  public async fetchPlayerProfile(): Promise<PlayGamesPlayer | null> {
    if (!this.status.accessToken || this.status.isSandboxMode) {
      return this.status.player;
    }

    try {
      const res = await fetch(`${GPGS_API_BASE}/players/me`, {
        headers: {
          Authorization: `Bearer ${this.status.accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          this.signOut();
          throw new Error('Google Play Games session expired. Please sign in again.');
        }
        throw new Error(`Google Play Games profile request failed: ${res.statusText}`);
      }

      const data = await res.json();
      const player: PlayGamesPlayer = {
        playerId: data.playerId || 'unknown_player',
        displayName: data.displayName || 'Play Games User',
        avatarImageUrl: data.avatarImageUrl || '',
        title: data.title || '',
        experiencePoints: data.experienceInfo?.currentExperiencePoints
          ? parseInt(data.experienceInfo.currentExperiencePoints, 10)
          : undefined,
        level: data.experienceInfo?.currentLevel?.level || 1,
      };

      this.status.player = player;
      this.persistAuth();
      this.notify();
      return player;
    } catch (e: unknown) {
      console.warn('Failed to fetch player profile from GPGS REST API:', e);
      // Fallback placeholder profile while keeping connection active
      if (!this.status.player) {
        this.status.player = {
          playerId: 'gpgs_player_me',
          displayName: 'Google Play Gamer',
          level: 1,
          experiencePoints: 5000,
        };
        this.persistAuth();
        this.notify();
      }
      return this.status.player;
    }
  }

  /**
   * POST /achievements/{achievementId}/unlock - Unlock achievement via GPGS REST API
   */
  public async unlockAchievement(gameQuestId: string): Promise<boolean> {
    const mapping = DEFAULT_GPGS_ACHIEVEMENTS.find((a) => a.gameQuestId === gameQuestId);
    if (!mapping) return false;

    if (!this.status.isConnected || !this.status.accessToken) {
      this.enqueuePendingSync(gameQuestId, 'UNLOCK');
      return false;
    }

    if (this.status.isSandboxMode) {
      this.status.lastSyncedAt = Date.now();
      this.persistAuth();
      this.notify();
      return true;
    }

    try {
      const res = await fetch(`${GPGS_API_BASE}/achievements/${encodeURIComponent(mapping.id)}/unlock`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.status.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        this.status.lastSyncedAt = Date.now();
        this.persistAuth();
        this.notify();
        return true;
      }
      return false;
    } catch (e) {
      console.warn(`GPGS unlock error for ${gameQuestId}:`, e);
      this.enqueuePendingSync(gameQuestId, 'UNLOCK');
      return false;
    }
  }

  /**
   * POST /achievements/{achievementId}/setStepsAtLeast - Progress incremental achievement
   */
  public async setStepsAtLeast(gameQuestId: string, steps: number): Promise<boolean> {
    const mapping = DEFAULT_GPGS_ACHIEVEMENTS.find((a) => a.gameQuestId === gameQuestId);
    if (!mapping) return false;

    if (!this.status.isConnected || !this.status.accessToken) {
      this.enqueuePendingSync(gameQuestId, 'STEPS', steps);
      return false;
    }

    if (this.status.isSandboxMode) {
      this.status.lastSyncedAt = Date.now();
      this.persistAuth();
      this.notify();
      return true;
    }

    try {
      const url = `${GPGS_API_BASE}/achievements/${encodeURIComponent(mapping.id)}/setStepsAtLeast?steps=${encodeURIComponent(steps)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.status.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        this.status.lastSyncedAt = Date.now();
        this.persistAuth();
        this.notify();
        return true;
      }
      return false;
    } catch (e) {
      console.warn(`GPGS setSteps error for ${gameQuestId}:`, e);
      this.enqueuePendingSync(gameQuestId, 'STEPS', steps);
      return false;
    }
  }

  /**
   * Synchronize all current player progress & completed achievements to Google Play Games Services
   */
  public async syncAll(
    completedQuestIds: string[],
    questCounters: Record<string, number>,
    enemyLevel: number,
    relicsCount: number,
    petsCount: number,
    skillsCount: number
  ): Promise<{ syncedCount: number; errors: number }> {
    let syncedCount = 0;
    let errors = 0;

    for (const def of DEFAULT_GPGS_ACHIEVEMENTS) {
      const isCompleted = completedQuestIds.includes(def.gameQuestId);

      // Determine current value
      let currentVal = 0;
      const qDef = QUESTS.find((q) => q.id === def.gameQuestId);
      if (qDef) {
        if (qDef.metric === 'enemy_level') currentVal = enemyLevel;
        else if (qDef.metric === 'relics_owned') currentVal = relicsCount;
        else if (qDef.metric === 'pets_owned') currentVal = petsCount;
        else if (qDef.metric === 'skills_bought') currentVal = skillsCount;
        else currentVal = questCounters[qDef.metric] || 0;
      }

      if (isCompleted) {
        const ok = await this.unlockAchievement(def.gameQuestId);
        if (ok) syncedCount++;
        else errors++;
      } else if (def.achievementType === 'INCREMENTAL' && currentVal > 0) {
        const ok = await this.setStepsAtLeast(def.gameQuestId, currentVal);
        if (ok) syncedCount++;
        else errors++;
      }
    }

    this.status.lastSyncedAt = Date.now();
    this.persistAuth();
    this.notify();

    return { syncedCount, errors };
  }

  /**
   * Pending offline sync queue
   */
  private enqueuePendingSync(gameQuestId: string, type: 'UNLOCK' | 'STEPS', steps?: number) {
    try {
      const raw = localStorage.getItem(STORAGE_SYNC_QUEUE_KEY);
      const queue: Array<{ gameQuestId: string; type: 'UNLOCK' | 'STEPS'; steps?: number }> = raw
        ? JSON.parse(raw)
        : [];
      queue.push({ gameQuestId, type, steps });
      localStorage.setItem(STORAGE_SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to enqueue pending GPGS sync:', e);
    }
  }

  public flushPendingSync() {
    try {
      const raw = localStorage.getItem(STORAGE_SYNC_QUEUE_KEY);
      if (!raw) return;
      const queue: Array<{ gameQuestId: string; type: 'UNLOCK' | 'STEPS'; steps?: number }> = JSON.parse(raw);
      localStorage.removeItem(STORAGE_SYNC_QUEUE_KEY);

      queue.forEach((item) => {
        if (item.type === 'UNLOCK') {
          this.unlockAchievement(item.gameQuestId);
        } else if (item.steps !== undefined) {
          this.setStepsAtLeast(item.gameQuestId, item.steps);
        }
      });
    } catch (e) {
      console.warn('Failed to flush GPGS pending sync queue:', e);
    }
  }
}

export const playGamesService = new PlayGamesService();
