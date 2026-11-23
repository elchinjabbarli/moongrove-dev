/**
 * In-app purchases adapter. Products are declared in src/config.ts and map
 * to App Store product IDs (com.elchinjabbarli.moongrove.*). On the web the
 * store renders them as "available in the iOS app"; in the Capacitor build
 * this adapter bridges to the store plugin (RevenueCat's Purchases or
 * cordova-plugin-purchase) once installed.
 */
import { PRODUCTS } from './config';
import { store } from './save';
import type { ProductDef } from './config';

export interface IapAdapter {
  readonly kind: 'web' | 'native';
  readonly available: boolean;
  purchase(def: ProductDef): Promise<boolean>;
  restore(): Promise<boolean>;
}

interface CapacitorPlugin {
  [k: string]: unknown;
}

/** Bridge shape for RevenueCat Purchases / cordova-plugin-purchase. */
interface PurchaseLike {
  purchase?: (opts: { productIdentifier: string }) => Promise<{ completed?: boolean; transaction?: unknown }>;
  restore?: () => Promise<{ products?: { identifier: string }[] }>;
}

function storePlugin(): PurchaseLike | null {
  const w = window as unknown as { Capacitor?: { isPluginAvailable?: (n: string) => boolean; Plugins?: Record<string, CapacitorPlugin> } };
  const cap = w.Capacitor;
  if (!cap?.Plugins || !cap.isPluginAvailable) return null;
  for (const name of ['Purchases', 'CdvPurchase', 'InAppPurchases']) {
    if (cap.isPluginAvailable(name)) return cap.Plugins[name] as PurchaseLike;
  }
  return null;
}

/** Applies the entitlement of a product to the local save. */
export function grant(def: ProductDef): void {
  if (def.id.endsWith('.removeads')) {
    store.data.purchases.removeAds = true;
  }
  if (def.dew > 0) store.data.dew += def.dew;
  if (def.boosters) {
    for (const b of Object.keys(store.data.boosters)) store.data.boosters[b] += def.boosters;
  }
  store.mark();
  store.flush();
}

class WebIap implements IapAdapter {
  readonly kind = 'web' as const;
  readonly available = false;
  async purchase(): Promise<boolean> { return false; }
  async restore(): Promise<boolean> { return false; }
}

class NativeIap implements IapAdapter {
  readonly kind = 'native' as const;
  readonly available = true;

  async purchase(def: ProductDef): Promise<boolean> {
    try {
      const res = await storePlugin()?.purchase?.({ productIdentifier: def.id });
      const ok = !!res?.completed || !!res?.transaction;
      if (ok) grant(def);
      return ok;
    } catch {
      return false;
    }
  }

  async restore(): Promise<boolean> {
    try {
      const res = await storePlugin()?.restore?.();
      let any = false;
      for (const p of res?.products || []) {
        const def = PRODUCTS.find((d) => d.id === p.identifier);
        if (def) {
          grant(def);
          any = true;
        }
      }
      return any;
    } catch {
      return false;
    }
  }
}

export function createIap(): IapAdapter {
  return storePlugin() ? new NativeIap() : new WebIap();
}
