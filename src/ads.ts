/**
 * Ads adapter. The web build never shows or references ads; on the iOS
 * build (Capacitor) it bridges to @capacitor-community/admob when the plugin
 * and unit IDs are present. Fill the IDs in src/config.ts before building
 * the app, then rebuild (`npm run build`) — nothing secret ever ships in
 * the public site.
 */
import {
  ADMOB_APP_ID, ADMOB_INTERSTITIAL_ID, ADMOB_REWARDED_ID,
  INTERSTITIAL_COOLDOWN, INTERSTITIAL_EVERY, INTERSTITIAL_MIN_LEVEL,
} from './config';
import { store } from './save';

export interface AdsAdapter {
  readonly kind: 'web' | 'native';
  readonly available: boolean;
  needsConsent(): boolean;
  setPersonalized(v: boolean): void;
  showRewarded(placement: string): Promise<boolean>;
  /** Returns true if an interstitial was actually presented. */
  showInterstitial(placement: string): boolean;
  /** Cadence-gated interstitial after wins (native only). */
  maybeInterstitial(winCount: number, level: number): boolean;
}

interface CapacitorPlugin {
  [k: string]: unknown;
}

/** Shape of the @capacitor-community/admob bridge we rely on (all optional). */
interface AdMobLike {
  initialize?: (opts: { appID?: string }) => Promise<unknown>;
  prepareRewardVideoAd?: (opts: { adID?: string }) => Promise<unknown>;
  prepareInterstitial?: (opts: { adID?: string }) => Promise<unknown>;
  showRewardVideoAd?: () => Promise<unknown>;
  showInterstitial?: () => Promise<unknown>;
  requestTrackingAuthorization?: () => Promise<unknown>;
}

function capPlugins(): Record<string, CapacitorPlugin> | null {
  const w = window as unknown as { Capacitor?: { isPluginAvailable?: (n: string) => boolean; Plugins?: Record<string, CapacitorPlugin> } };
  const cap = w.Capacitor;
  if (!cap || !cap.Plugins || !cap.isPluginAvailable?.('AdMob')) return null;
  return cap.Plugins;
}

class WebAds implements AdsAdapter {
  readonly kind = 'web' as const;
  readonly available = false;
  needsConsent(): boolean { return false; }
  setPersonalized(): void { /* web build serves no ads */ }
  async showRewarded(): Promise<boolean> { return false; }
  showInterstitial(): boolean { return false; }
  maybeInterstitial(): boolean { return false; }
}

class NativeAds implements AdsAdapter {
  readonly kind = 'native' as const;
  readonly available = true;
  private lastInterstitial = -INTERSTITIAL_COOLDOWN;
  private initialized = false;

  private plugin(): AdMobLike | null {
    return (capPlugins()?.['AdMob'] as AdMobLike | undefined) || null;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await this.plugin()?.initialize?.({ appID: ADMOB_APP_ID });
      await this.plugin()?.prepareRewardVideoAd?.({ adID: ADMOB_REWARDED_ID });
      await this.plugin()?.prepareInterstitial?.({ adID: ADMOB_INTERSTITIAL_ID });
    } catch {
      /* plugin API mismatch: ads stay unavailable in practice */
    }
  }

  needsConsent(): boolean {
    return store.data.adConsent === 'unset';
  }

  setPersonalized(v: boolean): void {
    store.data.adConsent = v ? 'personalized' : 'nonpersonalized';
    store.mark();
    try {
      void this.plugin()?.requestTrackingAuthorization?.();
    } catch {
      /* ATT handled in native layer */
    }
  }

  async showRewarded(placement: string): Promise<boolean> {
    await this.init();
    void placement;
    try {
      await this.plugin()?.showRewardVideoAd?.();
      return true;
    } catch {
      return false;
    }
  }

  showInterstitial(placement: string): boolean {
    void placement;
    void this.init().then(() => {
      try {
        void this.plugin()?.showInterstitial?.();
      } catch {
        /* ignore */
      }
    });
    return true;
  }

  /** Called by the game shell after wins, honoring the cadence policy. */
  maybeInterstitial(winCount: number, level: number): boolean {
    if (store.data.purchases.removeAds) return false;
    if (level < INTERSTITIAL_MIN_LEVEL) return false;
    if (winCount % INTERSTITIAL_EVERY !== 0) return false;
    const now = Date.now() / 1000;
    if (now - this.lastInterstitial < INTERSTITIAL_COOLDOWN) return false;
    this.lastInterstitial = now;
    return this.showInterstitial('level_complete');
  }
}

export function createAds(): AdsAdapter {
  const configured = ADMOB_APP_ID && ADMOB_REWARDED_ID && ADMOB_INTERSTITIAL_ID;
  if (configured && capPlugins()) return new NativeAds();
  return new WebAds();
}
