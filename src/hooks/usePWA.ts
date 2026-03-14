import { useState, useEffect, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isStandaloneMode = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

// Install prompt hook
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isStandaloneMode());

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    const displayModeMedia = window.matchMedia("(display-mode: standalone)");
    const displayModeHandler = () => setIsInstalled(isStandaloneMode());

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    displayModeMedia.addEventListener?.("change", displayModeHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      displayModeMedia.removeEventListener?.("change", displayModeHandler);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setIsInstallable(false);

    return outcome === "accepted";
  }, [deferredPrompt]);

  return { isInstallable, isInstalled, install };
}

// SW update hook
export function usePWAUpdate() {
  const [isStandalone, setIsStandalone] = useState(isStandaloneMode());
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      setInterval(() => {
        registration.update();
      }, 30 * 60 * 1000);
    },
  });

  useEffect(() => {
    const displayModeMedia = window.matchMedia("(display-mode: standalone)");
    const updateStandaloneState = () => setIsStandalone(isStandaloneMode());

    window.addEventListener("appinstalled", updateStandaloneState);
    displayModeMedia.addEventListener?.("change", updateStandaloneState);

    return () => {
      window.removeEventListener("appinstalled", updateStandaloneState);
      displayModeMedia.removeEventListener?.("change", updateStandaloneState);
    };
  }, []);

  const dismiss = useCallback(() => setNeedRefresh(false), [setNeedRefresh]);

  const update = useCallback(async () => {
    if (isUpdating) return;

    setIsUpdating(true);

    try {
      await updateServiceWorker(true);
      window.setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (error) {
      console.error("PWA update failed, reloading page", error);
      window.location.reload();
    }
  }, [isUpdating, updateServiceWorker]);

  return { needRefresh, dismiss, update, isStandalone, isUpdating };
}
