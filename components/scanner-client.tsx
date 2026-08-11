"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  BrowserCodeReader,
  BrowserMultiFormatReader,
} from "@zxing/browser";
import {
  Camera,
  CameraOff,
  Keyboard,
  LoaderCircle,
  ScanLine,
} from "lucide-react";
import type { InventoryItem } from "@/src/types/inventory";
import { normalizeBarcode } from "@/src/lib/inventory";

interface VideoDevice {
  deviceId: string;
  label: string;
}

export function ScannerClient() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const lastLookupRef = useRef<{ code: string; time: number }>({
    code: "",
    time: 0,
  });

  const [devices, setDevices] = useState<VideoDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [active, setActive] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const [message, setMessage] = useState(
    "Start the camera, then point it at a barcode.",
  );

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;

    const video = videoRef.current;

    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }

    setActive(false);
    setMessage("Start the camera, then point it at a barcode.");
  }, []);

  const lookupBarcode = useCallback(
    async (rawCode: string) => {
      const code = normalizeBarcode(rawCode);

      if (!code || lookingUp) {
        return;
      }

      const now = Date.now();

      if (
        lastLookupRef.current.code === code &&
        now - lastLookupRef.current.time < 2000
      ) {
        return;
      }

      lastLookupRef.current = {
        code,
        time: now,
      };

      setLookingUp(true);
      setMessage(`Looking up ${code}…`);

      try {
        const response = await fetch(
          `/api/items/by-barcode/${encodeURIComponent(code)}`,
          {
            cache: "no-store",
          },
        );

        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }

        if (response.status === 404) {
          setMessage(`No inventory item matches ${code}. Try again.`);
          return;
        }

        if (!response.ok) {
          throw new Error("The barcode lookup failed.");
        }

        const data = (await response.json()) as {
          item: InventoryItem;
        };

        stopScanner();
        router.push(`/inventory/${data.item.id}`);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "The barcode lookup failed.",
        );
      } finally {
        setLookingUp(false);
      }
    },
    [lookingUp, router, stopScanner],
  );

  const loadDevices = useCallback(async () => {
    try {
      const inputs = await BrowserCodeReader.listVideoInputDevices();

      const mapped = inputs.map((input, index) => ({
        deviceId: input.deviceId,
        label: input.label || `Camera ${index + 1}`,
      }));

      setDevices(mapped);

      if (!selectedDevice && mapped.length > 0) {
        const rearCamera = mapped.find((device) =>
          /back|rear|environment/i.test(device.label),
        );

        setSelectedDevice((rearCamera || mapped[0]).deviceId);
      }
    } catch (error) {
      console.error("Camera device lookup failed:", error);
    }
  }, [selectedDevice]);

  const startScanner = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      setMessage("The camera video element is unavailable.");
      return;
    }

    stopScanner();
    setMessage("Requesting camera access…");

    try {
      const reader = new BrowserMultiFormatReader();

      readerRef.current = reader;

      const constraints: MediaStreamConstraints = {
        video: selectedDevice
          ? {
              deviceId: {
                exact: selectedDevice,
              },
            }
          : {
              facingMode: {
                ideal: "environment",
              },
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
            },
        audio: false,
      };

      const controls = await reader.decodeFromConstraints(
        constraints,
        video,
        (result) => {
          if (result) {
            void lookupBarcode(result.getText());
          }
        },
      );

      controlsRef.current = controls;

      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      await video.play().catch(() => undefined);

      setActive(true);
      setMessage("Camera active. Hold a barcode inside the frame.");

      await loadDevices();
    } catch (error) {
      console.error("Camera start failed:", error);

      setActive(false);

      setMessage(
        error instanceof Error
          ? `Camera unavailable: ${error.name}: ${error.message}`
          : "Camera access failed. Use manual entry below.",
      );
    }
  }, [
    loadDevices,
    lookupBarcode,
    selectedDevice,
    stopScanner,
  ]);

  useEffect(() => {
    void loadDevices();

    return () => {
      controlsRef.current?.stop();

      const video = videoRef.current;

      if (video?.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [loadDevices]);

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookupBarcode(manualCode);
  }

  return (
    <div className="scanner-layout">
      <section className="scanner-card scanner-card-clean">
        <div className="scanner-view scanner-view-clean">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="scanner-video"
          />

          {!active ? (
            <div className="camera-state-badge">
              <span className="camera-state-dot" />
              Camera stopped
            </div>
          ) : null}

          <div className="scanner-frame-clean" aria-hidden="true">
            <span className="corner corner-top-left" />
            <span className="corner corner-top-right" />
            <span className="corner corner-bottom-left" />
            <span className="corner corner-bottom-right" />

            <div className="scanner-line-clean" />
          </div>

          <div className="scanner-message-panel">
            {lookingUp ? (
              <LoaderCircle
                className="spin"
                size={26}
                aria-hidden="true"
              />
            ) : (
              <ScanLine size={26} aria-hidden="true" />
            )}

            <div>
              <strong>
                {lookingUp
                  ? "Looking up barcode"
                  : active
                    ? "Camera active"
                    : "Camera inactive"}
              </strong>

              <span>
                {lookingUp
                  ? message
                  : active
                    ? "Hold a barcode inside the frame."
                    : "Start the camera to scan a barcode."}
              </span>
            </div>
          </div>
        </div>

        <div className="scanner-controls scanner-controls-centered">
          {devices.length > 1 ? (
            <label className="camera-select">
              Camera

              <select
                value={selectedDevice}
                onChange={(event) =>
                  setSelectedDevice(event.target.value)
                }
              >
                {devices.map((device) => (
                  <option
                    value={device.deviceId}
                    key={device.deviceId}
                  >
                    {device.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {active ? (
            <button
              className="button button-secondary camera-main-button"
              type="button"
              onClick={stopScanner}
            >
              <CameraOff size={20} aria-hidden="true" />
              Stop camera
            </button>
          ) : (
            <button
              className="button button-primary camera-main-button"
              type="button"
              onClick={() => void startScanner()}
            >
              <Camera size={20} aria-hidden="true" />
              Start camera
            </button>
          )}
        </div>
      </section>

      <section className="manual-scan-card">
        <Keyboard size={26} aria-hidden="true" />

        <div>
          <h2>Enter a barcode</h2>
          <p>Use this option when camera access is unavailable.</p>
        </div>

        <form onSubmit={submitManual}>
          <label htmlFor="manual-barcode">
            Barcode
          </label>

          <div className="inline-form">
            <input
              id="manual-barcode"
              value={manualCode}
              onChange={(event) =>
                setManualCode(event.target.value)
              }
              placeholder="B9-325"
              autoCapitalize="characters"
              required
            />

            <button
              className="button button-primary"
              type="submit"
              disabled={lookingUp}
            >
              Find item
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}